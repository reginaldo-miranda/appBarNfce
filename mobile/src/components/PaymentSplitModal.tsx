import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  useWindowDimensions,
  Switch
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Sale, CartItem, PaymentMethod } from '../types/index';
import { caixaService, saleService } from '../services/api';
import { events } from '../utils/eventBus';
import PixModal from './PixModal';

interface PaymentSplitModalProps {
  visible: boolean;
  sale: Sale | null;
  onClose: () => void;
  onClose: () => void;
  onPaymentSuccess: (isFullPayment?: boolean, wantNfce?: boolean) => void;
}


interface ItemBalance {
  itemId: string;
  name: string;
  total: number;
  paid: number;
  remaining: number;
  fullyPaid: boolean;
}

export default function PaymentSplitModal({
  visible,
  sale,
  onClose,
  onPaymentSuccess
}: PaymentSplitModalProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768 || Platform.OS === 'web';

  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');
  const [emitirNfce, setEmitirNfce] = useState(true);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixAmount, setPixAmount] = useState(0);


  // Efeito para fechar o modal se a venda for finalizada remotamente
  useEffect(() => {
    if (visible && sale && (sale as any).status === 'finalizada') {
      Alert.alert('Aviso', 'Esta venda foi finalizada.');
      onClose();
    }
  }, [sale, visible]);

  // Polling de segurança para garantir atualização da venda no Desktop/Tablet
  useEffect(() => {
    if (!visible || !isTablet || !sale) return;

    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const saleId = (sale as any).id || sale._id;
        if (!saleId) return;
        
        // Chamada direta para obter estado mais recente
        const response = await saleService.getById(saleId);
        const updatedSale = response.data;
        
        // Comparar se houve mudança relevante (pagamentos ou status)
        const currentPaid = (sale as any)?.caixaVendas?.length || 0;
        const newPaid = (updatedSale as any)?.caixaVendas?.length || 0;
        
        const currentStatus = sale.status;
        const newStatus = updatedSale.status;
        
        if (newPaid !== currentPaid || newStatus !== currentStatus) {
           console.log('🔄 Polling: Mudança detectada na venda. Forçando refresh.');
           // Emitir evento que o SaleScreen escuta (ou deveria escutar)
           // Assumindo que SaleScreen tem listener para 'sale:update' via WS, podemos simular um via EventBus
           // Mas o SaleScreen atual usa WS direto. Vamos usar o reload manual se tivermos acesso a função de reload... não temos.
           // Melhor: emitir evento na eventBus e garantir que SaleScreen ouça a eventBus também.
           
           events.emit('sale:polling-update', updatedSale);
        }
      } catch {}
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [visible, isTablet, sale]);

  const paymentMethods: PaymentMethod[] = [
    { key: 'dinheiro', label: 'Dinheiro', icon: 'cash' },
    { key: 'cartao', label: 'Cartão', icon: 'card' },
    { key: 'pix', label: 'PIX', icon: 'phone-portrait' },
  ];

  // Total da venda
  const totalSale = useMemo(() => {
    const t = Number(sale?.total || 0);
    if (t > 0) return t;
    if (sale?.itens) {
      return sale.itens.reduce((acc, item) => acc + Number(item.subtotal), 0);
    }
    return 0;
  }, [sale]);

  // Cálculo robusto do Total Pago
  const totalPaidGlobal = useMemo(() => {
    if (!sale) return 0;

    // 1. Total pelos registros financeiros (CaixaVenda)
    const financialTotal = (sale as any)?.caixaVendas 
      ? (sale as any).caixaVendas.reduce((acc: number, cv: any) => acc + (Number(cv.valor) || 0), 0)
      : 0;

    // 2. Total pelo status físico dos itens
    // Item marcado como 'pago' conta como totalmente pago, independente de haver registro no caixa
    let itemsPaidTotal = 0;
    
    // Mapeia pagamentos parciais para evitar contagem duplicada ou incorreta
    const paidMap = new Map<string, number>();
    if (sale.caixaVendas && Array.isArray(sale.caixaVendas)) {
      sale.caixaVendas.forEach((cv: any) => {
        let pagos: any[] = [];
        if (Array.isArray(cv.itensPagos)) pagos = cv.itensPagos;
        else if (typeof cv.itensPagos === 'string') { try { pagos = JSON.parse(cv.itensPagos); } catch{} }
        
        pagos.forEach((p: any) => {
          const pid = String(p.id);
          const val = Number(p.paidAmount) || 0;
          paidMap.set(pid, (paidMap.get(pid) || 0) + val);
        });
      });
    }

    if (sale.itens) {
      sale.itens.forEach((item: CartItem) => {
         const itemId = String(item._id || (item as any).id);
         const subtotal = Number(item.subtotal);
         const isStatusPaid = (item as any).status === 'pago';
         
         if (isStatusPaid) {
           // Se está pago no status, consideramos o subtotal cheio
           itemsPaidTotal += subtotal;
         } else {
           // Se não está pago, conta apenas o parcial registrado
           itemsPaidTotal += (paidMap.get(itemId) || 0);
         }
      });
    }

    // Retorna o maior valor para garantir que se o item está 'pago', o valor reflete isso
    // Mesmo que o registro financeiro tenha se perdido ou não exista.
    // Mas também respeita pagamentos genéricos se financialTotal for maior.
    return Math.max(financialTotal, itemsPaidTotal);

  }, [sale]);

  // Garante que não fica negativo por arredondamento
  const totalRemainingGlobal = Math.max(0, totalSale - totalPaidGlobal);

  const itemBalances = useMemo(() => {
    if (!sale || !sale.itens) return [];

    // Mapa de quanto já foi pago por item (somando parciais explícitos)
    const paidMap = new Map<string, number>();

    // Iterar sobre pagamentos registrados no CaixaVenda
    if (sale.caixaVendas && Array.isArray(sale.caixaVendas)) {
      sale.caixaVendas.forEach((cv: any) => {
        let pagos: any[] = [];
        if (Array.isArray(cv.itensPagos)) {
          pagos = cv.itensPagos;
        } else if (typeof cv.itensPagos === 'string') {
          try {
             const parsed = JSON.parse(cv.itensPagos);
             if (Array.isArray(parsed)) pagos = parsed;
          } catch {}
        }
        pagos.forEach((p: any) => {
          const pid = String(p.id);
          const current = paidMap.get(pid) || 0;
          paidMap.set(pid, current + (Number(p.paidAmount) || 0));
        });
      });
    }

    // Calcula o total que AINDA FALTA pagar somando todos os itens
    // Para detectar se há discrepância (itens dizem que falta X, mas comanda diz que falta Y < X)
    let sumItemRemaining = 0;
    
    const itemsRaw = sale.itens.map((item: CartItem) => {
      const itemId = String(item._id || (item as any).id);
      const isStatusPaid = (item as any).status === 'pago';
      const partialPaid = paidMap.get(itemId) || 0;
      const total = Number(item.subtotal);
      
      const paid = isStatusPaid ? total : Math.min(partialPaid, total);
      const remaining = Math.max(0, total - paid);
      
      sumItemRemaining += remaining;
      
      return {
        itemId,
        name: item.nomeProduto,
        total,
        paid,
        remaining,
        fullyPaid: isStatusPaid || remaining < 0.05
      };
    });

    // CORREÇÃO CRÍTICA:
    // Se a soma do restante dos itens (sumItemRemaining) for MAIOR que o restante global da venda (totalRemainingGlobal),
    // significa que houve pagamentos genéricos (não vinculados a itens) amortizando a dívida.
    // Nesse caso, o usuário vê itens "em aberto" que, na verdade, já estão pagos financeiramente.
    // Vamos distribuir esse "crédito genérico" para abater visualmente os itens restantes,
    // começando pelos primeiros da lista, para evitar o bloqueio de "Valores > Falta".
    
    if (sumItemRemaining > totalRemainingGlobal + 0.05) {
      let excessPayment = sumItemRemaining - totalRemainingGlobal;
      
      // Itera novamente aplicando o desconto do excesso
      return itemsRaw.map(i => {
         if (i.fullyPaid) return i;
         if (excessPayment <= 0.01) return i;

         // Abate do item atual
         const discount = Math.min(i.remaining, excessPayment);
         const newPaid = i.paid + discount;
         const newRemaining = i.remaining - discount;
         
         excessPayment -= discount;

         return {
           ...i,
           paid: newPaid,
           remaining: newRemaining,
           fullyPaid: newRemaining < 0.05 // Marca como pago se zerou
         };
      });
    }

    return itemsRaw;
  }, [sale, totalRemainingGlobal]); // Depende do totalRemainingGlobal agora
  


  const totalSelected = Array.from(selectedItems.values()).reduce((acc, val) => acc + val, 0);

  // Valores simulados para exibição em tempo real
  // Fix: Clamping para não exibir valor pago maior que o total (incoerência visual)
  const currentPaidDisplay = Math.min(totalSale, totalPaidGlobal + totalSelected);
  const currentRemainingDisplay = Math.max(0, totalRemainingGlobal - totalSelected);

  useEffect(() => {
    if (visible) {
      setSelectedItems(new Map());
      setPaymentMethod('dinheiro');
    }
  }, [visible]);

  const toggleItem = (balance: ItemBalance) => {
    if (balance.fullyPaid) return; // Não permite selecionar se já pago

    // Optimistic Update: Atualiza estado imediatamente
    const currentMap = new Map(selectedItems);
    if (currentMap.has(balance.itemId)) {
      currentMap.delete(balance.itemId);
    } else {
      currentMap.set(balance.itemId, balance.remaining);
    }
    setSelectedItems(currentMap);
  };

  const updateAmount = (itemId: string, text: string) => {
    const balance = itemBalances.find(i => i.itemId === itemId);
    if (!balance) return;

    // Normalizar entrada (vírgula para ponto)
    let val = parseFloat(text.replace(',', '.'));
    if (isNaN(val)) val = 0;
    
    // Validar máximo (não pagar mais que o restante)
    if (val > balance.remaining) val = balance.remaining;
    if (val < 0) val = 0;

    const newMap = new Map(selectedItems);
    newMap.set(itemId, val); 
    setSelectedItems(newMap);
  };

  // Função central desvinculada do botão para permitir reuso (ex: pós-PIX)
  const submitPayment = async () => {
    try {
      setLoading(true);

      const saleId = (sale as any).id || sale._id; // Fallback seguro
      if (!saleId) throw new Error("ID da venda não encontrado");

      // 2. Registrar metadados de pagamento na Venda
      const itemsPayload = Array.from(selectedItems.entries()).map(([id, amount]) => {
        const balance = itemBalances.find(i => i.itemId === id);
        // Verifica se pagou tudo que faltava (com tolerância)
        const finished = balance ? (Math.abs(balance.remaining - amount) < 0.05) : false;
        return {
          id,
          paidAmount: amount,
          fullyPaid: finished
        };
      });

      await saleService.payItems(saleId, {
        paymentInfo: {
          method: paymentMethod,
          totalAmount: totalSelected
        },
        items: itemsPayload
      });

      // Verificar se o pagamento quita a dívida total (com tolerância)
      const isFullPayment = (totalRemainingGlobal - totalSelected) <= 0.05;

      console.log('✅ Pagamento Confirmado. Full?', isFullPayment);

      // Limpar seleção
      setSelectedItems(new Map());

      // Notificar sucesso (callback crítico para fechar modais)
      onPaymentSuccess(isFullPayment, emitirNfce);

      // Feedback visual
      if (!isFullPayment) {
          if (Platform.OS === 'web') {
            setTimeout(() => window.alert('Pagamento registrado!'), 100);
          } else {
            Alert.alert('Sucesso', 'Pagamento registrado!');
          }
      }

    } catch (error: any) {
      console.error('Erro ao processar pagamento split:', error);
      Alert.alert('Erro', error?.response?.data?.error || 'Falha ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!sale) return;
    
    // Se já está tudo pago, o botão serve para fechar/finalizar
    const isEverythingPaid = totalRemainingGlobal <= 0.05;

    if (totalSelected <= 0.01 && !isEverythingPaid) {
      Alert.alert('Atenção', 'Selecione e informe valores para os itens que deseja pagar.');
      return;
    }

    // Se tudo pago e nada selecionado, apenas confirma o sucesso para fechar
    if (isEverythingPaid && totalSelected <= 0.01) {
        onPaymentSuccess(true, emitirNfce);
        return;
    }

    // Intercept PIX payment
    if (paymentMethod === 'pix' && totalSelected > 0.05) {
        setPixAmount(totalSelected);
        setPixModalVisible(true);
        return; 
    }

    await submitPayment();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, !isTablet && styles.containerMobile]}>
          <View style={styles.header}>
            <Text style={styles.title}>Divisão de Pagamento</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
            {/* Lista de Itens */}
            <View style={{ 
              flex: isTablet ? 0.65 : 1, 
              borderRightWidth: isTablet ? 1 : 0, 
              borderBottomWidth: isTablet ? 0 : 1,
              borderColor: '#eee', 
              display: 'flex', 
              flexDirection: 'column' 
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingRight: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' }}>
                    <Text style={styles.sectionTitle}>Selecione os itens a pagar:</Text>
                    <TouchableOpacity onPress={() => {
                      const all = new Map();
                      itemBalances.forEach(i => {
                        if (!i.fullyPaid) all.set(i.itemId, i.remaining);
                      });
                      setSelectedItems(all);
                    }}>
                      <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>Selecionar Tudo</Text>
                    </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.list}>
                    {itemBalances.map((item) => {
                      const isSelected = selectedItems.has(item.itemId);
                      const amount = selectedItems.get(item.itemId);
                      
                      if (item.fullyPaid) {
                        return (
                         <View key={item.itemId} style={[styles.itemRow, styles.itemPaid]}>
                           <Ionicons name="checkmark-circle" size={22} color="#4CAF50" style={{ marginRight: 8 }} />
                           <View style={{ flex: 1 }}>
                             {/* Removido line-through para melhorar legibilidade conforme solicitado */}
                             <Text style={[styles.itemName, { color: '#555' }]}>{item.name}</Text>
                             <Text style={{ fontSize: 12, color: '#4CAF50' }}>Item totalmente quitado</Text>
                           </View>
                           <View style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#E8F5E9', borderRadius: 4 }}>
                              <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 12 }}>PAGO</Text>
                           </View>
                         </View>
                        );
                      }

                      return (
                        <View key={item.itemId} style={[styles.itemRow, isSelected && styles.itemSelected]}>
                          <TouchableOpacity 
                            style={styles.checkArea}
                            onPress={() => toggleItem(item)}
                          >
                            <Ionicons 
                              name={isSelected ? "checkbox" : "square-outline"} 
                              size={24} 
                              color={isSelected ? "#2196F3" : "#aaa"} 
                            />
                          </TouchableOpacity>
                          
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemSub}>
                              Total: R$ {item.total.toFixed(2)} | Falta: R$ {item.remaining.toFixed(2)}
                            </Text>
                          </View>

                          {isSelected ? (
                            <View style={styles.inputContainer}>
                              <Text style={styles.currencySymbol}>R$</Text>
                              <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={amount !== undefined ? amount.toString() : ''}
                                onChangeText={(t) => updateAmount(item.itemId, t)}
                                selectTextOnFocus
                              />
                            </View>
                          ) : (
                            <Text style={styles.itemPrice}>R$ {item.remaining.toFixed(2)}</Text>
                          )}
                        </View>
                      );
                    })}
                </ScrollView>
            </View>

            {/* Resumo e Histórico */}
            <View style={{ 
              flex: isTablet ? 0.35 : 0, 
              minHeight: isTablet ? 0 : 180, // Garante altura mínima no mobile
              maxHeight: isTablet ? '100%' : '40%', // Limita altura no mobile
              backgroundColor: '#f8f9fa' 
            }}>
                <View style={styles.summaryBox}>
                    <View style={styles.rowBetween}>
                       <Text style={styles.label}>Total da Venda:</Text>
                       <Text style={styles.value}>R$ {totalSale.toFixed(2)}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                       <Text style={styles.label}>Já Pago:</Text>
                       <Text style={[styles.value, { color: '#4CAF50' }]}>R$ {currentPaidDisplay.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.rowBetween, { marginTop: 8, borderTopWidth: 1, borderColor: '#eee', paddingTop: 8 }]}>
                       <Text style={[styles.label, { fontWeight: 'bold' }]}>Restante Atual:</Text>
                       <Text style={[styles.value, { color: '#F44336', fontWeight: 'bold', fontSize: 18 }]}>R$ {currentRemainingDisplay.toFixed(2)}</Text>
                    </View>
                    
                    {/* Histórico de Pagamentos */}
                    {(sale as any)?.caixaVendas && (sale as any).caixaVendas.length > 0 && (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: '#e0e0e0', flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color:('#555'), marginBottom: 8 }}>Histórico recente:</Text>
                        <ScrollView style={{ flex: 1, maxHeight: 100 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          {(sale as any).caixaVendas.map((cv: any, idx: number) => (
                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, paddingVertical: 4, paddingHorizontal: 4, backgroundColor: '#fff', borderRadius: 4 }}>
                               <Text style={{ fontSize: 12, color: '#444' }}>
                                 {new Date(cv.dataVenda).toLocaleTimeString().substring(0,5)} - {cv.formaPagamento.toUpperCase()}
                               </Text>
                               <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: 'bold' }}>
                                 R$ {Number(cv.valor).toFixed(2)}
                               </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                </View>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.paymentMethods}>
              {paymentMethods.map(method => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.methodButton,
                    paymentMethod === method.key && styles.methodButtonSelected
                  ]}
                  onPress={() => setPaymentMethod(method.key)}
                >
                  <Ionicons 
                    name={method.icon} 
                    size={20} 
                    color={paymentMethod === method.key ? '#fff' : '#666'} 
                  />
                  <Text style={[
                      styles.methodText, 
                      paymentMethod === method.key && styles.methodTextSelected
                  ]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, backgroundColor: '#f0f8ff', padding: 10, borderRadius: 8 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                 <Ionicons name="receipt-outline" size={24} color="#2196F3" />
                 <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>Emitir NFC-e (Cupom Fiscal)</Text>
               </View>
               <Switch
                 value={emitirNfce}
                 onValueChange={setEmitirNfce}
                 trackColor={{ false: "#ccc", true: "#2196F3" }}
                 thumbColor={"#fff"}
               />
            </View>


            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>Total Selecionado:</Text>
              <Text style={styles.totalValue}>R$ {totalSelected.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmButton, 
                ((totalSelected <= 0.01 && totalRemainingGlobal > 0.05) || loading) && styles.confirmButtonDisabled
              ]}
              onPress={handleConfirm}
              disabled={((totalSelected <= 0.01 && totalRemainingGlobal > 0.05) || loading)}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                   {totalRemainingGlobal <= 0.05 ? 'Finalizar Venda' : 'Confirmar Pagamento'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <PixModal 
          visible={pixModalVisible}
          amount={pixAmount}
          transactionId={sale && ((sale as any).id || sale._id) ? `PEDIDO-${(sale as any).id || sale._id}` : undefined}
          onClose={() => setPixModalVisible(false)}
          onConfirm={() => {
              setPixModalVisible(false);
              // Proceder com a confirmação normal
              // O pagamento já foi feito "visualmente" no modal (QR Code), agora registramos no sistema.
              submitPayment();
          }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 80, // Aproximadamente 2cm do topo
    alignItems: 'center',
  },
  container: {
    width: '95%',
    height: '92%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  containerMobile: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    zIndex: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryBox: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
    flex: 1
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: '#666',
    fontSize: 14,
  },
  value: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    padding: 12,
    fontSize: 14,
    color: '#888',
    backgroundColor: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 50,
  },
  itemPaid: {
    backgroundColor: '#f9f9f9',
  },
  itemSelected: {
    backgroundColor: '#e3f2fd',
  },
  checkArea: {
    padding: 4,
    marginRight: 8,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 16,
    color: '#333',
  },
  itemSub: {
    fontSize: 12,
    color: '#888',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    width: 100,
  },
  currencySymbol: {
    color: '#666',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 14,
    color: '#333',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    gap: 6
  },
  methodButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  methodText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  methodTextSelected: {
    color: '#fff',
  },
  totalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
