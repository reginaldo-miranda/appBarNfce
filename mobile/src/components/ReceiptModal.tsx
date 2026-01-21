import React from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  sale: any;
}

export default function ReceiptModal({ visible, onClose, sale }: Props) {
  if (!sale) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatCurrency = (val: number | string) => {
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const items = sale.itens || [];
  const subtotal = Number(sale.subtotal) || items.reduce((acc: number, i: any) => acc + (Number(i.subtotal) || (Number(i.precoUnitario || 0) * Number(i.quantidade || 1))), 0);
  const deliveryFee = Number(sale.deliveryFee) || 0;
  const total = Number(sale.total) || (subtotal + deliveryFee - Number(sale.desconto || 0));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.headerAction}>
             <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                 <Ionicons name="close" size={24} color="#333" />
             </TouchableOpacity>
             <Text style={styles.headerTitle}>Cupom de Entrega</Text>
             <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            
            {/* Header Cupom */}
            <View style={styles.receiptHeader}>
                <Text style={styles.companyName}>NOVA SUICA / LIMEIRA-SP</Text>
                <Text style={styles.companyInfo}>Fone: 1934561033 Fax: 34534142</Text>
                <Text style={styles.companyInfo}>CNPJ: 04.386.179/0001-18  IE: 417.226.989.119</Text>
                
                <View style={styles.dashedLine} />
                
                <View style={styles.rowBetween}>
                    <Text style={styles.mono}>{formatDate(sale.createdAt)}</Text>
                    <Text style={styles.mono}>PDV:001</Text>
                    <Text style={styles.mono}>CI:{String(sale.id).padStart(8, '0')}</Text>
                </View>
                
                <View style={styles.dashedLine} />
            </View>

            {/* Client Info */}
            <View style={styles.section}>
                <Text style={styles.mono}>Cliente:   [{sale.cliente?.nome?.toUpperCase() || 'CONSUMIDOR'}]</Text>
                <Text style={styles.mono}>Endereço:  {sale.deliveryAddress || 'RETIRADA'}</Text>
                <Text style={styles.mono}>Vendedor:  {sale.funcionario?.nome?.toUpperCase() || 'BALCAO'}</Text>
                <Text style={styles.mono}>Pagto:     [A VISTA]</Text> 
            </View>

            <View style={styles.dashedLine} />
            
            <Text style={styles.fiscalTitle}>SEM VALOR FISCAL</Text>
            
            <View style={styles.dashedLine} />

            {/* Items Header */}
            <View style={styles.itemsHeader}>
                <Text style={[styles.mono, styles.flex1]}>ITEM CODIGO</Text>
                <Text style={[styles.mono, styles.flex2]}>DESCRICAO</Text>
                <Text style={[styles.mono, styles.flex1, { textAlign: 'right' }]}>VL ITEM</Text>
            </View>
            <View style={styles.itemsSubHeader}>
                <Text style={[styles.mono, { fontSize: 10 }]}>QTD. UND  VL UNIT. DESC %</Text>
            </View>

            <View style={styles.dashedLine} />

            {/* Items List */}
            {items.map((item: any, index: number) => (
                <View key={index} style={styles.itemRow}>
                    <Text style={styles.mono}>{String(index + 1).padStart(3, '0')} {String(item.produtoId || '000').padStart(5, '0')}      {item.produto?.nome?.substring(0, 20).toUpperCase() || 'PRODUTO'}</Text>
                    <View style={styles.rowBetween}>
                        <Text style={styles.mono}>     {Number(item.quantidade).toFixed(0)} UN x {Number(item.precoUnitario).toFixed(2).replace('.', ',')}</Text>
                        <Text style={styles.mono}>{Number(item.subtotal || (item.quantidade * item.precoUnitario)).toFixed(2).replace('.', ',')}</Text>
                    </View>
                </View>
            ))}

            {/* Delivery Fee as Item */}
            {deliveryFee > 0 && (
                <View style={styles.itemRow}>
                    <Text style={styles.mono}>{String(items.length + 1).padStart(3, '0')} ENTREGA    TAXA DE ENTREGA</Text>
                    <View style={styles.rowBetween}>
                        <Text style={styles.mono}>     1 UN x {deliveryFee.toFixed(2).replace('.', ',')}</Text>
                        <Text style={styles.mono}>{deliveryFee.toFixed(2).replace('.', ',')}</Text>
                    </View>
                </View>
            )}

            <View style={styles.dashedLine} />

            {/* Footer / Totals */}
            <View style={styles.footer}>
                <Text style={styles.mono}>Volumes: {items.length}</Text>
                
                <View style={[styles.dashedLine, { width: '40%', alignSelf: 'flex-end', marginVertical: 5 }]} />
                
                <View style={styles.rowBetween}>
                    <Text style={[styles.monoBold, { fontSize: 16 }]}>TOTAL</Text>
                    <Text style={[styles.monoBold, { fontSize: 16 }]}>R$</Text>
                    <Text style={[styles.monoBold, { fontSize: 16 }]}>{total.toFixed(2).replace('.', ',')}</Text>
                </View>
                
                <View style={{ height: 20 }} />
                
                <View style={styles.rowBetween}>
                    <Text style={styles.mono}>Dinheiro</Text>
                    <Text style={styles.mono}>{total.toFixed(2).replace('.', ',')}</Text>
                </View>
            </View>

            <View style={{ height: 40 }} />
            <Text style={[styles.mono, { textAlign: 'center', fontSize: 10 }]}>biroska.com.br</Text>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  container: {
    width: '90%',
    height: '90%',
    maxWidth: 400,
    backgroundColor: '#fffbe6', // Slight yellow tint like old paper
    borderRadius: 4,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    padding: 15,
  },
  scrollContent: {
    paddingBottom: 40
  },
  headerAction: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      backgroundColor: '#f0f0f0',
      borderBottomWidth: 1,
      borderBottomColor: '#ddd'
  },
  closeButton: {
      padding: 5
  },
  headerTitle: {
      fontWeight: 'bold',
      fontSize: 16
  },
  
  // Receipt Styles
  receiptHeader: {
      alignItems: 'center',
      marginBottom: 10
  },
  companyName: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontWeight: 'bold',
      fontSize: 14,
      textAlign: 'center'
  },
  companyInfo: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 12,
      textAlign: 'center'
  },
  
  dashedLine: {
      borderBottomWidth: 1,
      borderBottomColor: '#333',
      borderStyle: 'dashed', // React Native doesn't support dashed borders perfectly on View without hacks, but borderStyle works on iOS/Android often or we use characters. 
      // Using a text based dashed line is safer for visual consistency across platforms if needed, but View is simpler for new.
      width: '100%',
      marginVertical: 8,
      opacity: 0.5
  },
  
  rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%'
  },
  
  mono: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 13,
      color: '#333'
  },
  monoBold: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 13,
      fontWeight: 'bold',
      color: '#000'
  },
  
  section: {
      marginVertical: 5
  },
  
  fiscalTitle: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
      marginTop: 5
  },
  
  itemsHeader: {
      flexDirection: 'row',
      marginTop: 5
  },
  itemsSubHeader: {
      flexDirection: 'row',
      marginBottom: 5
  },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  
  itemRow: {
      marginBottom: 8
  },
  
  footer: {
      marginTop: 10
  }
});
