import React, { createContext, useContext, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ConfirmationContext = createContext();

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation deve ser usado dentro de um ConfirmationProvider');
  }
  return context;
};

export const ConfirmationProvider = ({ children }) => {
  const [confirmationState, setConfirmationState] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    onConfirm: null,
    onCancel: null,
    type: 'delete', // 'delete', 'warning', 'info'
  });

  const showConfirmation = ({
    title = 'Confirmar Ação',
    message = 'Tem certeza que deseja continuar?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'delete',
    onConfirm,
    onCancel,
  }) => {
    return new Promise((resolve) => {
      setConfirmationState({
        visible: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          hideConfirmation();
          if (onConfirm) onConfirm();
          resolve(true);
        },
        onCancel: () => {
          hideConfirmation();
          if (onCancel) onCancel();
          resolve(false);
        },
      });
    });
  };

  const hideConfirmation = () => {
    setConfirmationState(prev => ({
      ...prev,
      visible: false,
    }));
  };

  // Função específica para confirmação de exclusão
  const confirmDelete = (itemName = 'este item', onConfirm, onCancel) => {
    return showConfirmation({
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir ${itemName}?\n\nEsta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'delete',
      onConfirm,
      onCancel,
    });
  };

  // Função específica para confirmação de remoção
  const confirmRemove = (itemName = 'este item', onConfirm, onCancel) => {
    return showConfirmation({
      title: 'Confirmar Remoção',
      message: `Tem certeza que deseja remover ${itemName}?`,
      confirmText: 'Remover',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm,
      onCancel,
    });
  };

  // Função para confirmação genérica
  const confirm = (message, onConfirm, onCancel) => {
    return showConfirmation({
      title: 'Confirmação',
      message,
      confirmText: 'Sim',
      cancelText: 'Não',
      type: 'info',
      onConfirm,
      onCancel,
    });
  };

  const getIconAndColor = () => {
    switch (confirmationState.type) {
      case 'delete':
        return { icon: 'trash-outline', color: '#ff4444' };
      case 'warning':
        return { icon: 'warning-outline', color: '#ff9500' };
      case 'info':
        return { icon: 'information-circle-outline', color: '#2196F3' };
      default:
        return { icon: 'help-circle-outline', color: '#666' };
    }
  };

  const { icon, color } = getIconAndColor();

  const value = {
    showConfirmation,
    confirmDelete,
    confirmRemove,
    confirm,
    hideConfirmation,
  };

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      
      <Modal
        visible={confirmationState.visible}
        transparent
        animationType="fade"
        onRequestClose={confirmationState.onCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.iconContainer}>
              <Ionicons name={icon} size={48} color={color} />
            </View>
            
            <Text style={styles.title}>
              {confirmationState.title}
            </Text>
            
            <Text style={styles.message}>
              {confirmationState.message}
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={confirmationState.onCancel}
              >
                <Text style={styles.cancelButtonText}>
                  {confirmationState.cancelText}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.confirmButton,
                  { backgroundColor: color }
                ]}
                onPress={confirmationState.onConfirm}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmationState.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ConfirmationContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#ff4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});