import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { unidadeMedidaService } from '../../src/services/api';

interface UnitFormData {
  nome: string;
  sigla: string;
  descricao: string;
  ativo: boolean;
}

export default function CadastroUnidadeScreen() {
  const { hasPermission } = useAuth() as any;
  const params = useLocalSearchParams();
  const unidadeId = params?.id ? Number(params.id) : undefined;
  const isEditing = !!unidadeId;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [formData, setFormData] = useState<UnitFormData>({
    nome: '',
    sigla: '',
    descricao: '',
    ativo: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    
    // Feedback explícito para Web
    if (Platform.OS === 'web' && type === 'success') {
        setTimeout(() => {
             alert(text);
             router.back();
        }, 100);
        return;
    }

    if (type === 'success') {
        setTimeout(() => {
            router.back();
        }, 1500);
    } else {
        setTimeout(() => setMessage(null), 4000);
    }
  };

  // Remover retorno condicional por permissão antes dos hooks
  // if (!hasPermission('produtos')) {
  //   return (
  //     <View style={styles.accessDenied}>
  //       <Ionicons name="lock-closed" size={64} color="#666" />
  //       <Text style={styles.accessDeniedText}>Acesso Negado</Text>
  //       <Text style={styles.accessDeniedSubtext}>
  //         Você não tem permissão para acessar esta tela
  //       </Text>
  //     </View>
  //   );
  // }

  React.useEffect(() => {
    const loadUnit = async () => {
      if (!isEditing || !unidadeId) return;
      try {
        setInitialLoading(true);
        // Buscar via getAll e localizar pelo id (não há getById no serviço)
        const units = await unidadeMedidaService.getAll();
        const unit = Array.isArray(units)
          ? units.find((u: any) => Number(u.id) === Number(unidadeId))
          : undefined;
        if (unit) {
          setFormData({
            nome: unit.nome || '',
            sigla: unit.sigla || '',
            descricao: unit.descricao || '',
            ativo: unit.ativo ?? true,
          });
        }
      } catch (error) {
        console.error('Erro ao carregar unidade:', error);
        Alert.alert('Erro', 'Não foi possível carregar os dados da unidade.');
      } finally {
        setInitialLoading(false);
      }
    };
    loadUnit();
  }, [unidadeId]);

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      showMessage('error', 'Nome da unidade é obrigatório');
      return;
    }

    if (!formData.sigla.trim()) {
      showMessage('error', 'Sigla da unidade é obrigatória');
      return;
    }

    try {
      setLoading(true);
      const unitData = {
        nome: formData.nome.trim(),
        sigla: formData.sigla.trim().toUpperCase(),
        descricao: formData.descricao.trim(),
        ativo: formData.ativo,
      };

      if (isEditing && unidadeId) {
        await unidadeMedidaService.update(unidadeId, unitData);
        showMessage('success', 'Unidade de medida atualizada com sucesso!');
      } else {
        await unidadeMedidaService.create(unitData);
        showMessage('success', 'Unidade de medida cadastrada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      showMessage('error', 'Erro ao salvar unidade de medida. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof UnitFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    !hasPermission('produtos') ? (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para acessar esta tela
        </Text>
      </View>
    ) : (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Editar Unidade' : 'Cadastrar Unidade'}</Text>
          <View style={styles.headerSpacer} />
        </View>

      {message && (
        <View style={[styles.messageBanner, message.type === 'error' ? styles.errorBanner : styles.successBanner]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

        {initialLoading && (
          <View style={{ padding: 16 }}>
            <ActivityIndicator size="large" color="#9C27B0" />
            <Text style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>Carregando unidade...</Text>
          </View>
        )}
        <ScrollView style={styles.content}>
          <View style={styles.form}>
            {/* Nome */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome da Unidade *</Text>
              <TextInput
                style={styles.input}
                value={formData.nome}
                onChangeText={(text) => updateFormData('nome', text)}
                placeholder="Ex: Litro, Quilograma, Unidade, Porção"
                placeholderTextColor="#999"
              />
            </View>

            {/* Sigla */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sigla *</Text>
              <TextInput
                style={styles.input}
                value={formData.sigla}
                onChangeText={(text) => updateFormData('sigla', text.toUpperCase())}
                placeholder="Ex: L, KG, UN, PC"
                placeholderTextColor="#999"
                maxLength={5}
              />
            </View>

            {/* Descrição */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.descricao}
                onChangeText={(text) => updateFormData('descricao', text)}
                placeholder="Descrição opcional da unidade de medida"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Status Ativo */}
            <View style={styles.formGroup}>
              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.label}>Unidade Ativa</Text>
                  <Text style={styles.switchDescription}>
                    Unidades ativas aparecem na listagem de produtos
                  </Text>
                </View>
                <Switch
                  value={formData.ativo}
                  onValueChange={(value) => updateFormData('ativo', value)}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={formData.ativo ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Botão Salvar */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>{isEditing ? 'Atualizar Unidade' : 'Salvar Unidade'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },

  messageBanner: {
    padding: 15,
    margin: 16,
    marginBottom: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  messageText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});