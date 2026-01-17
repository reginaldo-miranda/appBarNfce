import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
// import { Ionicons } from '@expo/vector-icons'
import { employeeService } from '../services/api'

interface Funcionario {
  _id: string;
  nome: string;
  ativo?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function CriarComandaModal({ visible, onClose, onSubmit }: Props) {
  const [nomeComanda, setNomeComanda] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valorTotalEstimado, setValorTotalEstimado] = useState('0');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  // Removed clientes state
  const [selectedFuncionario, setSelectedFuncionario] = useState('');
  // Removed selectedCliente state
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadFuncionarios()
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const loadFuncionarios = async () => {
    try {
      const response = await employeeService.getAll();
      setFuncionarios(response.data || []);
      console.log('👤 Funcionários carregados:', (response.data || []).length);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  // Cliente removido conforme especificação: função de carregar clientes removida

  const handleSubmit = () => {
    const nome = (nomeComanda || '').trim();

    // Nome da comanda é obrigatório
    if (!nome) {
      alert('Digite um nome para a comanda');
      return;
    }

    // Funcionário é obrigatório
    if (!selectedFuncionario) {
      alert('Selecione um funcionário para criar a comanda');
      return;
    }

    onSubmit({ 
      nomeComanda: nome,
      funcionario: selectedFuncionario,
      // Removed cliente
      valorTotalEstimado: parseFloat(valorTotalEstimado) || 0,
      observacoes: observacoes.trim()
    });
    
    // Limpar campos após o submit
    setNomeComanda('');
    setObservacoes('');
    setValorTotalEstimado('0');
    setSelectedFuncionario('');
    // Removed setSelectedCliente
  };

  return (
    <Modal
      animationType="slide"
      transparent={Platform.OS === 'ios'}
      visible={visible}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'fullScreen'}
      hardwareAccelerated
      statusBarTranslucent
      supportedOrientations={["portrait"]}
      onShow={() => console.log('🪟 Modal Nova Comanda exibida')}
    >
      {Platform.OS === 'ios' ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Comanda</Text>
            {loading ? (
              <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={{marginTop:12, color:'#666'}}>Carregando dados...</Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Seleção de Funcionário */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Funcionário: *</Text>
                  {!loading && funcionarios.length === 0 ? (
                    <Text style={{color:'#d32f2f', marginBottom:8}}>Nenhum funcionário encontrado. Verifique a conexão com a API.</Text>
                  ) : null}
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedFuncionario}
                      onValueChange={(itemValue) => {
                         const func = funcionarios.find(f => String(f._id) === String(itemValue));
                         if (func && !func.ativo) {
                           alert('Funcionário inativo não pode ser selecionado.');
                           setSelectedFuncionario('');
                           return;
                         }
                         setSelectedFuncionario(itemValue);
                      }}
                      style={styles.picker}
                      testID="picker-funcionario"
                    >
                      <Picker.Item label="Selecione um funcionário..." value="" />
                      {funcionarios.map((funcionario) => (
                        <Picker.Item 
                          key={funcionario._id} 
                          label={`${funcionario.nome}${!funcionario.ativo ? ' (Inativo)' : ''}`}
                          value={funcionario._id} 
                          color={!funcionario.ativo ? '#999' : '#000'}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                {/* Cliente removido conforme especificação: função de carregar clientes removida */}

                {/* Nome da Comanda */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Nome da Comanda: *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Mesa 5 - João"
                    value={nomeComanda}
                    onChangeText={setNomeComanda}
                  />
                </View>

                {/* Valor Total Estimado */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Valor Total Estimado:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={valorTotalEstimado}
                    onChangeText={setValorTotalEstimado}
                    keyboardType="numeric"
                  />
                </View>

                {/* Observações */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>Observações:</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Ex: Cliente preferencial, desconto especial..."
                    value={observacoes}
                    onChangeText={setObservacoes}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </ScrollView>
            )}

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={onClose}>
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.buttonCreate]} 
                onPress={handleSubmit}
              >
                <Text style={styles.buttonText}>{loading ? 'Criando...' : 'Criar Comanda'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.modalContent, { width: '100%', height: '100%' }]}>
          <Text style={styles.modalTitle}>Nova Comanda</Text>
          {loading ? (
            <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={{marginTop:12, color:'#666'}}>Carregando dados...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Seleção de Funcionário */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Funcionário: *</Text>
                {!loading && funcionarios.length === 0 ? (
                  <Text style={{color:'#d32f2f', marginBottom:8}}>Nenhum funcionário encontrado. Verifique a conexão com a API.</Text>
                ) : null}
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedFuncionario}
                    onValueChange={(itemValue) => {
                       const func = funcionarios.find(f => String(f._id) === String(itemValue));
                       if (func && !func.ativo) {
                         alert('Funcionário inativo não pode ser selecionado.');
                         setSelectedFuncionario('');
                         return;
                       }
                       setSelectedFuncionario(itemValue);
                    }}
                    style={styles.picker}
                    testID="picker-funcionario"
                  >
                    <Picker.Item label="Selecione um funcionário..." value="" />
                    {funcionarios.map((funcionario) => (
                      <Picker.Item 
                        key={funcionario._id} 
                        label={`${funcionario.nome}${!funcionario.ativo ? ' (Inativo)' : ''}`}
                        value={funcionario._id} 
                        color={!funcionario.ativo ? '#999' : '#000'}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Cliente removido conforme especificação */}

              {/* Nome da Comanda */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Nome da Comanda: *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Mesa 5 - João"
                  value={nomeComanda}
                  onChangeText={setNomeComanda}
                />
              </View>

              {/* Valor Total Estimado */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Valor Total Estimado:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={valorTotalEstimado}
                  onChangeText={setValorTotalEstimado}
                  keyboardType="numeric"
                />
              </View>

              {/* Observações */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Observações:</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ex: Cliente preferencial, desconto especial..."
                  value={observacoes}
                  onChangeText={setObservacoes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={onClose}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.buttonCreate]} 
              onPress={handleSubmit}
            >
              <Text style={styles.buttonText}>{loading ? 'Criando...' : 'Criar Comanda'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '95%',
    height: '90%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
    zIndex: 1000,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  scrollContent: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingVertical: 4,
  },
  picker: {
    height: Platform.OS === 'ios' ? 200 : 52,
    backgroundColor: '#f9f9f9',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonCancel: {
    backgroundColor: '#f44336',
  },
  buttonCreate: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});