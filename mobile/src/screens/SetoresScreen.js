import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import ValidationService from '../utils/validation';
import { logger } from '../utils/logger';

export default function SetoresScreen() {
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSetor, setEditingSetor] = useState(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modoEnvio, setModoEnvio] = useState('impressao');
  const [whatsappDestino, setWhatsappDestino] = useState('');
  const [ativo, setAtivo] = useState(true);

  const modoEnvioOptions = [
    { label: 'Impressão', value: 'impressao' },
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Ambos', value: 'ambos' }
  ];

  useEffect(() => {
    loadSetores();
  }, []);

  const loadSetores = async () => {
    try {
      setLoading(true);
      const response = await apiService.request({
        method: 'GET',
        url: '/setores'
      });

      if (response.data?.success) {
        setSetores(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
      Alert.alert('Erro', 'Não foi possível carregar os setores');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (setor = null) => {
    if (setor) {
      setEditingSetor(setor);
      setNome(setor.nome);
      setDescricao(setor.descricao || '');
      setModoEnvio(setor.modoEnvio);
      setWhatsappDestino(setor.whatsappDestino || '');
      setAtivo(setor.ativo);
    } else {
      setEditingSetor(null);
      setNome('');
      setDescricao('');
      setModoEnvio('impressao');
      setWhatsappDestino('');
      setAtivo(true);
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingSetor(null);
  };

  const validateForm = () => {
    // Validação usando o serviço de validação
    if (!ValidationService.isValidSetorName(nome)) {
      Alert.alert('Erro', ValidationService.getErrorMessage('setorName'));
      logger.logError('VALIDATION_ERROR', 'SetorScreen', 'validateForm', 'Nome inválido');
      return false;
    }

    if ((modoEnvio === 'whatsapp' || modoEnvio === 'ambos') && !whatsappDestino.trim()) {
      Alert.alert('Erro', 'WhatsApp destino é obrigatório para este modo de envio');
      logger.logError('VALIDATION_ERROR', 'SetorScreen', 'validateForm', 'WhatsApp obrigatório');
      return false;
    }

    if (whatsappDestino.trim() && !ValidationService.isValidPhone(whatsappDestino)) {
      Alert.alert('Erro', ValidationService.getErrorMessage('phone'));
      logger.logError('VALIDATION_ERROR', 'SetorScreen', 'validateForm', 'WhatsApp inválido');
      return false;
    }

    logger.logAction('VALIDATION_SUCCESS', 'SetorScreen', 'validateForm', 'Formulário validado com sucesso');
    return true;
  };

  const saveSetor = async () => {
    if (!validateForm()) return;

    try {
      logger.logAction('SAVE_ATTEMPT', 'SetorScreen', 'saveSetor', `Tentando salvar setor: ${nome}`);
      
      const data = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        modoEnvio,
        whatsappDestino: whatsappDestino.trim() || null,
        ativo
      };

      const response = editingSetor
        ? await apiService.request({
            method: 'PUT',
            url: `/setores/${editingSetor.id}`,
            data
          })
        : await apiService.request({
            method: 'POST',
            url: '/setores',
            data
          });

      if (response.data?.success) {
        logger.logAction('SAVE_SUCCESS', 'SetorScreen', 'saveSetor', `Setor ${nome} salvo com sucesso`);
        Alert.alert('Sucesso', response.data.message);
        closeModal();
        loadSetores();
      } else {
        logger.logError('SAVE_ERROR', 'SetorScreen', 'saveSetor', response.data?.message || 'Erro ao salvar setor');
        Alert.alert('Erro', response.data?.message || 'Erro ao salvar setor');
      }
    } catch (error) {
      logger.logError('SAVE_EXCEPTION', 'SetorScreen', 'saveSetor', error.message);
      console.error('Erro ao salvar setor:', error);
      Alert.alert('Erro', 'Não foi possível salvar o setor');
    }
  };

  const deleteSetor = (setor) => {
    Alert.alert(
      'Confirmar exclusão',
      `Deseja realmente excluir o setor "${setor.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.request({
                method: 'DELETE',
                url: `/setores/${setor.id}`
              });

              if (response.data?.success) {
                Alert.alert('Sucesso', 'Setor excluído com sucesso');
                loadSetores();
              } else {
                Alert.alert('Erro', response.data?.message || 'Erro ao excluir setor');
              }
            } catch (error) {
              console.error('Erro ao excluir setor:', error);
              Alert.alert('Erro', 'Não foi possível excluir o setor');
            }
          }
        }
      ]
    );
  };

  const renderSetor = ({ item }) => (
    <View style={[styles.setorCard, !item.ativo && styles.setorInativo]}>
      <View style={styles.setorHeader}>
        <Text style={styles.setorNome}>{item.nome}</Text>
        <View style={styles.setorActions}>
          <TouchableOpacity onPress={() => openModal(item)} style={styles.actionButton}>
            <Ionicons name="create-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteSetor(item)} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      
      {item.descricao && (
        <Text style={styles.setorDescricao}>{item.descricao}</Text>
      )}
      
      <View style={styles.setorInfo}>
        <Text style={styles.infoLabel}>Modo de envio:</Text>
        <Text style={styles.infoValue}>
          {modoEnvioOptions.find(opt => opt.value === item.modoEnvio)?.label}
        </Text>
      </View>
      
      {item.whatsappDestino && (
        <View style={styles.setorInfo}>
          <Text style={styles.infoLabel}>WhatsApp:</Text>
          <Text style={styles.infoValue}>{item.whatsappDestino}</Text>
        </View>
      )}
      
      <View style={styles.setorStatus}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusValue, item.ativo ? styles.statusAtivo : styles.statusInativo]}>
          {item.ativo ? 'Ativo' : 'Inativo'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Carregando setores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Setores de Impressão</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={setores}
        renderItem={renderSetor}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum setor cadastrado</Text>
            <Text style={styles.emptySubtext}>Toque em + para adicionar um novo setor</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingSetor ? 'Editar Setor' : 'Novo Setor'}
            </Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Nome do Setor *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Cozinha, Bar, Delivery"
              value={nome}
              onChangeText={setNome}
            />

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descrição do setor (opcional)"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.label}>Modo de Envio *</Text>
            <View style={styles.radioContainer}>
              {modoEnvioOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.radioButton,
                    modoEnvio === option.value && styles.radioButtonSelected
                  ]}
                  onPress={() => setModoEnvio(option.value)}
                >
                  <Text style={[
                    styles.radioText,
                    modoEnvio === option.value && styles.radioTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(modoEnvio === 'whatsapp' || modoEnvio === 'ambos') && (
              <>
                <Text style={styles.label}>WhatsApp Destino *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DDD + Número (ex: 11987654321)"
                  value={whatsappDestino}
                  onChangeText={setWhatsappDestino}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Ativo</Text>
              <Switch
                value={ativo}
                onValueChange={setAtivo}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={saveSetor}>
              <Text style={styles.saveButtonText}>
                {editingSetor ? 'Atualizar' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  listContainer: {
    padding: 15,
  },
  setorCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  setorInativo: {
    opacity: 0.6,
  },
  setorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  setorNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  setorActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 10,
  },
  setorDescricao: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  setorInfo: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginRight: 5,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
  setorStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginRight: 5,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusAtivo: {
    color: '#4CAF50',
  },
  statusInativo: {
    color: '#f44336',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  radioButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioText: {
    fontSize: 14,
    color: '#333',
  },
  radioTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});