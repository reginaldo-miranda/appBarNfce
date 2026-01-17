import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { saleService, API_URL, caixaService, getWsUrl } from '../../src/services/api';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { events } from '../../src/utils/eventBus';
import { mesaService } from '../../src/services/api';
import { SafeIcon } from '../../components/SafeIcon';

interface Sale {
  _id: string;
  numeroComanda?: string;
  nomeComanda?: string;
  tipoVenda: string;
  status: string;
  itens: {
    produto?: string;
    nomeProduto: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    _id: string;
  }[];
  mesa?: { _id?: string; numero?: string; nome?: string; funcionarioResponsavel?: { nome: string }; nomeResponsavel?: string };
  funcionario?: { nome: string };
  // Snapshots adicionados na finalização
  responsavelNome?: string; // cliente
  responsavelFuncionario?: string; // se existir, manter por compatibilidade
  funcionarioNome?: string; // funcionário que finalizou (compatibilidade)
  funcionarioId?: string;
  funcionarioAberturaNome?: string; // funcionário que abriu a mesa
  funcionarioAberturaId?: string;
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento?: string;
  createdAt: string;
  updatedAt: string;
}

interface CaixaVenda {
  venda: Sale;
  valor: number;
  formaPagamento: string;
  dataVenda: string;
}

export default function CaixaScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');

  const [caixaVendas, setCaixaVendas] = useState<CaixaVenda[]>([]);
  const [hasCaixaAberto, setHasCaixaAberto] = useState<boolean>(false);
  // Map de detalhes de mesa por venda._id (quando populate faltar)
  const [mesaInfoBySale, setMesaInfoBySale] = useState<Record<string, any>>({});
  // Filtro por data (padrão hoje)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [markFilter, setMarkFilter] = useState<'all' | 'marked' | 'unmarked'>('all');
  const [paymentFilterWeb, setPaymentFilterWeb] = useState<'all' | 'dinheiro' | 'cartao' | 'pix'>('all');

  // Helpers e cálculos para filtro por data e subtotais
  const formatSelectedDate = selectedDate.toLocaleDateString('pt-BR');
  const prevDay = () => setSelectedDate((d: Date) => new Date(d.getTime() - 86400000));
  const nextDay = () => setSelectedDate((d: Date) => new Date(d.getTime() + 86400000));

  const filteredCaixaVendas: CaixaVenda[] = caixaVendas.filter((cv: CaixaVenda) => {
    const dv = new Date(cv.dataVenda || cv.venda?.createdAt);
    const matchDate = dv.toDateString() === selectedDate.toDateString();

    if (!matchDate) return false;

    if (Platform.OS !== 'web') {
      return true;
    }

    const isMarked = !!marks[saleKey(cv.venda)];
    const matchMark =
      markFilter === 'all' ||
      (markFilter === 'marked' ? isMarked : !isMarked);

    const method = String(cv.formaPagamento || '').toLowerCase();
    const matchPayment =
      paymentFilterWeb === 'all' || method === paymentFilterWeb;

    return matchMark && matchPayment;
  });

  const paymentTotals: Record<string, number> = filteredCaixaVendas.reduce((acc: Record<string, number>, cv: CaixaVenda) => {
    const m = String(cv.formaPagamento || '').toLowerCase();
    const v = Number(cv.valor ?? cv.venda?.total ?? 0);
    acc[m] = (acc[m] || 0) + v;
    return acc;
  }, {} as Record<string, number>);

  const formatMethodLabel = (m: string) => {
    const cleaned = (m || '').trim();
    if (!cleaned) return 'Indefinido';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const loadVendas = async () => {
    try {
      setLoading(true);
      console.log('🔄 Carregando vendas abertas do Caixa...');
      console.log('🔗 API_URL:', API_URL);

      const response = await saleService.open();
      const abertas = response.data || [];
      console.log('✅ Vendas abertas carregadas:', abertas);

      if (Array.isArray(abertas) && abertas.length > 0) {
        setVendas(abertas);
        console.log(`📊 ${abertas.length} vendas abertas encontradas`);
      } else {
        console.log('⚠️ Nenhuma venda com status "aberta". Tentando fallback status="aberto"...');
        const respFallback = await saleService.list({ status: 'aberto' });
        const abertasFallback = respFallback.data || [];
        console.log('✅ Fallback vendas abertas (status="aberto"):', abertasFallback);
        setVendas(abertasFallback);
        console.log(`📊 ${abertasFallback.length} vendas (status="aberto") encontradas`);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar vendas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as vendas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCaixaAberto = async () => {
    try {
      console.log('🔄 Buscando caixa aberto e vendas registradas...');
      const resp = await caixaService.statusAberto();
      const caixaData = resp.data;
      setHasCaixaAberto(true);

      const vendasRegistradas: CaixaVenda[] = (caixaData?.vendas || []).map((v: any) => ({
        venda: v.venda,
        valor: v.valor,
        formaPagamento: v.formaPagamento,
        dataVenda: v.dataVenda,
      }));
      setCaixaVendas(vendasRegistradas);
      console.log(`🧾 ${vendasRegistradas.length} vendas registradas no caixa aberto`);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.log('ℹ️ Nenhum caixa aberto no momento.');
        setHasCaixaAberto(false);
        setCaixaVendas([]);
      } else {
        console.error('❌ Erro ao buscar caixa aberto:', error);
      }
    }
  };

  // Atualizações sem spinner para evitar flicker
  const softRefreshVendas = async () => {
    try {
      const response = await saleService.open();
      const abertas = response.data || [];
      setVendas((prev) => {
        const byId = new Map<string, any>();
        prev.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
        abertas.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
        return Array.from(byId.values());
      });
    } catch {}
  };

  const softRefreshCaixa = async () => {
    try {
      const resp = await caixaService.statusAberto();
      const caixaData = resp.data;
      setHasCaixaAberto(true);
      const vendasRegistradas: CaixaVenda[] = (caixaData?.vendas || []).map((v: any) => ({
        venda: v.venda,
        valor: v.valor,
        formaPagamento: v.formaPagamento,
        dataVenda: v.dataVenda,
      }));
      setCaixaVendas(vendasRegistradas);
    } catch {}
  };

  const calcularTotal = (venda: Sale) => {
    return venda.itens.reduce((total, item) => {
      return total + (item.precoUnitario * item.quantidade);
    }, 0);
  };

  const finalizarVenda = async () => {
    if (!selectedSale) return;

    try {
      console.log('🔄 Finalizando venda:', selectedSale._id);
      console.log('💳 Método de pagamento:', paymentMethod);

      const response = await saleService.finalize(selectedSale._id, {
        formaPagamento: paymentMethod
      });

      console.log('✅ Venda finalizada com sucesso:', response);
      
      Alert.alert('Sucesso', 'Venda finalizada com sucesso!');
      setModalVisible(false);
      setSelectedSale(null);
      await loadVendas(); // Recarregar a lista
      await loadCaixaAberto(); // Atualizar vendas registradas no caixa
      
    } catch (error: any) {
      console.error('❌ Erro ao finalizar venda:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error.response) {
        errorMessage = error.response.data?.error || `Erro ${error.response.status}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Erro', `Não foi possível finalizar a venda: ${errorMessage}`);
    }
  };

  const abrirModalFinalizacao = (venda: Sale) => {
    setSelectedSale(venda);
    setPaymentMethod('dinheiro');
    setModalVisible(true);
  };

  const persistMarks = (next: Record<string, boolean>) => {
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem('caixaMarks', JSON.stringify(next));
      } catch (e) {
        console.log('Falha ao salvar marcas', e);
      }
    }
  };

  const toggleMark = (saleId: string) => {
    setMarks(prev => {
      const next = { ...prev, [saleId]: !prev[saleId] };
      persistMarks(next);
      return next;
    });
  };

  useEffect(() => {
    loadVendas();
    loadCaixaAberto();
    const unsubscribe = events.on('caixa:refresh', () => onRefresh());
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    let since = Date.now();
    const t = setInterval(async () => {
      try {
        const res = await saleService.updates(since);
        const updates = res?.data?.updates || [];
        if (updates.length) {
          since = res?.data?.now || Date.now();
          // Buscar somente vendas alteradas e mesclar sem spinner
          const ids: string[] = updates.map((u: any) => String(u.id));
          const results = await Promise.all(ids.map((id) => saleService.getById(id)));
          const changed = results.map((r) => r.data).filter(Boolean);
          if (changed.length) {
            setVendas((prev) => {
              const byId = new Map<string, any>();
              prev.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
              changed.forEach((v: any) => byId.set(String((v as any)?._id || (v as any)?.id), v));
              return Array.from(byId.values());
            });
          }
          await softRefreshCaixa();
        }
      } catch {}
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // WS para mobile/ExpoGo (bidirecional)
    try {
      const url = getWsUrl();
      if (url) {
        const ws = new (globalThis as any).WebSocket(url);
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              const id = String(msg?.payload?.id || '');
              if (!id) return;
              const r = await saleService.getById(id);
              const v = r.data;
              if (v) {
                setVendas((prev) => {
                  const byId = new Map<string, any>();
                  prev.forEach((x: any) => byId.set(String((x as any)?._id || (x as any)?.id), x));
                  byId.set(String(v._id || v.id), v);
                  return Array.from(byId.values());
                });
                await softRefreshCaixa();
              }
            }
          } catch {}
        };
        return () => { try { ws.close(); } catch {} };
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const saved = window.localStorage.getItem('caixaMarks');
        if (saved) setMarks(JSON.parse(saved));
      } catch (e) {
        console.log('Falha ao carregar marcas do localStorage', e);
      }
    }
  }, []);

  // Quando caixaVendas atualiza, buscar mesa faltando populate
  useEffect(() => {
    const fetchMissingMesa = async () => {
      try {
        const tasks = caixaVendas
          .filter(cv => {
            const mesaRef: any = cv?.venda?.mesa;
            if (!mesaRef) return false;
            // Buscar quando for string (ObjectId) OU quando vier objeto incompleto (sem funcionarioResponsavel.nome ou nomeResponsavel)
            if (typeof mesaRef === 'string') return true;
            if (typeof mesaRef === 'object') {
              const hasFuncNome = !!mesaRef?.funcionarioResponsavel?.nome && String(mesaRef?.funcionarioResponsavel?.nome).trim().length > 0;
              const hasRespNome = !!mesaRef?.nomeResponsavel && String(mesaRef?.nomeResponsavel).trim().length > 0;
              // Se faltar algum dos nomes, tentar buscar detalhes completos
              return !(hasFuncNome && hasRespNome);
            }
            return false;
          })
          .map(async (cv) => {
            const mesaRef: any = cv?.venda?.mesa;
            const mesaId = typeof mesaRef === 'string' ? mesaRef : mesaRef?._id;
            if (!mesaId) return;
            try {
              const resp = await mesaService.getById(mesaId);
              const mesaData = resp?.data?.data || resp?.data; // algumas rotas retornam { data }
              if (mesaData && mesaData._id) {
                setMesaInfoBySale(prev => ({ ...prev, [saleKey(cv.venda)]: mesaData }));
              }
            } catch (e) {
              console.warn('Falha ao buscar detalhes da mesa', mesaId, e);
            }
          });
        await Promise.all(tasks);
      } catch (err) {
        console.warn('Erro ao resolver mesas sem populate:', err);
      }
    };

    if (caixaVendas.length > 0) {
      fetchMissingMesa();
    }
  }, [caixaVendas]);

  // Helper para título da venda evitando "Mesa undefined"
  const getVendaTitle = (venda: Sale) => {
    // Preferir presença de venda.mesa ao invés de tipoVenda
    if (venda.mesa) {
      const nomeMesa = venda.mesa?.nome;
      const numeroMesa = venda.mesa?.numero;
      if (nomeMesa) return nomeMesa;
      if (numeroMesa != null) return `Mesa ${numeroMesa}`;
      return 'Mesa';
    }
    // Quando for comanda, explicitar “Comanda” no título
    if (venda.nomeComanda) return `Comanda ${venda.nomeComanda}`;
    if (venda.numeroComanda) return `Comanda ${venda.numeroComanda}`;
    return 'Comanda';
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVendas();
    loadCaixaAberto();
  };

  // Recarrega ao focar na tela (útil após fechar mesa em outra aba)
  useFocusEffect(
    React.useCallback(() => {
      onRefresh();
      return () => {};
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Carregando vendas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Caixa" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Sistema de Caixa</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <SafeIcon name="refresh" size={20} color="#2196F3" fallbackText="↻" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Vendas abertas para finalizar */}
        <Text style={[styles.sectionTitle]}>Vendas em aberto</Text>
        {vendas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <SafeIcon name="receipt-outline" size={64} color="#ccc" fallbackText="🧾" />
            <Text style={styles.emptyText}>Nenhuma venda em aberto</Text>
          </View>
        ) : (
          <View style={styles.listGrid}>
            {vendas.map((venda) => (
              <View key={venda._id} style={styles.vendaCard}>
                <View style={styles.rowLine}>
                  <Text style={styles.vendaTitle}>
                    {getVendaTitle(venda)}
                  </Text>
                  <View style={styles.rowRight}>
                    <Text style={styles.vendaTotal}>
                      R$ {calcularTotal(venda).toFixed(2)}
                    </Text>
                    <TouchableOpacity
                      style={styles.rowAction}
                      onPress={() => abrirModalFinalizacao(venda)}
                      accessibilityLabel="Finalizar venda"
                    >
                      <SafeIcon name="checkmark-circle" size={20} color="#4CAF50" fallbackText="✓" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.vendaInfoCompact}>
                    Itens: {venda.itens.length} | Funcionário: {venda.funcionario?.nome || 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Vendas registradas no Caixa aberto */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Vendas registradas no Caixa</Text>
        {!hasCaixaAberto ? (
          <View style={styles.emptyContainer}>
            <SafeIcon name="cash-outline" size={64} color="#ccc" fallbackText="＄" />
            <Text style={styles.emptyText}>Nenhum caixa aberto</Text>
          </View>
        ) : (
          <>
            <View style={styles.filterBar}>
              <TouchableOpacity onPress={prevDay} accessibilityLabel="Dia anterior">
                <SafeIcon name="chevron-back" size={20} color="#333" fallbackText="‹" />
              </TouchableOpacity>
              <Text style={styles.dateDisplay}>{formatSelectedDate}</Text>
              <TouchableOpacity onPress={nextDay} accessibilityLabel="Próximo dia">
                <SafeIcon name="chevron-forward" size={20} color="#333" fallbackText="›" />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryBar}>
              {Object.entries(paymentTotals as Record<string, number>).length === 0 ? (
                <Text style={styles.summaryItem}>Sem subtotais</Text>
              ) : (
                Object.entries(paymentTotals as Record<string, number>).map(([method, total]) => (
                  <Text key={method} style={styles.summaryItem}>
                    {formatMethodLabel(method)}: R$ {total.toFixed(2)}
                  </Text>
                ))
              )}
            </View>

            {Platform.OS === 'web' && (
              <View style={styles.filterBar}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={[styles.paymentOption, markFilter === 'all' && styles.paymentOptionSelected]}
                    onPress={() => setMarkFilter('all')}
                  >
                    <Text style={[styles.paymentOptionText, markFilter === 'all' && styles.paymentOptionTextSelected]}>Todos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentOption, markFilter === 'marked' && styles.paymentOptionSelected]}
                    onPress={() => setMarkFilter('marked')}
                  >
                    <Text style={[styles.paymentOptionText, markFilter === 'marked' && styles.paymentOptionTextSelected]}>Marcados</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paymentOption, markFilter === 'unmarked' && styles.paymentOptionSelected]}
                    onPress={() => setMarkFilter('unmarked')}
                  >
                    <Text style={[styles.paymentOptionText, markFilter === 'unmarked' && styles.paymentOptionTextSelected]}>Não marcados</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {['all', 'dinheiro', 'cartao', 'pix'].map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[styles.paymentOption, paymentFilterWeb === method && styles.paymentOptionSelected]}
                      onPress={() => setPaymentFilterWeb(method as any)}
                    >
                      <Text style={[styles.paymentOptionText, paymentFilterWeb === method && styles.paymentOptionTextSelected]}
                      >
                        {method === 'all' ? 'Todas' : method.charAt(0).toUpperCase() + method.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {filteredCaixaVendas.length === 0 ? (
              <View style={styles.emptyContainer}>
                <SafeIcon name="list-outline" size={64} color="#ccc" fallbackText="≡" />
                <Text style={styles.emptyText}>Nenhuma venda registrada no caixa</Text>
              </View>
            ) : (
              <View style={styles.listGrid}>
                {filteredCaixaVendas.map((cv, idx) => {
                  const mesaObj: any = mesaInfoBySale[saleKey(cv.venda)] || ((cv.venda.mesa && typeof cv.venda.mesa === 'object') ? cv.venda.mesa : undefined);
                  const clean = (s: any) => (typeof s === 'string' ? s.trim() : '');
                  const nomeRespMesa = clean(mesaObj?.nomeResponsavel);
                  const nomeFuncMesa = clean(mesaObj?.funcionarioResponsavel?.nome);
                  let responsavel = 
                    nomeRespMesa ||
                    clean(cv.venda?.responsavelNome) ||
                    'N/A';
                  let funcionario = 
                    nomeFuncMesa ||
                    clean(cv.venda?.funcionario?.nome) ||
                    clean((cv.venda as any)?.funcionarioAberturaNome) ||
                    clean((cv.venda as any)?.funcionarioNome) ||
                    'N/A';
                  if (responsavel !== 'N/A' && funcionario !== 'N/A' && responsavel === funcionario) {
                    const respAlt = clean(cv.venda?.responsavelNome);
                    if (respAlt && respAlt !== funcionario) {
                      responsavel = respAlt;
                    } else {
                      responsavel = 'N/A';
                    }
                  }
                  return (
                    <View key={`${saleKey(cv.venda)}-${idx}`} style={styles.vendaCard}>
                      <View style={styles.rowLine}>
                        <Text style={styles.vendaTitle}>
                          {mesaObj
                            ? (mesaObj?.nome || (mesaObj?.numero != null ? `Mesa ${mesaObj?.numero}` : 'Mesa'))
                            : getVendaTitle(cv.venda)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.vendaTotal}>R$ {cv.valor.toFixed(2)}</Text>
                          {Platform.OS === 'web' && (
                            <TouchableOpacity
                              style={styles.rowAction}
                              onPress={() => toggleMark(saleKey(cv.venda))}
                              accessibilityLabel={marks[saleKey(cv.venda)] ? 'Desmarcar' : 'Marcar'}
                            >
                              <SafeIcon
                                name={marks[saleKey(cv.venda)] ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={marks[saleKey(cv.venda)] ? '#2196F3' : '#999'}
                                fallbackText={marks[saleKey(cv.venda)] ? '☑' : '☐'}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <View style={styles.rowLine}>
                        <Text style={styles.vendaInfoCompact}>
                          Resp: {responsavel} | Atend: {funcionario} | Pgto: {cv.formaPagamento} | Itens: {cv.venda?.itens?.length ?? 0}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Modal de Finalização */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Venda</Text>
            
            {selectedSale && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>
                  {getVendaTitle(selectedSale)}
                </Text>
                <Text style={styles.modalInfoText}>
                  Total: R$ {calcularTotal(selectedSale).toFixed(2)}
                </Text>
              </View>
            )}
            
            <Text style={styles.paymentLabel}>Forma de Pagamento:</Text>
            
            <View style={styles.paymentOptions}>
              {['dinheiro', 'cartao', 'pix'].map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentOption,
                    paymentMethod === method && styles.paymentOptionSelected
                  ]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[
                    styles.paymentOptionText,
                    paymentMethod === method && styles.paymentOptionTextSelected
                  ]}>
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={finalizarVenda}
              >
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 6,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  vendaCard: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    width: Platform.OS === 'web' ? '49%' : '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAction: {
    marginLeft: 4,
  },
  vendaInfoCompact: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  vendaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  vendaTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  vendaInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  vendaActions: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  finalizarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  finalizarButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  modalInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  paymentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paymentOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  paymentOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  paymentOptionText: {
    fontSize: 12,
    color: '#666',
  },
  paymentOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    padding: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 6,
  },
  dateDisplay: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  summaryItem: {
    fontSize: 12,
    color: '#333',
    marginRight: 10,
    marginVertical: 2,
  },
});
  const saleKey = (v: Sale) => String((v as any)?._id || (v as any)?.id || '');
