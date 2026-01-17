import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product, ProductSize } from '../types/index';

interface SizeSelectorModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSelectSize: (size: ProductSize) => void;
}

export default function SizeSelectorModal({ visible, product, onClose, onSelectSize }: SizeSelectorModalProps) {
  if (!product || !visible) return null;

  const tamanhos = product.tamanhos || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Selecione o Tamanho</Text>
                <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{product.nome}</Text>

            <FlatList
                data={tamanhos}
                keyExtractor={(item, index) => item.nome + index}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.sizeItem} onPress={() => onSelectSize(item)}>
                        <Text style={styles.sizeName}>{item.nome}</Text>
                        <Text style={styles.sizePrice}>R$ {Number(item.preco).toFixed(2)}</Text>
                    </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingVertical: 10 }}
            />
          </View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  sizeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    borderRadius: 8,
  },
  sizeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sizePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});
