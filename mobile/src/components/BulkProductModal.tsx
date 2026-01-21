import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { productService } from '../services/api';

interface BulkProductModalProps {
  visible: boolean;
  onClose: () => void;
  baseProduct: any;
  onSuccess: () => void;
}

interface ProductCopy {
  id: string; // Temp ID
  nome: string;
  precoVenda: string;
  precoCusto: string;
  estoque: string;
  codigoBarras: string;
  ncm: string;
}

export default function BulkProductModal({ visible, onClose, baseProduct, onSuccess }: BulkProductModalProps) {
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState('1');
  const [copies, setCopies] = useState<ProductCopy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setQuantity('1');
      setCopies([]);
    }
  }, [visible]);

  const handleGenerateValues = () => {
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Erro', 'Informe uma quantidade válida.');
      return;
    }
    if (qty > 50) {
       Alert.alert('Erro', 'O limite máximo é de 50 itens por vez.');
       return;
    }

    const newCopies: ProductCopy[] = [];
    for (let i = 0; i < qty; i++) {
      newCopies.push({
        id: String(Date.now() + i),
        nome: `${baseProduct.nome} #${i + 1}`,
        precoVenda: baseProduct.precoVenda ? Number(baseProduct.precoVenda).toFixed(2).replace('.', ',') : '0,00',
        precoCusto: baseProduct.precoCusto ? Number(baseProduct.precoCusto).toFixed(2).replace('.', ',') : '0,00',
        estoque: baseProduct.estoque ? String(baseProduct.estoque) : '0',
        codigoBarras: baseProduct.codigoBarras || '',
        ncm: baseProduct.ncm || ''
      });
    }
    setCopies(newCopies);
    setStep(2);
  };

  const updateCopy = (id: string, field: keyof ProductCopy, value: string) => {
    setCopies(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCopy = (id: string) => {
    setCopies(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveAll = async () => {
    if (copies.length === 0) return;

    setLoading(true);
    try {
      // Preparar payload
      const productsToCreate = copies.map(copy => ({
        ...baseProduct,
        nome: copy.nome,
        precoVenda: parseFloat(copy.precoVenda.replace(',', '.')),
        precoCusto: parseFloat(copy.precoCusto.replace(',', '.')),
        estoque: parseInt(copy.estoque) || 0,
        codigoBarras: copy.codigoBarras,
        ncm: copy.ncm,
        // Remover campos de ID para garantir criação
        id: undefined,
        _id: undefined,
        // Campos fiscais e outros mantidos do baseProduct
        // Tamanhos e Setores também serão copiados pelo backend se existirem no baseProduct
      }));

      await productService.createBulk(productsToCreate);

      const msg = 'Todos os produtos foram cadastrados com sucesso.';
      if (Platform.OS === 'web') {
        window.alert(msg);
        onSuccess();
      } else {
        Alert.alert('Sucesso!', msg, [
            { text: 'OK', onPress: onSuccess }
        ]);
      }
    } catch (error) {
      console.error('Erro ao replicar produtos:', error);
      Alert.alert('Erro', 'Falha ao salvar produtos em massa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Replicar Produto</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {step === 1 ? (
            <View style={styles.content}>
              <Text style={styles.label}>Quantas cópias deseja criar?</Text>
              <TextInput
                style={styles.inputQty}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                autoFocus
              />
              <Text style={styles.hint}>O produto base será duplicado com todas as suas configurações em N novas linhas para edição.</Text>
              
              <TouchableOpacity style={styles.button} onPress={handleGenerateValues}>
                <Text style={styles.buttonText}>Gerar Tabela</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, width: '100%' }}>
                <View style={[styles.gridHeader, { width: '100%', gap: 12 }]}>
                    <Text style={[styles.col, { flex: 1 }]}>Nome</Text>
                    <Text style={[styles.col, { width: 110, textAlign: 'right' }]}>Venda</Text>
                    <Text style={[styles.col, { width: 110, textAlign: 'right' }]}>Custo</Text>
                    <Text style={[styles.col, { width: 70, textAlign: 'right' }]}>Est.</Text>
                    <Text style={[styles.col, { width: 100, textAlign: 'right' }]}>NCM</Text>
                    <Text style={[styles.col, { width: 140, textAlign: 'right' }]}>Cód. Barras</Text>
                    <Text style={{ width: 50 }}></Text>
                </View>
                
                <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 20 }}>
                    {copies.map((copy, index) => (
                    <View key={copy.id} style={[styles.row, { width: '100%' }]}>
                        <TextInput 
                            style={[styles.input, { flex: 1 }]} 
                            value={copy.nome} 
                            onChangeText={t => updateCopy(copy.id, 'nome', t)}
                            placeholder="Nome"
                        />
                        <TextInput 
                            style={[styles.input, { width: 110, textAlign: 'right' }]} 
                            value={copy.precoVenda} 
                            onChangeText={t => updateCopy(copy.id, 'precoVenda', t)}
                            keyboardType="numeric"
                            placeholder="0,00"
                        />
                        <TextInput 
                            style={[styles.input, { width: 110, textAlign: 'right' }]} 
                            value={copy.precoCusto} 
                            onChangeText={t => updateCopy(copy.id, 'precoCusto', t)}
                            keyboardType="numeric"
                            placeholder="0,00"
                        />
                        <TextInput 
                            style={[styles.input, { width: 70, textAlign: 'right' }]} 
                            value={copy.estoque} 
                            onChangeText={t => updateCopy(copy.id, 'estoque', t)}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                        <TextInput 
                            style={[styles.input, { width: 100, textAlign: 'right' }]} 
                            value={copy.ncm} 
                            onChangeText={t => updateCopy(copy.id, 'ncm', t)}
                            keyboardType="numeric"
                            placeholder="NCM"
                        />
                            <TextInput 
                            style={[styles.input, { width: 140, textAlign: 'right' }]} 
                            value={copy.codigoBarras} 
                            onChangeText={t => updateCopy(copy.id, 'codigoBarras', t)}
                            placeholder="EAN/GTIN"
                        />
                        <TouchableOpacity onPress={() => removeCopy(copy.id)} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={24} color="#ff4444" />
                        </TouchableOpacity>
                    </View>
                    ))}
                </ScrollView>

            <View style={styles.footer}>
                 <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={() => setStep(1)}>
                    <Text style={[styles.buttonText, { color: '#666' }]}>Voltar</Text>
                 </TouchableOpacity>

                 <TouchableOpacity 
                    style={[styles.button, loading && { opacity: 0.7 }]} 
                    onPress={handleSaveAll}
                    disabled={loading}
                 >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar {copies.length} Produtos</Text>}
                 </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    width: '95%', // Wider on desktop
    maxWidth: 1200, // Max constraint
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20, // More padding
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: {
    fontSize: 22, // Larger title
    fontWeight: 'bold',
    color: '#333'
  },
  content: {
    padding: 20,
    alignItems: 'center'
  },
  label: {
    fontSize: 16,
    color: '#444',
    marginBottom: 10
  },
  inputQty: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    width: 100,
    textAlign: 'center',
    fontSize: 20,
    marginBottom: 10
  },
  hint: {
    textAlign: 'center',
    color: '#888',
    marginBottom: 20
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 120
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  gridHeader: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center'
  },
  col: {
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 4, // Tighter
    fontSize: 16
  },
  list: {
    flex: 1,
    padding: 15
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8, // Tighter spacing
    gap: 12,
    alignItems: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8, // Smaller padding
    fontSize: 16,
    backgroundColor: '#fff'
  },
  deleteBtn: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cancelBtn: {
    backgroundColor: '#eee'
  }
});
