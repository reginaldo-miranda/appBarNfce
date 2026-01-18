
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { generatePixPayload } from '../services/pix';
import NfceService from '../services/NfceService';

interface PixModalProps {
    visible: boolean;
    amount: number;
    transactionId?: string; // e.g. "PEDIDO-123"
    onClose: () => void;
    onConfirm: () => void;
}

export default function PixModal({ visible, amount, transactionId, onClose, onConfirm }: PixModalProps) {
    const [qrValue, setQrValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixName, setPixName] = useState('');
    const [pixCity, setPixCity] = useState('');

    useEffect(() => {
        if (visible) {
            loadConfigAndGenerate();
        }
    }, [visible, amount, transactionId]);

    const loadConfigAndGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch configuration directly here, or pass it as props.
            // Using NfceService.getConfig to ensure fresh data.
            const config = await NfceService.getConfig();
            
            if (!config || !config.chavePix) {
                setError('Chave PIX não configurada. Configure em Configurações > NFC-e.');
                setLoading(false);
                return;
            }

            // Defaults if name/city missing
            const name = config.pixName || config.pixRefName || 'LOJA';
            const city = config.pixCity || config.pixRefCity || 'BRASIL';

            setPixKey(config.chavePix);
            setPixName(name);
            setPixCity(city);

            const payload = generatePixPayload({
                key: config.chavePix,
                name: name,
                city: city,
                amount: amount,
                txid: transactionId || '***'
            });

            setQrValue(payload);

        } catch (e) {
            console.error('Erro ao gerar PIX:', e);
            setError('Falha ao gerar QR Code PIX.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!qrValue) return;
        Clipboard.setString(qrValue);
        Alert.alert('Copiado', 'Código PIX Copia e Cola copiado para a área de transferência.');
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                            <Ionicons name="qr-code" size={24} color="#333" />
                            <Text style={styles.title}>Pagamento via PIX</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={26} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {loading && <ActivityIndicator size="large" color="#2196F3" />}
                        
                        {!loading && error ? (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={40} color="#F44336" />
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginTop:10 }]} onPress={onClose}>
                                    <Text style={{color:'#666'}}>Fechar</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {!loading && !error && qrValue && (
                            <>
                                <View style={styles.amountBox}>
                                    <Text style={styles.label}>Valor a Pagar:</Text>
                                    <Text style={styles.amountValue}>R$ {amount.toFixed(2)}</Text>
                                </View>

                                <View style={styles.qrContainer}>
                                    <QRCode
                                        value={qrValue}
                                        size={220}
                                        color="black"
                                        backgroundColor="white"
                                        logoBackgroundColor='transparent'
                                    />
                                </View>
                                
                                <View style={styles.infoBox}>
                                    <Text style={styles.infoText}><Text style={{fontWeight:'bold'}}>Recebedor:</Text> {pixName}</Text>
                                    <Text style={styles.infoText}><Text style={{fontWeight:'bold'}}>Chave:</Text> {pixKey}</Text>
                                </View>

                                <TouchableOpacity style={[styles.button, styles.secondaryButton, {marginTop:10}]} onPress={copyToClipboard}>
                                    <Ionicons name="copy-outline" size={20} color="#2196F3" style={{marginRight:8}} />
                                    <Text style={{color:'#2196F3', fontWeight:'bold'}}>Copiar Código Pix</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {!loading && !error && (
                        <View style={styles.footer}>
                            <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
                                <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{marginRight:8}} />
                                <Text style={styles.confirmText}>Pagamento Confirmado</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 10
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth:1,
        borderBottomColor:'#eee',
        backgroundColor:'#f8f9fa'
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
    },
    content: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    qrContainer: {
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 20
    },
    amountBox: {
        alignItems: 'center',
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        color: '#666'
    },
    amountValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2196F3'
    },
    infoBox: {
        width: '100%',
        padding: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 10
    },
    infoText: {
        fontSize: 13,
        color: '#555',
        marginBottom: 4,
        textAlign: 'center'
    },
    errorBox: {
        alignItems: 'center',
        padding: 20
    },
    errorText: {
        fontSize: 16,
        color: '#F44336',
        marginTop: 10,
        textAlign: 'center'
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fafafa'
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    secondaryButton: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 16
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        elevation: 2
    },
    confirmText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    }
});
