import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { SafeIcon } from '../../components/SafeIcon';
import { mesaService, saleService, employeeService, getWsUrl, authService } from '../../src/services/api';
import { STORAGE_KEYS } from '../../src/services/storage';
  import ProductSelector from '../../src/components/ProductSelector.js';
  import { useAuth } from '../../src/contexts/AuthContext';
  import SearchAndFilter from '../../src/components/SearchAndFilter';
  import ScreenIdentifier from '../../src/components/ScreenIdentifier';
  import { API_URL } from '../../src/services/api';
  import { events } from '../../src/utils/eventBus';
  import PasswordConfirmModal from '../../src/components/PasswordConfirmModal';
import { useFocusEffect } from '@react-navigation/native';

interface Funcionario {
  _id: string;
  nome: string;
  ativo?: boolean;
}

interface Mesa {
  _id: string;
  numero: number;
  status: 'livre' | 'ocupada' | 'reservada' | 'manutencao';
  capacidade: number;
  observacoes?: string;
  nomeResponsavel?: string;
  funcionarioResponsavel?: {
    _id: string;
    nome: string;
  };
  vendaAtual?: {
    _id?: string;
    id?: number;
    total?: number;
  };
}

export default function MesasScreen() {
  const { user } = useAuth();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [mesaOpenTotals, setMesaOpenTotals] = useState<Record<string, { total: number; pago: number }>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  
  // Estados para modais
  const [gerarMesasModalVisible, setGerarMesasModalVisible] = useState(false);
  const [criarMesaModalVisible, setCriarMesaModalVisible] = useState(false);
  const [abrirMesaModalVisible, setAbrirMesaModalVisible] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  
  // Modal de pagamento ao fechar mesa
  const [fecharMesaModalVisible, setFecharMesaModalVisible] = useState(false);
  const [fecharMesaSelecionada, setFecharMesaSelecionada] = useState<Mesa | null>(null);
  const [fecharPaymentMethod, setFecharPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [fecharTotal, setFecharTotal] = useState<number>(0);
  const [fecharSaleId, setFecharSaleId] = useState<string | null>(null);
  const [fecharValorPago, setFecharValorPago] = useState<number>(0);
  const [finalizandoMesa, setFinalizandoMesa] = useState(false);

  // Estado para cancelar mesa
  const [cancelMesaModalVisible, setCancelMesaModalVisible] = useState(false);
  const [cancelMesaTarget, setCancelMesaTarget] = useState<Mesa | null>(null);
  
  // Estados para formulários
  const [quantidades, setQuantidades] = useState({
    interna: 10,
    externa: 5,
    vip: 3,
    balcao: 2
  });
  
  const [formMesa, setFormMesa] = useState({
    numero: '',
    nome: '',
    capacidade: '',
    tipo: 'interna',
    observacoes: ''
  });
  
  const [formAbrirMesa, setFormAbrirMesa] = useState({
    nomeResponsavel: '',
    funcionarioResponsavel: '',
    observacoes: ''
  });
  
  // Estados para loading
  const [gerandoMesas, setGerandoMesas] = useState(false);
  const [criandoMesa, setCriandoMesa] = useState(false);
  const [abindoMesa, setAbindoMesa] = useState(false);
  
  // Estados para funcionários
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionarioDropdownVisible, setFuncionarioDropdownVisible] = useState(false);
  
  // Estados para tooltips
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  // Filtros de status
  const statusFilters = [
    { key: 'todas', label: 'Todas', icon: 'restaurant', color: '#666' },
    { key: 'livre', label: 'Livres', icon: 'checkmark-circle', color: '#4CAF50' },
    { key: 'ocupada', label: 'Ocupadas', icon: 'people', color: '#F44336' },
    { key: 'reservada', label: 'Reservadas', icon: 'time', color: '#FF9800' },
    { key: 'manutencao', label: 'Manutenção', icon: 'construct', color: '#9E9E9E' },
  ];

  // Função para lidar com mudanças de filtro
  const handleFilterChange = (filterKey: string) => {
    setSelectedStatus(filterKey === 'todas' ? null : filterKey);
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadMesas();
    loadFuncionarios();
  }, []);

  useEffect(() => {
    const w = Dimensions.get('window').width;
    const shouldTablet = Platform.OS === 'web' || w >= 1024;
    (async () => {
      try {
        if (shouldTablet) await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_MODE, 'tablet');
      } catch {}
    })();
    return () => { AsyncStorage.removeItem(STORAGE_KEYS.CLIENT_MODE).catch(() => {}); };
  }, []);

  // Garantir token de autenticação para operações protegidas
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (!token) {
          const login = await authService.login({ email: 'admin@barapp.com', senha: '123456' });
          const tk = login?.data?.token;
          if (tk && mounted) await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tk);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Revalidar quando a tela ganhar foco e quando eventos de atualização ocorrerem
  useFocusEffect(
    useCallback(() => {
      const off = events.on('mesas:refresh', () => {
        console.log('🔁 Evento mesas:refresh recebido, recarregando mesas');
        loadMesas();
      });
      return () => off();
    }, [loadMesas])
  );

  // Polling leve para garantir atualização mesmo sem interação
  useFocusEffect(
    useCallback(() => {
      const intervalId = setInterval(() => {
        console.log('⏱️ Polling de mesas a cada 5s');
        loadMesas();
      }, 5000);
      return () => clearInterval(intervalId);
    }, [loadMesas])
  );

  async function loadMesas(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const response = await mesaService.list();
      const mesasData = Array.isArray(response?.data) ? response.data : [];
      let needsReload = false;
      
      for (const mesa of mesasData) {
        if (mesa?.vendaAtual && mesa?.status !== 'ocupada') {
          try {
            const idToUpdate = mesa?._id ?? mesa?.id;
            if (idToUpdate != null) {
              await mesaService.update(idToUpdate, { status: 'ocupada' });
              needsReload = true;
            }
          } catch (updateError) {
            console.error('Erro ao corrigir status da mesa:', mesa.numero, updateError);
          }
        }
      }
      
      // Se houve correções, recarrega os dados
      if (needsReload) {
        const updatedResponse = await mesaService.list();
        setMesas(Array.isArray(updatedResponse?.data) ? updatedResponse.data : []);
      } else {
        setMesas(mesasData);
      }
    } catch (error: any) {
      console.error('Erro ao carregar mesas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as mesas');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function softRefreshMesas() {
    try {
      const response = await mesaService.list();
      const mesasData = response.data || [];
      setMesas(mesasData);
    } catch {}
  }

  useEffect(() => {
    try {
      const ocupadas = (Array.isArray(mesas) ? mesas : []).filter((m) => m?.status === 'ocupada');
      ocupadas.forEach(async (m) => {
        const idStr = String(m?._id ?? (m as any)?.id ?? '');
        if (!idStr) return;
        try {
          const resp = await saleService.getByMesa(m._id ?? (m as any)?.id);
          const sales = Array.isArray(resp?.data) ? resp.data : [];
          const aberta = sales.find((s: any) => String(s?.status || '').toLowerCase() === 'aberta');
          const itens = Array.isArray(aberta?.itens) ? aberta.itens : [];
          const total = itens.reduce((sum: number, it: any) => sum + Number(it?.subtotal ?? (Number(it?.quantidade) * Number(it?.precoUnitario))), 0);
          const pago = (aberta?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
          const idNum = Number((m as any)?.id || 0);
          const k1 = idStr;
          const k2 = idNum ? String(idNum) : undefined;
          setMesaOpenTotals((prev) => ({ ...prev, [k1]: { total, pago }, ...(k2 ? { [k2]: { total, pago } } : {}) }));
        } catch {}
      });
    } catch {}
  }, [mesas]);

  async function loadFuncionarios() {
    try {
      const response = await employeeService.getAll();
      setFuncionarios(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar funcionários:', error);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMesas();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const lastFetchRef = { ts: 0 } as any;
    let ws: any = null;
    let sse: any = null;
    let pollTimer: any = null;
    let reconnectTimer: any = null;
    let reconnectDelay = 1000;
    const maxDelay = 8000;

    const scheduleFetch = async () => {
      const now = Date.now();
      if (now - lastFetchRef.ts >= 1500) {
        lastFetchRef.ts = now;
        await softRefreshMesas();
      }
    };

    const startPolling = () => {
      stopPolling();
      pollTimer = setInterval(scheduleFetch, 2000);
    };
    const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

    const connectWebSocket = () => {
      try {
        const url = getWsUrl();
        if (!url) { startPolling(); return; }
        ws = new (globalThis as any).WebSocket(url);
        ws.onopen = () => { reconnectDelay = 1000; };
        ws.onmessage = async (e: any) => {
          try {
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (msg?.type === 'sale:update') {
              setRealtimeConnected(true);
              stopPolling();
              const id = String(msg?.payload?.id || '');
              if (id) {
                try {
                  const r = await saleService.getById(id);
                  const v = r?.data;
                  const mesaId = Number(v?.mesaId || 0);
                  const aberta = String(v?.status || '').toLowerCase() === 'aberta';
                  console.log('[WS] sale:update recebido', { id, mesaId, aberta });
                  if (mesaId && Number.isFinite(mesaId)) {
                    setMesas((prev) => prev.map((m) => {
                      const mid = Number((m as any)?.id || 0);
                      if (mid === mesaId) {
                        return { ...m, status: aberta ? 'ocupada' : 'livre' } as any;
                      }
                      return m;
                    }));
                    try {
                      const itens = Array.isArray(v?.itens) ? v.itens : [];
                      const t = itens.reduce((acc: number, it: any) => acc + Number(it?.subtotal ?? (Number(it?.quantidade) * Number(it?.precoUnitario))), 0);
                      const p = (v?.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
                      setMesaOpenTotals((prev) => ({ ...prev, [String(mesaId)]: { total: t, pago: p } }));
                      console.log('[WS] total atualizado', { mesaId, total: t, pago: p });
                    } catch {}
                  } else {
                    await scheduleFetch();
                  }
                } catch {
                  await scheduleFetch();
                }
              } else {
                await scheduleFetch();
              }
            }
          } catch {}
        };
        ws.onerror = () => { try { ws.close(); } catch {}; };
        ws.onclose = () => {
          try { ws = null; } catch {}
          stopPolling();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectWebSocket, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
          startPolling();
          setRealtimeConnected(false);
        };
      } catch { startPolling(); }
    };

    const connectSseIfWeb = () => {
      try {
        const isWeb = typeof window !== 'undefined' && !!(window as any).EventSource;
        if (!isWeb) return;
        const base = (API_URL || '').replace(/\/$/, '');
        if (!base) return;
        const url = `${base}/sale/stream`;
        sse = new (window as any).EventSource(url);
        sse.onmessage = async (evt: any) => {
          try {
            const msg = JSON.parse(String(evt?.data || '{}'));
            if (msg?.type === 'sale:update') {
              console.log('[SSE] sale:update recebido');
              setRealtimeConnected(true);
              await scheduleFetch();
            } else if (msg && (msg.id || msg.ts)) {
              console.log('[SSE] payload simples recebido, agendando refresh');
              setRealtimeConnected(true);
              await scheduleFetch();
            }
          } catch {}
        };
        sse.onerror = () => { try { sse.close(); } catch {}; setRealtimeConnected(false); };
      } catch {}
    };

    connectWebSocket();
    connectSseIfWeb();

    return () => {
      try { ws && ws.close(); } catch {}
      try { sse && sse.close && sse.close(); } catch {}
      try { stopPolling(); } catch {}
      try { reconnectTimer && clearTimeout(reconnectTimer); } catch {}
    };
  }, []);

useEffect(() => {
  if (realtimeConnected) return;
  let since = Date.now();
  const t = setInterval(async () => {
    try {
      const res = await saleService.updates(since);
      if (res?.data?.updates?.length) {
        since = res?.data?.now || Date.now();
        await softRefreshMesas();
      }
    } catch {}
  }, 1500);
  return () => clearInterval(t);
}, [realtimeConnected]);

  // Estatísticas das mesas
  const stats = useMemo(() => {
    const total = mesas.length;
    const livres = mesas.filter(mesa => mesa.status === 'livre').length;
    const ocupadas = mesas.filter(mesa => mesa.status === 'ocupada').length;
    const reservadas = mesas.filter(mesa => mesa.status === 'reservada').length;
    const manutencao = mesas.filter(mesa => mesa.status === 'manutencao').length;
    
    return { total, livres, ocupadas, reservadas, manutencao };
  }, [mesas]);

  // Filtrar mesas
  const filteredMesas = useMemo(() => {
    return mesas.filter(mesa => {
      const matchesSearch = searchTerm === '' || 
        mesa.numero.toString().includes(searchTerm) ||
        (mesa.nomeResponsavel && mesa.nomeResponsavel.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = selectedStatus === null || mesa.status === selectedStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [mesas, searchTerm, selectedStatus]);

  // Funções para tooltips
  const showTooltip = (tooltipId: string) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipVisible(tooltipId);
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(null);
    }, 2000);
  };

  const hideTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setTooltipVisible(null);
  };

  // Função para abrir modal de criação de mesa individual
  const abrirModalCriarMesa = () => {
    setFormMesa({
      numero: '',
      nome: '',
      capacidade: '',
      tipo: 'interna',
      observacoes: ''
    });
    setCriarMesaModalVisible(true);
  };

  // Função para fechar modal de criação de mesa
  const fecharModalCriarMesa = () => {
    setCriarMesaModalVisible(false);
    setFormMesa({
      numero: '',
      nome: '',
      capacidade: '',
      tipo: 'interna',
      observacoes: ''
    });
  };

  // Função para criar mesa individual
  const criarMesaIndividual = async () => {
    if (!formMesa.numero.trim()) {
      Alert.alert('Erro', 'Por favor, informe o número da mesa');
      return;
    }

    if (!formMesa.nome.trim()) {
      Alert.alert('Erro', 'Por favor, informe o nome da mesa');
      return;
    }

    if (!formMesa.capacidade.trim() || isNaN(Number(formMesa.capacidade))) {
      Alert.alert('Erro', 'Por favor, informe uma capacidade válida');
      return;
    }

    setCriandoMesa(true);

    try {
      const mesaData = {
        numero: formMesa.numero.trim(),
        nome: formMesa.nome.trim(),
        capacidade: parseInt(formMesa.capacidade),
        tipo: formMesa.tipo,
        observacoes: formMesa.observacoes.trim(),
        status: 'livre'
      };

      await mesaService.create(mesaData);
      
      Alert.alert('Sucesso', 'Mesa criada com sucesso!');
      fecharModalCriarMesa();
      await loadMesas();
      
    } catch (error: any) {
      console.error('Erro ao criar mesa:', error);
      Alert.alert(
        'Erro', 
        error.response?.data?.message || 'Não foi possível criar a mesa'
      );
    } finally {
      setCriandoMesa(false);
    }
  };

  // Função para abrir modal de geração automática de mesas
  const gerarMesas = () => {
    setQuantidades({
      interna: 10,
      externa: 5,
      vip: 3,
      balcao: 2
    });
    setGerarMesasModalVisible(true);
  };

  // Função para criar mesas automaticamente
  const criarMesasAutomaticamente = async () => {
    const totalMesas = quantidades.interna + quantidades.externa + quantidades.vip + quantidades.balcao;
    
    if (totalMesas === 0) {
      Alert.alert('Erro', 'Por favor, defina pelo menos uma mesa para criar');
      return;
    }

    setGerandoMesas(true);

    try {
      const mesasParaCriar = [];
      let numeroAtual = 1;

      // Gerar mesas internas
      for (let i = 0; i < quantidades.interna; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa Interna ${numeroAtual - 1}`,
          capacidade: 4,
          tipo: 'interna',
          status: 'livre'
        });
      }

      // Gerar mesas externas
      for (let i = 0; i < quantidades.externa; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa Externa ${numeroAtual - 1}`,
          capacidade: 6,
          tipo: 'externa',
          status: 'livre'
        });
      }

      // Gerar mesas VIP
      for (let i = 0; i < quantidades.vip; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Mesa VIP ${numeroAtual - 1}`,
          capacidade: 8,
          tipo: 'vip',
          status: 'livre'
        });
      }

      // Gerar mesas de balcão
      for (let i = 0; i < quantidades.balcao; i++) {
        mesasParaCriar.push({
          numero: numeroAtual++,
          nome: `Balcão ${numeroAtual - 1}`,
          capacidade: 2,
          tipo: 'balcao',
          status: 'livre'
        });
      }

      // Criar todas as mesas
      for (const mesa of mesasParaCriar) {
        await mesaService.create(mesa);
      }

      Alert.alert('Sucesso', `${totalMesas} mesas criadas com sucesso!`);
      setGerarMesasModalVisible(false);
      await loadMesas();

    } catch (error: any) {
      console.error('Erro ao gerar mesas:', error);
      Alert.alert('Erro', 'Não foi possível gerar as mesas');
    } finally {
      setGerandoMesas(false);
    }
  };

  // Função para abrir mesa
  const abrirMesa = (mesa: Mesa) => {
    setMesaSelecionada(mesa);
    setFormAbrirMesa({
      nomeResponsavel: '',
      funcionarioResponsavel: '',
      observacoes: ''
    });
    setAbrirMesaModalVisible(true);
  };

  // Função para confirmar abertura da mesa
  const confirmarAbrirMesa = async () => {
    if (!formAbrirMesa.nomeResponsavel.trim()) {
      Alert.alert('Erro', 'Por favor, informe o nome do responsável');
      return;
    }

    if (!formAbrirMesa.funcionarioResponsavel) {
      Alert.alert('Erro', 'Por favor, selecione um funcionário responsável');
      return;
    }

    setAbindoMesa(true);

    try {
      if (!mesaSelecionada) {
        Alert.alert('Erro', 'Nenhuma mesa selecionada');
        return;
      }

      await mesaService.abrir(
        mesaSelecionada._id,
        formAbrirMesa.funcionarioResponsavel,
        formAbrirMesa.nomeResponsavel.trim(),
        formAbrirMesa.observacoes.trim()
      );
      
      Alert.alert('Sucesso', 'Mesa aberta com sucesso!');
      setAbrirMesaModalVisible(false);
      await loadMesas();

    } catch (error: any) {
      console.error('Erro ao abrir mesa:', error);
      Alert.alert('Erro', error.response?.data?.message || 'Não foi possível abrir a mesa');
    } finally {
      setAbindoMesa(false);
    }
  };

  // Função para fechar mesa
  const fecharMesa = async (mesa: Mesa) => {
    Alert.alert(
      'Confirmar',
      `Deseja realmente fechar a mesa ${mesa.numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Atualização otimista: marcar como livre imediatamente
              setMesas(prev => prev.map(m => m._id === mesa._id ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined } : m));

              await mesaService.fechar(mesa._id);
              Alert.alert('Sucesso', 'Mesa fechada e liberada!');
              await loadMesas();
              events.emit('caixa:refresh');
              events.emit('mesas:refresh');
            } catch (error: any) {
              console.error('Erro ao fechar mesa:', error);
              Alert.alert('Erro', error.response?.data?.message || 'Não foi possível fechar a mesa');
              // Em caso de erro, revalida estado
              await loadMesas();
            }
          }
        }
      ]
    );
  };



  // Funções para cancelamento com senha
  const iniciarCancelamentoMesa = (mesa: Mesa) => {
    setCancelMesaTarget(mesa);
    setCancelMesaModalVisible(true);
  };

  const handleConfirmCancelMesa = async () => {
    if (!cancelMesaTarget) return;

    // Recupera a vendaAtualId ou busca a venda da mesa
    // Se a mesa tem vendaAtual, usamos ela. Se não, tentamos buscar via saleService.getByMesa
    let saleId = cancelMesaTarget.vendaAtual?.id || cancelMesaTarget.vendaAtual?._id;

    // Se o ID não estiver direto no objeto mesa, tentamos buscar a venda ativa da mesa
    if (!saleId) {
      try {
        const resp = await saleService.getByMesa(cancelMesaTarget._id);
        const sales = resp.data || [];
        const active = sales.find((s: any) => s.status === 'aberta');
        if (active) saleId = active._id;
      } catch (e) {
        console.error('Erro ao buscar venda para cancelamento', e);
      }
    }

    if (!saleId) {
       Alert.alert('Aviso', 'Não foi encontrada venda ativa para cancelar nesta mesa. Apenas liberando a mesa.');
       // Se não tem venda, apenas libera a mesa? Ou não faz nada?
       // Como o usuário quer cancelar, vamos forçar liberarMesa se for só status visual
       liberarMesa(cancelMesaTarget);
       setCancelMesaModalVisible(false);
       setCancelMesaTarget(null);
       return;
    }

    try {
      setCancelMesaModalVisible(false);
      await saleService.cancel(saleId);
      Alert.alert('Sucesso', 'Mesa/Venda cancelada com sucesso!');
      await loadMesas();
      events.emit('caixa:refresh');
    } catch (error: any) {
      console.error('Erro ao cancelar mesa:', error);
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cancelar mesa.');
    } finally {
      setCancelMesaTarget(null);
    }
  };

  // Função para liberar mesa
  const liberarMesa = async (mesa: Mesa) => {
    console.log('🔓🔓🔓 FUNÇÃO LIBERAR MESA CHAMADA! 🔓🔓🔓');
    console.log('Mesa para liberar:', mesa);
    console.log('ID da mesa:', mesa._id);
    console.log('Status atual:', mesa.status);
    
    Alert.alert(
      'Confirmar',
      `Deseja liberar a mesa ${mesa.numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: async () => {
            console.log('🔄 Usuário confirmou liberação da mesa');
            try {
              // Atualização otimista: marcar como livre imediatamente
              setMesas(prev => prev.map(m => m._id === mesa._id ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined } : m));

              console.log('📡 Chamando mesaService.update...');
              const response = await mesaService.update(mesa._id, {
                status: 'livre',
                nomeResponsavel: undefined,
                funcionarioResponsavel: undefined,
                vendaAtual: undefined
              });
              console.log('✅ Mesa atualizada com sucesso:', response);
              
              Alert.alert('Sucesso', 'Mesa fechada com sucesso!');
              console.log('🔄 Recarregando lista de mesas...');
              await loadMesas();
              console.log('✅ Lista de mesas recarregada!');
              events.emit('caixa:refresh');
              events.emit('mesas:refresh');
            } catch (error: any) {
              console.error('❌ ERRO ao liberar mesa:', error);
              console.error('Detalhes do erro:', error.response?.data || error.message);
              Alert.alert('Erro', `Não foi possível liberar a mesa: ${error.response?.data?.message || error.message}`);
              // Em caso de erro, revalida estado
              await loadMesas();
            }
          }
        }
      ]
    );
  };

  // Função para adicionar produtos à mesa
  const adicionarProdutos = (mesa: Mesa) => {
    router.push({
      pathname: '/sale',
      params: { mesaId: mesa._id, mesaNumero: mesa.numero }
    });
  };

  // Função para ver comanda da mesa
  const verComanda = (mesa: Mesa) => {
    router.push({
      pathname: '/sale',
      params: { mesaId: mesa._id, mesaNumero: mesa.numero, viewOnly: 'true' }
    });
  };

  // Função para colocar mesa em manutenção
  const colocarEmManutencao = async (mesa: Mesa) => {
    Alert.alert(
      'Manutenção',
      `Colocar mesa ${mesa.numero} em manutenção?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await mesaService.update(mesa._id, { status: 'manutencao' });
              Alert.alert('Sucesso', 'Mesa colocada em manutenção');
              await loadMesas();
            } catch (error: any) {
              console.error('Erro ao colocar mesa em manutenção:', error);
              Alert.alert('Erro', 'Não foi possível colocar a mesa em manutenção');
            }
          }
        }
      ]
    );
  };

  // Abrir modal de pagamento para fechar mesa
  const fecharModalFecharMesa = async (mesa: Mesa) => {
    console.log('🔥🔥🔥 FUNÇÃO fecharModalFecharMesa INICIADA! 🔥🔥🔥');
    console.log('Mesa recebida:', mesa);
    try {
      console.log('🔄 Configurando estados iniciais...');
      setFecharMesaSelecionada(mesa);
      setFecharPaymentMethod('dinheiro');
      setFecharTotal(0);
      setFecharValorPago(0);
      setFecharSaleId(null);
      console.log('✅ Estados iniciais configurados!');

      const response = await saleService.getByMesa(mesa._id);
      const sales = response.data || [];
      const activeSale = sales.find((s: any) => s.status === 'aberta');

      if (!activeSale) {
        console.log('ℹ️ Nenhuma venda ativa. Permitindo fechamento direto da mesa.');
        setFecharTotal(0);
        setFecharSaleId(null);
        setFecharMesaModalVisible(true);
        return;
      }

      const itensCount = (activeSale.itens || []).length;
      if (itensCount === 0) {
        Alert.alert('Erro', 'Para fechar a mesa é necessário ter itens na venda.');
        return;
      }
      const total = (activeSale.itens || []).reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0);
      const totalPago = (activeSale.caixaVendas || []).reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0);
      setFecharTotal(total);
      setFecharValorPago(totalPago);
      setFecharSaleId(activeSale._id);
      setFecharMesaModalVisible(true);
    } catch (error: any) {
      console.error('Erro ao carregar venda da mesa:', error);
      Alert.alert('Erro', 'Não foi possível buscar a venda da mesa.');
    }
  };

  // Confirmar fechamento com pagamento
  const confirmarFechamentoMesa = async () => {
    console.log('🔄 CONFIRMAR BOTÃO CLICADO - Iniciando processo de fechamento');
    
    if (!fecharMesaSelecionada) {
      Alert.alert('Erro', 'Mesa não selecionada.');
      return;
    }

    try {
      setFinalizandoMesa(true);

      let venda: any = null;
      if (fecharSaleId) {
        try {
          const vendaResp = await saleService.getById(fecharSaleId);
          venda = vendaResp?.data;
        } catch (e) {
          console.error('Erro ao buscar venda:', e);
        }
      }

      const itens = Array.isArray(venda?.itens) ? venda.itens : [];
      const possuiItens = itens.length > 0;
      const vendaAberta = venda?.status === 'aberta';

      if (vendaAberta && possuiItens) {
        const data = { formaPagamento: fecharPaymentMethod };
        console.log('🌐 Finalizando venda via API...', fecharPaymentMethod);
        
        await saleService.finalize(fecharSaleId!, data);
        
        // Garantir liberação da mesa no backend (failsafe)
        try {
          await mesaService.fechar(fecharMesaSelecionada._id);
        } catch (error: any) {
          console.warn('⚠️ Aviso ao fechar mesa:', error?.message);
        }

        // 1. FECHAR MODAL IMEDIATAMENTE
        setFecharMesaModalVisible(false);

        // 2. LIMPAR FILTROS PARA GARANTIR VISIBILIDADE
        // Isso impede que a mesa "suma" se o usuário estiver filtrando por 'ocupada'
        setSelectedStatus(null); 
        setSearchTerm('');

        // 3. ATUALIZAÇÃO OTIMISTA (Visual imediato)
        setMesas(prev => prev.map(m => 
            (m._id === fecharMesaSelecionada._id || (m as any).id === fecharMesaSelecionada._id) 
            ? { ...m, status: 'livre', nomeResponsavel: undefined, funcionarioResponsavel: undefined, vendaAtual: undefined } 
            : m
        ));

        setFecharMesaSelecionada(null);
        setFecharSaleId(null);
        setFecharTotal(0);
        setFecharPaymentMethod('dinheiro');

        // 4. RECARREGAR DADOS (Sincronização com delay seguro)
        console.log('🔄 Recarregando lista de mesas silenciosamente...');
        setTimeout(() => {
           loadMesas(false); // Silent refresh
           events.emit('caixa:refresh');
           events.emit('mesas:refresh');
        }, 500);

        // 5. EXIBIR SUCESSO (Não bloqueante)
        if (Platform.OS === 'web') {
           setTimeout(() => window.alert('Sucesso: Venda finalizada e mesa liberada!'), 300);
        } else {
           Alert.alert('Sucesso', 'Venda finalizada e mesa liberada!');
        }

      } else {
        Alert.alert('Erro', 'Para fechar a mesa é necessário ter itens em uma venda aberta. Use "Liberar" para apenas liberar a mesa sem registro no caixa.');
        return;
      }
    } catch (error: any) {
      console.error('❌ ERRO ao fechar mesa:', error);
      let errorMessage = 'Falha ao fechar mesa';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      Alert.alert('Erro', errorMessage);
    } finally {
      setFinalizandoMesa(false);
    }
  };

  // Função para renderizar item da lista
  const renderItem = ({ item }: { item: Mesa }) => {
    console.log('🏠 RENDERIZANDO MESA:', item.numero, 'STATUS:', item.status);
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'livre': return '#4CAF50';
        case 'ocupada': return '#F44336';
        case 'reservada': return '#FF9800';
        case 'manutencao': return '#9E9E9E';
        default: return '#9E9E9E';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'livre': return 'checkmark-circle';
        case 'ocupada': return 'person';
        case 'reservada': return 'time';
        case 'manutencao': return 'construct';
        default: return 'help-circle';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'livre': return 'Livre';
        case 'ocupada': return 'Ocupada';
        case 'reservada': return 'Reservada';
        case 'manutencao': return 'Manutenção';
        default: return 'Desconhecido';
      }
    };

    return (
      <View style={[styles.mesaCard, { borderLeftColor: getStatusColor(item.status) }]}>
        <View style={styles.mesaHeader}>
          <Text style={styles.mesaNumero}>
            Mesa {item.numero}
            {(item.nomeResponsavel || item.funcionarioResponsavel?.nome) &&
              (() => {
                const id = String(item?._id ?? (item as any)?.id ?? '');
                const vt = item?.vendaAtual?.total;
                const mapData = id ? mesaOpenTotals[id] : undefined;
                const displayTotal = vt != null && Number(vt) > 0 ? Number(vt) : (mapData?.total || 0);
                const displayPaid = mapData?.pago || 0;
                
                const valorTotal = displayTotal.toFixed(2).replace('.', ',');
                
                // Construção da string de exibição no cabeçalho
                let text = ``;
                if (displayTotal > 0) {
                     text += ` - R$ ${valorTotal}`;
                }
                text += ` - Responsável: ${item.nomeResponsavel || item.funcionarioResponsavel?.nome}`;
                
                // Se houver valor pago parcial, mostrar detalhes visuais extras
                if (displayPaid > 0 && displayTotal > 0) {
                   // Opcional: injetar JSX aqui? Não, string pura.
                   // Vamos retornar apenas o nome/resp aqui e tratar os valores abaixo no JSX principal
                   // para ter flexibilidade de cor/estilo.
                   // Revertendo para comportamento original e adicionando bloco de valores abaixo
                   // mas como a estrutura espera string, vamos simplificar o header e adicionar bloco
                }
                return text;
              })()
            }
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <SafeIcon name={getStatusIcon(item.status)} size={12} color="#fff" fallbackText="•" />
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        {/* Exibição explícita de valores financeiros se houver totais */}
        {(() => {
             const id = String(item?._id ?? (item as any)?.id ?? '');
             const mapData = id ? mesaOpenTotals[id] : undefined;
             const total = mapData?.total || 0;
             const pago = mapData?.pago || 0;
             
             if (total > 0 && item.status === 'ocupada') {
                 return (
                     <View style={{ marginTop: 4, marginBottom: 8, paddingHorizontal: 4 }}>
                         <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2196F3' }}>
                           Total: R$ {total.toFixed(2).replace('.', ',')}
                         </Text>
                         {pago > 0 && (
                           <>
                             <Text style={{ fontSize: 13, color: '#4CAF50', marginTop: 2 }}>
                               Já pago: R$ {pago.toFixed(2).replace('.', ',')}
                             </Text>
                             <Text style={{ fontSize: 13, color: '#F44336', fontWeight: 'bold', marginTop: 2 }}>
                               Restante: R$ {Math.max(0, total - pago).toFixed(2).replace('.', ',')}
                             </Text>
                           </>
                         )}
                     </View>
                 );
             }
             return null;
        })()}

        <View style={styles.mesaInfo}>
          <View style={styles.infoRow}>
            <SafeIcon name="people" size={16} color="#666" fallbackText="👥" />
            <Text style={styles.infoText}>Capacidade: {item.capacidade} pessoas</Text>
          </View>
          

          
          {item.observacoes && (
            <View style={styles.infoRow}>
              <SafeIcon name="document-text" size={16} color="#666" fallbackText="📄" />
              <Text style={styles.infoText}>Obs: {item.observacoes}</Text>
            </View>
          )}
        </View>

        {item.status === 'manutencao' && (
          <View style={styles.maintenanceInfo}>
            <SafeIcon name="warning" size={16} color="#FF9800" fallbackText="!" />
            <Text style={styles.maintenanceText}>Mesa em manutenção</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <View style={styles.buttonRow}>
            {item.status === 'livre' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.openButton]}
                onPress={() => abrirMesa(item)}
              >
                <SafeIcon name="play" size={12} color="#fff" fallbackText="▶" />
                <Text style={styles.actionButtonText}>Abrir</Text>
              </TouchableOpacity>
            )}

            {item.status === 'ocupada' && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.addButton]}
                  onPress={() => adicionarProdutos(item)}
                >
                  <SafeIcon name="add" size={12} color="#fff" fallbackText="+" />
                  <Text style={styles.actionButtonText}>Adicionar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={() => {
                    try {
                      fecharModalFecharMesa(item);
                    } catch (error) {}
                  }}
                >
                  <SafeIcon name="close-circle" size={12} color="#fff" fallbackText="×" />
                  <Text style={styles.actionButtonText}>Fechar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                  onPress={() => iniciarCancelamentoMesa(item)}
                >
                  <SafeIcon name="trash" size={12} color="#fff" fallbackText="🗑" />
                  <Text style={styles.actionButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}

            {item.status === 'reservada' && (
              <TouchableOpacity
                  style={[styles.actionButton, styles.releaseButton]}
                  onPress={() => liberarMesa(item)}
                >
                  <SafeIcon name="lock-open" size={12} color="#fff" fallbackText="🔓" />
                  <Text style={styles.actionButtonText}>Liberar</Text>
                </TouchableOpacity>
            )}

            
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ marginTop: 16, color: '#666' }}>Carregando mesas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Mesas" />
      {/* Header com estatísticas */}
      <View style={styles.statsContainer}>
        <View style={styles.statsLeft}>
          <TouchableOpacity
            style={[styles.statItem, selectedStatus === null && styles.statItemSelected]}
            onPress={() => setSelectedStatus(null)}
          >
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#2196F3' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'livre' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'livre' ? null : 'livre')}
          >
            <Text style={styles.statNumber}>{stats.livres}</Text>
            <Text style={styles.statLabel}>Livres</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#4CAF50' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'ocupada' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'ocupada' ? null : 'ocupada')}
          >
            <Text style={styles.statNumber}>{stats.ocupadas}</Text>
            <Text style={styles.statLabel}>Ocupadas</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#F44336' }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statItem, selectedStatus === 'reservada' && styles.statItemSelected]}
            onPress={() => setSelectedStatus(selectedStatus === 'reservada' ? null : 'reservada')}
          >
            <Text style={styles.statNumber}>{stats.reservadas}</Text>
            <Text style={styles.statLabel}>Reservadas</Text>
            <View style={[styles.statIndicator, { backgroundColor: '#FF9800' }]} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerButtons}>
          <View style={styles.tooltipContainer}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={abrirModalCriarMesa}
              onPressIn={() => showTooltip('criar')}
              onPressOut={hideTooltip}
            >
              <SafeIcon name="add" size={16} color="#fff" fallbackText="+" />
            </TouchableOpacity>
            {tooltipVisible === 'criar' && (
              <View style={[styles.tooltip, styles.tooltipVisible]}>
                <Text style={styles.tooltipText}>Criar mesa individual</Text>
              </View>
            )}
          </View>

          <View style={styles.tooltipContainer}>
            <TouchableOpacity
              style={[styles.headerButton, styles.headerButtonSecondary]}
              onPress={gerarMesas}
              onPressIn={() => showTooltip('gerar')}
              onPressOut={hideTooltip}
            >
              <SafeIcon name="add" size={20} color="#fff" fallbackText="+" />
            </TouchableOpacity>
            {tooltipVisible === 'gerar' && (
              <View style={[styles.tooltip, styles.tooltipVisible]}>
                <Text style={styles.tooltipText}>Gerar várias mesas</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Barra de pesquisa e filtros */}
      <SearchAndFilter
        searchText={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Pesquisar por número da mesa ou responsável..."
        filters={statusFilters}
        selectedFilter={selectedStatus || 'todas'}
        onFilterChange={handleFilterChange}
        showFilters={true}
      />

      {/* Lista de mesas */}
      <FlatList
        data={filteredMesas}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <SafeIcon name="restaurant" size={64} color="#ccc" fallbackText="🍽" />
            <Text style={{ color: '#666', marginTop: 16 }}>
              {searchTerm || selectedStatus ? 'Nenhuma mesa encontrada' : 'Nenhuma mesa cadastrada'}
            </Text>
          </View>
        }
      />

      {/* Modal para gerar mesas */}
      <Modal
        visible={gerarMesasModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setGerarMesasModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gerar Mesas Automaticamente</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setGerarMesasModalVisible(false)}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                Defina a quantidade de mesas para cada tipo que deseja criar automaticamente:
              </Text>

              <View style={styles.quantidadeContainer}>
                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas Internas</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, interna: Math.max(0, prev.interna - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.interna.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, interna: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, interna: prev.interna + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas Externas</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, externa: Math.max(0, prev.externa - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.externa.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, externa: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, externa: prev.externa + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas VIP</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, vip: Math.max(0, prev.vip - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.vip.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, vip: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, vip: prev.vip + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.quantidadeItem}>
                  <Text style={styles.quantidadeLabel}>Mesas de Balcão</Text>
                  <View style={styles.quantidadeControls}>
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, balcao: Math.max(0, prev.balcao - 1) }))}
                    >
                      <SafeIcon name="remove" size={16} color="#666" fallbackText="-" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantidadeInput}
                      value={quantidades.balcao.toString()}
                      onChangeText={(text) => setQuantidades(prev => ({ ...prev, balcao: parseInt(text) || 0 }))}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.quantidadeButton}
                      onPress={() => setQuantidades(prev => ({ ...prev, balcao: prev.balcao + 1 }))}
                    >
                      <SafeIcon name="add" size={16} color="#666" fallbackText="+" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>
                  Total: {quantidades.interna + quantidades.externa + quantidades.vip + quantidades.balcao} mesas
                </Text>
              </View>

              <Text style={styles.warningText}>
                As mesas serão numeradas automaticamente a partir do número 1
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setGerarMesasModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={criarMesasAutomaticamente}
                disabled={gerandoMesas}
              >
                {gerandoMesas ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Gerar Mesas</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para criar mesa individual */}
      <Modal
        visible={criarMesaModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={fecharModalCriarMesa}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Nova Mesa</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={fecharModalCriarMesa}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Número da Mesa <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.numero}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, numero: text }))}
                  placeholder="Ex: 1, 2, 3..."
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Nome da Mesa <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.nome}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, nome: text }))}
                  placeholder="Ex: Mesa Principal, Mesa da Varanda..."
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Capacidade <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formMesa.capacidade}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, capacidade: text }))}
                  placeholder="Número de pessoas"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo da Mesa</Text>
                <View style={styles.tipoSelector}>
                  {['interna', 'externa', 'vip', 'balcao'].map((tipo) => (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.tipoOption,
                        formMesa.tipo === tipo && styles.tipoOptionSelected
                      ]}
                      onPress={() => setFormMesa(prev => ({ ...prev, tipo }))}
                    >
                      <Text style={[
                        styles.tipoOptionText,
                        formMesa.tipo === tipo && styles.tipoOptionTextSelected
                      ]}>
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Observações</Text>
                <TextInput
                  style={[styles.formInput, styles.textAreaSmall]}
                  value={formMesa.observacoes}
                  onChangeText={(text) => setFormMesa(prev => ({ ...prev, observacoes: text }))}
                  placeholder="Observações sobre a mesa..."
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={fecharModalCriarMesa}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={criarMesaIndividual}
                disabled={criandoMesa}
              >
                {criandoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Criar Mesa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para abrir mesa */}
      <Modal
        visible={abrirMesaModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAbrirMesaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Abrir Mesa {mesaSelecionada?.numero}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setAbrirMesaModalVisible(false)}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Nome do Responsável <Text style={styles.requiredField}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formAbrirMesa.nomeResponsavel}
                  onChangeText={(text) => setFormAbrirMesa(prev => ({ ...prev, nomeResponsavel: text }))}
                  placeholder="Nome do cliente responsável"
                />
              </View>

              <View style={styles.dropdownFormGroup}>
                <Text style={styles.formLabel}>
                  Funcionário Responsável <Text style={styles.requiredField}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setFuncionarioDropdownVisible(!funcionarioDropdownVisible)}
                >
                  <Text style={[
                    styles.dropdownButtonText,
                    !formAbrirMesa.funcionarioResponsavel && styles.dropdownPlaceholder
                  ]}>
                    {formAbrirMesa.funcionarioResponsavel
                      ? funcionarios.find((f: Funcionario) => f._id === formAbrirMesa.funcionarioResponsavel)?.nome
                      : 'Selecione um funcionário'
                    }
                  </Text>
                  <SafeIcon
                    name={funcionarioDropdownVisible ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#666"
                    fallbackText={funcionarioDropdownVisible ? "↑" : "↓"}
                  />
                </TouchableOpacity>

                {funcionarioDropdownVisible && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={styles.dropdownScrollView}>
                      <TouchableOpacity
                        style={[
                          styles.dropdownItem,
                          !formAbrirMesa.funcionarioResponsavel && styles.dropdownItemSelected
                        ]}
                        onPress={() => {
                          setFormAbrirMesa(prev => ({ ...prev, funcionarioResponsavel: '' }));
                          setFuncionarioDropdownVisible(false);
                        }}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          !formAbrirMesa.funcionarioResponsavel && styles.dropdownItemTextSelected
                        ]}>
                          Nenhum funcionário
                        </Text>
                        {!formAbrirMesa.funcionarioResponsavel && (
                          <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                        )}
                      </TouchableOpacity>
                      {funcionarios.map((funcionario: Funcionario) => (
                        <TouchableOpacity
                          key={funcionario._id}
                          style={[
                            styles.dropdownItem,
                            formAbrirMesa.funcionarioResponsavel === funcionario._id && styles.dropdownItemSelected
                          ]}
                          onPress={() => {
                            if (!funcionario.ativo) {
                              Alert.alert('Aviso', 'Funcionário inativo não pode ser selecionado.');
                              return;
                            }
                            setFormAbrirMesa(prev => ({ ...prev, funcionarioResponsavel: funcionario._id }));
                            setFuncionarioDropdownVisible(false);
                          }}
                        >
                          <Text style={[
                            styles.dropdownItemText,
                            formAbrirMesa.funcionarioResponsavel === funcionario._id && styles.dropdownItemTextSelected,
                            !funcionario.ativo && { color: '#999' }
                          ]}>
                            {funcionario.nome}{!funcionario.ativo ? ' (Inativo)' : ''}
                          </Text>
                          {formAbrirMesa.funcionarioResponsavel === funcionario._id && (
                            <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Observações</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={formAbrirMesa.observacoes}
                  onChangeText={(text) => setFormAbrirMesa(prev => ({ ...prev, observacoes: text }))}
                  placeholder="Observações sobre a abertura da mesa..."
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAbrirMesaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmarAbrirMesa}
                disabled={abindoMesa}
              >
                {abindoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Abrir Mesa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de pagamento para fechar mesa */}
      <Modal
        visible={fecharMesaModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFecharMesaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🍽️ Finalizar Mesa {fecharMesaSelecionada?.numero}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setFecharMesaModalVisible(false)}
              >
                <SafeIcon name="close" size={24} color="#666" fallbackText="×" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>💰 Total da Mesa: R$ {fecharTotal.toFixed(2)}</Text>
              {fecharValorPago > 0 && (
                <>
                  <Text style={[styles.modalDescription, { color: '#4CAF50', fontSize: 16 }]}>
                    Já pago: R$ {fecharValorPago.toFixed(2)}
                  </Text>
                  <Text style={[styles.modalDescription, { color: '#F44336', fontSize: 18, fontWeight: 'bold' }]}>
                    Restante: R$ {Math.max(0, fecharTotal - fecharValorPago).toFixed(2)}
                  </Text>
                </>
              )}
              <Text style={styles.modalSubDescription}>Selecione a forma de pagamento para finalizar a mesa:</Text>
              <View style={styles.mesaTypesList}>
                {[
                  { key: 'dinheiro', label: 'Dinheiro' },
                  { key: 'cartao', label: 'Cartão' },
                  { key: 'pix', label: 'PIX' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.dropdownItem,
                      fecharPaymentMethod === method.key && styles.dropdownItemSelected,
                    ]}
                    onPress={() => setFecharPaymentMethod(method.key as any)}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        fecharPaymentMethod === method.key && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {method.label}
                    </Text>
                    {fecharPaymentMethod === method.key && (
                      <SafeIcon name="checkmark" size={16} color="#2196F3" fallbackText="✓" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFecharMesaModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  finalizandoMesa && { opacity: 0.6 }
                ]}
                onPress={confirmarFechamentoMesa}
                disabled={finalizandoMesa}
              >
                {finalizandoMesa ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PasswordConfirmModal
        visible={cancelMesaModalVisible}
        title="Cancelar Mesa/Venda"
        message={`Tem certeza que deseja cancelar a mesa ${cancelMesaTarget?.numero}? Esta ação não pode ser desfeita e estornará a venda integralmente.`}
        onConfirm={handleConfirmCancelMesa}
        onCancel={() => {
          setCancelMesaModalVisible(false);
          setCancelMesaTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statsLeft: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  tooltipContainer: {
    position: 'relative',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  headerButtonSecondary: {
    backgroundColor: '#4CAF50',
  },
  tooltip: {
    position: 'absolute',
    top: 50,
    left: '50%',
    transform: [{ translateX: -60 }],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    opacity: 0,
    zIndex: 1000,
    minWidth: 120,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tooltipVisible: {
    opacity: 1,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  statItem: {
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  mesaCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mesaNumero: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mesaInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionButtons: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  openButton: {
    backgroundColor: '#4CAF50',
  },
  addButton: {
    backgroundColor: '#2196F3',
  },
  viewButton: {
    backgroundColor: '#FF9800',
  },
  closeButton: {
     backgroundColor: '#9C27B0',
   },
   releaseButton: {
     backgroundColor: '#9C27B0',
   },
   cashButton: {
     backgroundColor: '#009688',
   },
   maintenanceInfo: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingVertical: 8,
   },
  maintenanceText: {
    color: '#FF9800',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  modalDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
    fontWeight: '600',
  },
  modalSubDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  mesaTypesList: {
    gap: 12,
    marginBottom: 16,
  },
  mesaTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  mesaTypeText: {
    fontSize: 14,
    color: '#333',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 1,
  },
  dropdownFormGroup: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  requiredField: {
    color: '#d32f2f',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaSmall: {
    height: 60,
    textAlignVertical: 'top',
  },
  tipoSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipoOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  tipoOptionSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  tipoOptionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tipoOptionTextSelected: {
    color: '#fff',
  },
  quantidadeContainer: {
    gap: 16,
    marginBottom: 16,
  },
  quantidadeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quantidadeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  quantidadeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantidadeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantidadeInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  totalContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  dropdownScrollView: {
    maxHeight: 200,
    flexGrow: 0,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
});
