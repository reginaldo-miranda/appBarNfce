import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Linking, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  status: 'loading' | 'success' | 'error' | 'idle';
  message?: string;
  nfceData?: any; // Dados retornados da API (url, qrcode, etc)
}

export default function ImpressaoNfceModal({ visible, onClose, status, message, nfceData }: Props) {
  const handleOpenUrl = () => {
    if (nfceData?.urlConsulta) {
      Linking.openURL(nfceData.urlConsulta);
    }
  };

  // Auto-print (Auto-open PDF) when success
  React.useEffect(() => {
    if (status === 'success' && nfceData?.pdfUrl) {
       // Pequeno delay para garantir que o modal renderizou
       setTimeout(() => {
           Linking.openURL(nfceData.pdfUrl);
       }, 500);
    }
  }, [status, nfceData]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Emissão NFC-e</Text>
            <TouchableOpacity onPress={onClose} disabled={status === 'loading'}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {status === 'loading' && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Emitindo nota fiscal...</Text>
                <Text style={styles.subText}>Aguarde a resposta da SEFAZ</Text>
              </View>
            )}

            {status === 'success' && (
              <View style={styles.center}>
                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                <Text style={styles.successTitle}>Nota Autorizada!</Text>
                
                {nfceData?.qrCode?.base64 && (
                  <View style={styles.qrCodeContainer}>
                    <Image 
                      source={{ uri: nfceData.qrCode.base64 }} 
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrCodeLabel}>Aponte a câmera do celular</Text>
                  </View>
                )}

                <Text style={styles.message}>{message || 'NFC-e emitida com sucesso.'}</Text>
                
                {/* Fallback para botão se não tiver imagem, ou ambos */}
                {(nfceData?.urlConsulta || nfceData?.nfce?.qrCode || nfceData?.qrCode?.url) && (
                  <View style={styles.actions}>
                    {nfceData?.pdfUrl && (
                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF9800' }]} onPress={() => {
                            if (Platform.OS === 'web') {
                                window.open(nfceData.pdfUrl, '_blank');
                            } else {
                                Linking.openURL(nfceData.pdfUrl);
                            }
                        }}>
                        <Ionicons name="print" size={20} color="#fff" />
                        <Text style={styles.actionText}>Imprimir Cupom (PDF)</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.actionButton} onPress={() => {
                       const url = nfceData?.qrCode?.url || nfceData?.nfce?.qrCode || nfceData?.urlConsulta;
                       if(url) Linking.openURL(url);
                    }}>
                      <Ionicons name="qr-code" size={20} color="#fff" />
                      <Text style={styles.actionText}>Visualizar QR Code</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {status === 'error' && (
              <View style={styles.center}>
                <Ionicons name="alert-circle" size={64} color="#F44336" />
                <Text style={styles.errorTitle}>Falha na Emissão</Text>
                <Text style={styles.message}>{message || 'Ocorreu um erro ao comunicar com a SEFAZ.'}</Text>
                
                <TouchableOpacity style={[styles.actionButton, {backgroundColor:'#757575', marginTop:20}]} onPress={onClose}>
                  <Text style={styles.actionText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center'
  },
  container: {
    width: '90%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 5
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderColor: '#eee'
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { padding: 24, minHeight: 200 },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#333' },
  subText: { marginTop: 8, color: '#666' },
  successTitle: { marginTop: 16, fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  errorTitle: { marginTop: 16, fontSize: 20, fontWeight: 'bold', color: '#F44336' },
  message: { marginTop: 8, textAlign: 'center', color: '#555', fontSize: 14 },
  actions: { marginTop: 24, width: '100%', gap: 10 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2196F3', padding: 12, borderRadius: 8, gap: 8
  },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  qrCodeContainer: { alignItems: 'center', marginVertical: 16 },
  qrCodeImage: { width: 150, height: 150 },
  qrCodeLabel: { fontSize: 12, color: '#888', marginTop: 4 }
});
