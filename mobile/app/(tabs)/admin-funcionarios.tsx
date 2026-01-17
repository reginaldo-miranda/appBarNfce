import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
// Removido: import { Ionicons } from '@expo/vector-icons';
import { employeeService } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import ScreenIdentifier from '../../src/components/ScreenIdentifier';
import { SafeIcon } from '../../components/SafeIcon';

interface Employee {
  _id: string;
  id?: string | number;
  nome: string;
  endereco: string;
  bairro: string;
  telefone: string;
  salario: number;
  dataAdmissao: Date;
  ativo: boolean;
  dataInclusao: Date;
}

export default function AdminFuncionariosScreen() {
  const { hasPermission } = useAuth() as any;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchText, setSearchText] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    endereco: '',
    bairro: '',
    telefone: '',
    salario: '',
    dataAdmissao: new Date().toISOString().split('T')[0],
    ativo: true,
  });

  useEffect(() => {
    if (!hasPermission('funcionarios')) {
      Alert.alert('Acesso Negado', 'Você não tem permissão para acessar esta tela');
      return;
    }
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeService.getAll();
      console.log('✅ Funcionarios carregados:', response.data?.length, JSON.stringify(response.data));
      setEmployees(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar funcionários:', error);
      Alert.alert('Erro', 'Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmployee = async () => {
    try {
      if (!formData.nome.trim()) {
        Alert.alert('Erro', 'Nome é obrigatório');
        return;
      }

      const employeeData = {
        ...formData,
        salario: parseFloat(formData.salario) || 0,
        dataAdmissao: new Date(formData.dataAdmissao),
      };

      if (editingEmployee) {
        await employeeService.update(editingEmployee._id, employeeData);
        Alert.alert('Sucesso', 'Funcionário atualizado com sucesso');
      } else {
        await employeeService.create(employeeData);
        Alert.alert('Sucesso', 'Funcionário criado com sucesso');
      }

      setModalVisible(false);
      resetForm();
      loadEmployees();
    } catch (error: any) {
      console.error('Erro ao salvar funcionário:', error);
      Alert.alert('Erro', 'Erro ao salvar funcionário');
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      nome: employee.nome,
      endereco: employee.endereco || '',
      bairro: employee.bairro || '',
      telefone: employee.telefone || '',
      salario: employee.salario?.toString() || '',
      dataAdmissao: new Date(employee.dataAdmissao).toISOString().split('T')[0],
      ativo: employee.ativo,
    });
    setModalVisible(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o funcionário "${employee.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await employeeService.delete(employee._id);
              Alert.alert('Sucesso', 'Funcionário excluído com sucesso');
              loadEmployees();
            } catch (error: any) {
              console.error('Erro ao excluir funcionário:', error);
              Alert.alert('Erro', 'Erro ao excluir funcionário');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      endereco: '',
      bairro: '',
      telefone: '',
      salario: '',
      dataAdmissao: new Date().toISOString().split('T')[0],
      ativo: true,
    });
    setEditingEmployee(null);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredEmployees = employees.filter(employee =>
    (employee.nome || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (employee.telefone || '').includes(searchText)
  );

  const renderEmployee = ({ item }: { item: Employee }) => (
    <View style={styles.employeeCard}>
      <View style={styles.employeeHeader}>
        <Text style={styles.employeeName}>{item.nome}</Text>
        <View style={styles.employeeActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditEmployee(item)}
          >
            <SafeIcon name="pencil" size={20} color="#2196F3" fallbackText="✎" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteEmployee(item)}
          >
            <SafeIcon name="trash" size={20} color="#f44336" fallbackText="🗑" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.employeeInfo}>
        <View style={styles.infoRow}>
          <SafeIcon name="call" size={16} color="#666" fallbackText="📞" />
          <Text style={styles.infoText}>{item.telefone || 'Não informado'}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <SafeIcon name="location" size={16} color="#666" fallbackText="📍" />
          <Text style={styles.infoText}>
            {item.endereco ? `${item.endereco}, ${item.bairro}` : 'Endereço não informado'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <SafeIcon name="cash" size={16} color="#666" fallbackText="💵" />
          <Text style={styles.infoText}>
            {item.salario ? formatCurrency(item.salario) : 'Salário não informado'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <SafeIcon name="calendar" size={16} color="#666" fallbackText="📅" />
          <Text style={styles.infoText}>
            Admissão: {formatDate(item.dataAdmissao)}
          </Text>
        </View>
      </View>
      
      <View style={styles.employeeStatus}>
        <Text style={[styles.statusText, { color: item.ativo ? '#4CAF50' : '#f44336' }]}>
          {item.ativo ? 'Ativo' : 'Inativo'}
        </Text>
      </View>
    </View>
  );

  if (!hasPermission('funcionarios')) {
    return (
      <View style={styles.accessDenied}>
        <SafeIcon name="lock-closed" size={64} color="#ccc" fallbackText="🔒" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para gerenciar funcionários
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenIdentifier screenName="Admin - Funcionários" />
      {/* Header com busca e botão adicionar */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchIcon}>
            <SafeIcon name="search" size={20} color="#666" fallbackText="🔎" />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar funcionários..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <SafeIcon name="add" size={24} color="#fff" fallbackText="+" />
        </TouchableOpacity>
      </View>

      {/* Lista de funcionários */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Carregando funcionários...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          renderItem={renderEmployee}
          keyExtractor={(item) => String(item._id || item.id || Math.random())}
          contentContainerStyle={[styles.listContainer, filteredEmployees.length === 0 && { flex: 1, justifyContent: 'center' }]}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadEmployees}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <SafeIcon name="people-outline" size={48} color="#ccc" fallbackText="👥" />
              <Text style={{ fontSize: 16, color: '#666', marginTop: 16, textAlign: 'center' }}>
                {searchText ? 'Nenhum funcionário encontrado na busca.' : 'Nenhum funcionário cadastrado.'}
              </Text>
              <TouchableOpacity onPress={loadEmployees} style={{ marginTop: 16, padding: 10 }}>
                <Text style={{ color: '#2196F3', fontWeight: 'bold' }}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de criação/edição */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButton}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
            </Text>
            <TouchableOpacity onPress={handleSaveEmployee}>
              <Text style={styles.saveButton}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.nome}
                onChangeText={(text) => setFormData({ ...formData, nome: text })}
                placeholder="Nome completo"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={formData.telefone}
                onChangeText={(text) => setFormData({ ...formData, telefone: text })}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Endereço</Text>
              <TextInput
                style={styles.input}
                value={formData.endereco}
                onChangeText={(text) => setFormData({ ...formData, endereco: text })}
                placeholder="Rua, número"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Bairro</Text>
              <TextInput
                style={styles.input}
                value={formData.bairro}
                onChangeText={(text) => setFormData({ ...formData, bairro: text })}
                placeholder="Bairro"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Salário</Text>
                <TextInput
                  style={styles.input}
                  value={formData.salario}
                  onChangeText={(text) => setFormData({ ...formData, salario: text })}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Data de Admissão</Text>
                <TextInput
                  style={styles.input}
                  value={formData.dataAdmissao}
                  onChangeText={(text) => setFormData({ ...formData, dataAdmissao: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.switchContainer}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Funcionário Ativo</Text>
                <Switch
                  value={formData.ativo}
                  onValueChange={(value) => setFormData({ ...formData, ativo: value })}
                  trackColor={{ false: '#ccc', true: '#2196F3' }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#2196F3',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  employeeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  employeeActions: {
    flexDirection: 'row',
  },
  editButton: {
    padding: 8,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
  },
  employeeInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  employeeStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  switchContainer: {
    marginTop: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
});