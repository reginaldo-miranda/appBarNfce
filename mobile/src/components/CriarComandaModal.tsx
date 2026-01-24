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
  Alert,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { Ionicons } from '@expo/vector-icons'
import api, { employeeService, customerService } from '../services/api'

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
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null);
  
  // Modal States
  const [showClientModal, setShowClientModal] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });
  const [registerLoading, setRegisterLoading] = useState(false);

  const [selectedFuncionario, setSelectedFuncionario] = useState('');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadFuncionarios()
        .finally(() => setLoading(false));
    }
  }, [visible]);

  // Search Clients
  // Search Clients Effect
  useEffect(() => {
      const delay = setTimeout(async () => {
          if (searchClientQuery.length > 2) {
              try {
                  const res = await api.get('/customer/list', { params: { nome: searchClientQuery } });
                  setClients(res.data || []);
              } catch (e) { console.error('Erro ao buscar clientes', e); }
          } else {
             if (searchClientQuery === '') setClients([]);
          }
      }, 500);
      return () => clearTimeout(delay);
  }, [searchClientQuery]);

  const loadFuncionarios = async () => {
    try {
      const response = await employeeService.getAll();
      setFuncionarios(response.data || []);
      console.log('👤 Funcionários carregados:', (response.data || []).length);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const handleSelectClient = (client: any) => {
    setSelectedCliente(client);
    setNomeComanda(client.nome);
    setShowClientModal(false);
  };

  const handleUseNameOnly = async (name: string) => {
      try {
          if (!name || name.length < 3) return;
          const res = await customerService.create({ nome: name, fone: '', endereco: '' });
          if (res.data && res.data.customer) {
              handleSelectClient(res.data.customer);
          } else {
              Alert.alert('Erro', 'Não foi possível criar o cliente temporário.');
          }
      } catch (e: any) {
          console.error(e);
          const msg = e.response?.data?.error || e.message || 'Falha ao usar nome temporário';
          Alert.alert('Erro', msg);
      }
  };

  const handleRegisterClient = async () => {
      if (!registerForm.nome) {
          Alert.alert('Erro', 'Nome é obrigatório');
          return;
      }
      setRegisterLoading(true);
      try {
          const res = await customerService.create(registerForm);
          if (res.data && res.data.customer) {
              setRegisterForm({ nome: '', fone: '', endereco: '', cidade: '', estado: '' });
              setShowRegisterModal(false);
              setTimeout(() => {
                  handleSelectClient(res.data.customer);
                  Alert.alert('Sucesso', 'Cliente cadastrado!');
              }, 100);
          } else {
              Alert.alert('Erro', 'Servidor não retornou dados do cliente.');
          }
      } catch (e: any) {
          const msg = e.response?.data?.error || e.message || 'Erro ao cadastrar';
          Alert.alert('Erro', msg);
      } finally {
          setRegisterLoading(false);
      }
  };

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
      cliente: selectedCliente ? (selectedCliente._id || selectedCliente.id) : null,
      valorTotalEstimado: parseFloat(valorTotalEstimado) || 0,
      observacoes: observacoes.trim()
    });
    
    // Limpar campos após o submit
    setNomeComanda('');
    setObservacoes('');
    setValorTotalEstimado('0');
    setSelectedFuncionario('');
    setSelectedCliente(null);
    setClients([]);
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

                {/* Nome da Comanda */}
                <View style={[styles.fieldContainer, { zIndex: 999 }]}> 
                  <Text style={styles.label}>Nome da Comanda / Cliente: *</Text>
                  <TouchableOpacity
                    style={[styles.input, { justifyContent: 'center' }]}
                    onPress={() => setShowClientModal(true)}
                  >
                     <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                        <Text style={{ color: nomeComanda ? '#000' : '#888' }}>
                            {nomeComanda || 'Buscar ou Cadastrar Cliente...'}
                        </Text>
                        <Ionicons name="search" size={20} color="#666" />
                     </View>
                  </TouchableOpacity>
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

              {/* Nome da Comanda */}
              <View style={[styles.fieldContainer, { zIndex: 999 }]}>
                <Text style={styles.label}>Nome da Comanda / Cliente: *</Text>
                  <TouchableOpacity
                    style={[styles.input, { justifyContent: 'center' }]}
                    onPress={() => setShowClientModal(true)}
                  >
                     <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                        <Text style={{ color: nomeComanda ? '#000' : '#888' }}>
                            {nomeComanda || 'Buscar ou Cadastrar Cliente...'}
                        </Text>
                        <Ionicons name="search" size={20} color="#666" />
                     </View>
                  </TouchableOpacity>
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
      {/* Modal Selecionar Cliente */}
       <Modal
          visible={showClientModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowClientModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: '80%' }]}>
                  <Text style={styles.modalTitle}>Selecionar Cliente</Text>
                  <View style={{ marginBottom: 10 }}>
                    <TextInput
                        style={styles.input}
                        placeholder="Buscar por nome..."
                        value={searchClientQuery}
                        onChangeText={setSearchClientQuery}
                        autoFocus
                    />
                  </View>
                  
                  {clients.length === 0 && searchClientQuery.length > 2 && (
                       <View>
                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => {
                                   setRegisterForm({ ...registerForm, nome: searchClientQuery });
                                   setShowRegisterModal(true);
                               }}
                           >
                               <Ionicons name="person-add" size={20} color="#2196F3" style={{ marginRight: 8 }} />
                               <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>Cadastrar Completo: "{searchClientQuery}"</Text>
                           </TouchableOpacity>

                           <TouchableOpacity style={{ padding: 12, backgroundColor: '#FFF3E0', borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                               onPress={() => handleUseNameOnly(searchClientQuery)}
                           >
                               <Ionicons name="text" size={20} color="#FF9800" style={{ marginRight: 8 }} />
                               <Text style={{ color: '#FF9800', fontWeight: 'bold' }}>Usar Apenas Nome: "{searchClientQuery}"</Text>
                           </TouchableOpacity>
                       </View>
                  )}
                  <ScrollView>
                      {clients.map(c => (
                          <TouchableOpacity key={c.id || c._id} 
                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                              onPress={() => handleSelectClient(c)}
                          >
                              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{c.nome}</Text>
                              {c.endereco && <Text style={{ fontSize: 12, color: '#666' }}>{c.endereco}</Text>}
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
                  <TouchableOpacity style={[styles.button, styles.buttonCancel, { marginTop: 10, flex: 0 }]} onPress={() => setShowClientModal(false)}>
                      <Text style={styles.buttonText}>Fechar</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {/* Modal Cadastro Rápido de Cliente */}
      <Modal
          visible={showRegisterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRegisterModal(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '80%', height: 'auto' }]}>
                  <Text style={styles.modalTitle}>Novo Cliente</Text>
                  <ScrollView>
                      <Text style={styles.label}>Nome *</Text>
                      <TextInput 
                          style={styles.input} 
                          value={registerForm.nome}
                          onChangeText={t => setRegisterForm({...registerForm, nome: t})}
                      />
                      
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>Whatsapp / Telefone</Text>
                        <TextInput 
                            style={styles.input} 
                            value={registerForm.fone}
                            keyboardType="phone-pad"
                            onChangeText={t => setRegisterForm({...registerForm, fone: t})}
                        />
                      </View>

                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>CEP (Opcional)</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Digite CEP para buscar"
                            keyboardType="numeric"
                            onBlur={async () => {
                                if (registerForm.endereco?.length > 5) return; 
                                const c = (registerForm as any).cep?.replace(/\D/g,'');
                                if(c?.length===8) {
                                    try {
                                        const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
                                        const d = await r.json();
                                        if(!d.erro) {
                                            setRegisterForm(prev => ({
                                                ...prev,
                                                endereco: `${d.logradouro}, ${d.bairro}`,
                                                cidade: d.localidade,
                                                estado: d.uf
                                            }));
                                        }
                                    } catch {}
                                }
                            }}
                            onChangeText={t => setRegisterForm({...registerForm, cep: t} as any)} 
                        />
                      </View>

                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.label}>Endereço Completo</Text>
                        <TextInput 
                            style={styles.input} 
                            value={registerForm.endereco}
                            placeholder="Rua, Número, Bairro"
                            onChangeText={t => setRegisterForm({...registerForm, endereco: t})}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                          <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Cidade</Text>
                              <TextInput 
                                  style={styles.input} 
                                  value={registerForm.cidade}
                                  onChangeText={t => setRegisterForm({...registerForm, cidade: t})}
                              />
                          </View>
                          <View style={{ width: 80 }}>
                              <Text style={styles.label}>UF</Text>
                              <TextInput 
                                  style={styles.input} 
                                  value={registerForm.estado}
                                  onChangeText={t => setRegisterForm({...registerForm, estado: t})}
                              />
                          </View>
                      </View>
                  </ScrollView>

                  <View style={styles.buttonContainer}>
                      <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={() => setShowRegisterModal(false)}>
                          <Text style={styles.buttonText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={[styles.button, styles.buttonCreate, registerLoading && { opacity: 0.7 }]} 
                          onPress={handleRegisterClient}
                          disabled={registerLoading}
                      >
                          {registerLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

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
  clientListContainer: {
      backgroundColor: '#fff',
      borderColor: '#ddd',
      borderWidth: 1,
      borderTopWidth: 0,
      borderRadius: 8,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      maxHeight: 150,
      overflow: 'hidden',
  },
  clientItem: {
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      backgroundColor: '#fefefe'
  }
});