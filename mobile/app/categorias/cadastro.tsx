import React, { useState, useEffect } from 'react';
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
import { categoryService } from '../../src/services/api';

interface CategoryFormData {
  nome: string;
  descricao: string;
  ativo: boolean;
}

export default function CadastroCategoriaScreen() {
  const { hasPermission } = useAuth() as any;
  const { id } = useLocalSearchParams();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    nome: '',
    descricao: '',
    ativo: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    
    // Feedback explícito para Web (pedido do usuário)
    if (Platform.OS === 'web' && type === 'success') {
        setTimeout(() => {
             alert(text); // Trava a execução até o OK
             router.back();
        }, 100);
        return;
    }

    // Se for sucesso (Mobile), volta após 1.5s
    if (type === 'success') {
        setTimeout(() => {
            router.back();
        }, 1500);
    } else {
        setTimeout(() => setMessage(null), 4000);
    }
  };

  // Carregar dados da categoria para edição
  useEffect(() => {
    if (isEditing && id) {
      loadCategory(id as string);
    }
  }, [isEditing, id]);

  const loadCategory = async (categoryId: string) => {
    setLoadingCategory(true);
    try {
      const response = await categoryService.getById(categoryId);
      const categoria = response.data;

      // Preenchendo os campos com os dados da categoria
      setFormData({
        nome: categoria.nome,
        descricao: categoria.descricao || '',
        ativo: categoria.ativo,
      });
    } catch (error) {
      console.error('Erro ao carregar categoria:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados da categoria.');
      router.back();
    } finally {
      setLoadingCategory(false);
    }
  };

  // Verificar permissão
  if (!hasPermission('produtos')) {
    return (
      <View style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color="#666" />
        <Text style={styles.accessDeniedText}>Acesso Negado</Text>
        <Text style={styles.accessDeniedSubtext}>
          Você não tem permissão para acessar esta tela
        </Text>
      </View>
    );
  }

  if (loadingCategory) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Carregando...</Text>
        </View>
        <View style={styles.accessDenied}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.accessDeniedSubtext}>Carregando dados da categoria...</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      showMessage('error', 'Nome da categoria é obrigatório');
      return;
    }

    try {
      setLoading(true);
      
      const categoryData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim(),
        ativo: formData.ativo,
      };

      if (isEditing && id) {
        // Atualizar categoria existente
        await categoryService.update(id as string, categoryData);
      } else {
        // Criar nova categoria
        await categoryService.create(categoryData);
      }
      
      showMessage('success', isEditing ? 'Categoria atualizada!' : 'Categoria criada!');
      
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showMessage('error', 'Erro ao salvar. Verifique conexao.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof CategoryFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Categoria' : 'Cadastrar Categoria'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {message && (
        <View style={[styles.messageBanner, message.type === 'error' ? styles.errorBanner : styles.successBanner]}>
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          {/* Nome */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Nome da Categoria *</Text>
            <TextInput
              style={styles.input}
              value={formData.nome}
              onChangeText={(text) => updateFormData('nome', text)}
              placeholder="Ex: Bebidas, Petiscos, Pratos Principais"
              placeholderTextColor="#999"
            />
          </View>

          {/* Descrição */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.descricao}
              onChangeText={(text) => updateFormData('descricao', text)}
              placeholder="Descrição opcional da categoria"
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
                <Text style={styles.label}>Categoria Ativa</Text>
                <Text style={styles.switchDescription}>
                  Categorias ativas aparecem na listagem de produtos
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
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Atualizar Categoria' : 'Salvar Categoria'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
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
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
});