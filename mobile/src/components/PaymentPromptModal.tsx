import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaymentPromptModalProps {
    visible: boolean;
    onClose: () => void;
    onYes: () => void;
    onNo: () => void;
}

const PaymentPromptModal: React.FC<PaymentPromptModalProps> = ({ visible, onClose, onYes, onNo }) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="wallet-outline" size={40} color="#fff" />
                    </View>
                    
                    <Text style={styles.title}>Pagamento</Text>
                    <Text style={styles.message}>Deseja realizar o pagamento agora?</Text>
                    
                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.buttonSecondary} onPress={onNo}>
                            <Text style={styles.buttonTextSecondary}>Pagar Depois</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.buttonPrimary} onPress={onYes}>
                            <Text style={styles.buttonTextPrimary}>Pagar Agora</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#4CAF50', // Green for money/payment
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: "#4CAF50",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    message: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    buttonPrimary: {
        flex: 1,
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    buttonSecondary: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    buttonTextPrimary: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonTextSecondary: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default PaymentPromptModal;
