import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api, { saleService, apiService, getWsUrl, API_URL } from '../src/services/api';
import ScreenIdentifier from '../src/components/ScreenIdentifier';
import { Linking, Modal } from 'react-native';
import PaymentSplitModal from '../src/components/PaymentSplitModal';
// import DateTimePicker from '@react-native-community/datetimepicker';

export default function DeliveryDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [filterStatus, setFilterStatus] = useState('pending'); // pending, delivered, all
  const [dateRange, setDateRange] = useState('today'); // today, all, custom
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start'|'end'>('start');

  // Modal States
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);

  const loadDeliveries = async () => {
    try {
      setLoading(true);
      const params: any = { isDelivery: true };
      
      // Status Filter
      // Status Filter
      if (filterStatus === 'pending') {
          // params.status = 'aberta'; // REMOVED: Paid items (finalizada) can still be pending delivery
      } else if (filterStatus === 'delivered') {
          // params.status = 'finalizada'; // REMOVED: User wants to see ALL delivered items regardless of sale status
      }

      // Date Filter
      const now = new Date();
      if (dateRange === 'today') {
          const start = new Date(now); start.setHours(0,0,0,0);
          const end = new Date(now); end.setHours(23,59,59,999);
          params.dataInicio = start.toISOString();
          params.dataFim = end.toISOString();
      }

      const res = await saleService.list(params);
      
      if (res.data && Array.isArray(res.data)) {
         let filtered = res.data;
         
         // Client-side Refined Filtering for Delivery Status
         if (filterStatus === 'pending') {
             // Pending = Not Delivered AND Not Finalized
             filtered = filtered.filter((s:any) => s.deliveryStatus !== 'delivered' && s.status !== 'finalizada');
         } else if (filterStatus === 'delivered') {
             // Delivered = Delivered OR Finalized
             filtered = filtered.filter((s:any) => s.deliveryStatus === 'delivered' || s.status === 'finalizada');
         }
         // If filterStatus === 'all', we don't filter (show everything)

         setDeliveries(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } else {
         setDeliveries([]);
      }
    } catch (error) {
      console.error('Erro ao buscar entregas', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [filterStatus, dateRange]); // Reload when filters change

  const onRefresh = () => {
      setRefreshing(true);
      loadDeliveries();
  };

  const handleOpenPayment = (sale: any) => {
      setSelectedSale(sale);
      setSplitModalVisible(true);
  };

  const openMaps = (address: string) => {
      const url = Platform.select({
          ios: `maps:0,0?q=${encodeURIComponent(address)}`,
          android: `geo:0,0?q=${encodeURIComponent(address)}`,
          web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      });
      if (url) {
        Linking.openURL(url);
      }
  };

  if (loading) {
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
          </View>
      );
  }

  return (
    <View style={styles.container}>

        {/* <ScreenIdentifier screenName="Dashboard Delivery" /> */ }
        <View style={styles.header}>
            <TouchableOpacity 
                onPress={() => {
                    if (router.canGoBack()) router.back();
                    else router.replace('/');
                }} 
                style={styles.backButton} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Dashboard Delivery</Text>
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity onPress={() => setDateRange('today')} style={[styles.filterChip, dateRange === 'today' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, dateRange === 'today' && styles.filterTextActive]}>Hoje</Text>
                </TouchableOpacity>

                
                <View style={styles.divider} />
                
                <TouchableOpacity onPress={() => setFilterStatus('all')} style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterStatus('pending')} style={[styles.filterChip, filterStatus === 'pending' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, filterStatus === 'pending' && styles.filterTextActive]}>Pendentes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilterStatus('delivered')} style={[styles.filterChip, filterStatus === 'delivered' && styles.filterChipActive]}>
                    <Text style={[styles.filterText, filterStatus === 'delivered' && styles.filterTextActive]}>Entregues</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>

        <ScrollView 
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {deliveries.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="bicycle-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>Nenhuma entrega pendente.</Text>
                </View>
            ) : (
                deliveries.map((sale) => (
                    <View key={sale.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>#{sale.id} - {sale.cliente?.nome || 'Cliente não ident.'}</Text>
                            <View style={[styles.statusBadge, (sale.deliveryStatus === 'delivered' || sale.status === 'finalizada') && { backgroundColor: '#4CAF50' }]}>
                                <Text style={[styles.statusText, (sale.deliveryStatus === 'delivered' || sale.status === 'finalizada') && { color: '#fff' }]}>
                                    {(sale.deliveryStatus === 'delivered' || sale.status === 'finalizada') ? 'Entregue' : 'Pendente'}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={styles.address} onPress={() => openMaps(sale.deliveryAddress)}>
                            <Ionicons name="location" size={14} color="#2196F3" /> {sale.deliveryAddress || 'Sem endereço'}
                        </Text>
                        
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                 <Ionicons name="bicycle" size={14} color="#666" /> 
                                 <Text style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>
                                     {sale.entregador?.nome || 'Sem entregador'}
                                 </Text>
                             </View>
                             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                 <Ionicons name="id-card" size={14} color="#666" /> 
                                 <Text style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>
                                     {sale.funcionario?.nome || 'Atendente'}
                                 </Text>
                             </View>
                        </View>

                        <View style={styles.infoRow}>
                            {/* Calculate values with client-side fallback if DB is 0 */}
                            {(() => {
                                const subtotal = Number(sale.subtotal) || (sale.itens || []).reduce((acc: number, i: any) => acc + (Number(i.subtotal) || (Number(i.precoUnitario || 0) * Number(i.quantidade || 1))), 0);
                                const taxa = Number(sale.deliveryFee) || 0;
                                const total = Number(sale.total) || (subtotal + taxa - Number(sale.desconto || 0));
                                
                                return (
                                    <View style={{ width: '100%' }}>
                                        <Text style={styles.infoText}>Distância: {sale.deliveryDistance} km</Text>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                            <Text style={styles.infoText}>Produtos:</Text>
                                            <Text style={styles.infoText}>R$ {subtotal.toFixed(2)}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                                            <Text style={styles.infoText}>Taxa Entrega:</Text>
                                            <Text style={styles.infoText}>+ R$ {taxa.toFixed(2)}</Text>
                                        </View>
                                        <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 4 }} />
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={styles.totalText}>TOTAL:</Text>
                                            <Text style={styles.totalText}>R$ {total.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                );
                            })()}
                        </View>

                        <View style={styles.actions}>
                             {(sale.deliveryStatus !== 'delivered' && sale.status !== 'finalizada') && (
                             <TouchableOpacity 
                                onPress={() => handleOpenPayment(sale)} 
                                style={styles.confirmButton}
                             >
                                 <Ionicons name="cash" size={20} color="#fff" />
                                 <Text style={styles.buttonText}>Confirmar / Pagar</Text>
                             </TouchableOpacity>
                             )}
                        </View>
                    </View>
                ))
            )}
        </ScrollView>

        <PaymentSplitModal
            visible={splitModalVisible}
            sale={selectedSale}
            onClose={() => setSplitModalVisible(false)}
            onPaymentSuccess={async (isFull) => {
                if (isFull && selectedSale) {
                    try {
                        // Mark as delivered and finalized
                        await saleService.update(selectedSale.id, { deliveryStatus: 'delivered', status: 'finalizada' });
                        setSplitModalVisible(false);
                        Alert.alert('Sucesso', 'Entrega finalizada!');
                        loadDeliveries();
                    } catch (e) {
                        console.error(e);
                        Alert.alert('Erro', 'Pagamento registrado, mas erro ao atualizar status da entrega.');
                    }
                }
            }}
        />
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { 
      paddingTop: 50, 
      paddingBottom: 20, 
      paddingHorizontal: 20, 
      backgroundColor: '#2196F3', 
      flexDirection: 'row', 
      alignItems: 'center' 
    },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
    backButton: { padding: 4 },
    list: { padding: 16 },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#888', marginTop: 16, fontSize: 16 },
    
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    statusBadge: { backgroundColor: '#FFEB3B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 12, fontWeight: 'bold' },
    address: { color: '#2196F3', marginBottom: 12, fontSize: 14 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    infoText: { color: '#666', fontSize: 12 },
    totalText: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32' },
    
    actions: { flexDirection: 'row', justifyContent: 'flex-end' },
    confirmButton: { 
        backgroundColor: '#4CAF50', 
        flexDirection: 'row', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 8, 
        alignItems: 'center',
        gap: 8
    },
    buttonText: { color: '#fff', fontWeight: 'bold' },
    
    // Filters
    filterContainer: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0', marginRight: 8 },
    filterChipActive: { backgroundColor: '#2196F3' },
    filterText: { color: '#666', fontSize: 13 },
    filterTextActive: { color: '#fff', fontWeight: 'bold' },
    divider: { width: 1, backgroundColor: '#ddd', marginHorizontal: 8, height: '80%' },
    statusText: { fontSize: 12, fontWeight: 'bold' }
});
