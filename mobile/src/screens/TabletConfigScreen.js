import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ValidationService from '../utils/validation';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@barapp:tablet_config';

export default function TabletConfigScreen() {
  const [setores, setSetores] = useState([]);
  const [config, setConfig] = useState({
    setorCozinha: null,
    setorBar: null,
    modoExibicao: 'tablet', // tablet ou impressao
    autoRefresh: true,
    refreshInterval: 30,
    somNotificacao: true,
    vibracao: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar configuração salva
      const savedConfig = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig));
      }

      // Carregar setores disponíveis
      const response = await apiService.request({
        method: 'GET',
        url: '/setores'
      });

      if (response.data?.success) {
        setSetores(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Não foi possível carregar as configurações');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      const updatedConfig = { ...config, ...newConfig };
      setConfig(updatedConfig);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
      
      // Aplicar configurações imediatamente
      if (newConfig.modoExibicao) {
        Alert.alert('Atenção', `Modo de exibição alterado para ${newConfig.modoExibicao === 'tablet' ? 'Tablet' : 'Impressão'}`);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      Alert.alert('Erro', 'Não foi possível salvar a configuração');
      return false;
    }
  };

  const selectSetor = async (tipo) => {
    const options = setores.map(setor => ({
      text: setor.nome,
      onPress: () => saveConfig({ [tipo]: setor.id })
    }));

    options.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert(
      `Selecionar Setor ${tipo === 'setorCozinha' ? 'Cozinha' : 'Bar'}`,
      'Escolha o setor correspondente:',
      options
    );
  };

  const getSetorName = (setorId) => {
    const setor = setores.find(s => s.id === setorId);
    return setor ? setor.nome : 'Nenhum';
  };

  const testConnection = async () => {
    try {
      logger.logAction('CONNECTION_TEST', 'TabletConfigScreen', 'testConnection', 'Testando conexão com servidor');
      
      const response = await apiService.request({
        method: 'GET',
        url: '/setor-impressao/list'
      });

      if (response.data?.success) {
        logger.logAction('CONNECTION_SUCCESS', 'TabletConfigScreen', 'testConnection', 'Conexão estabelecida com sucesso');
        Alert.alert('Sucesso', 'Conexão com servidor estabelecida com sucesso!');
      } else {
        logger.logError('CONNECTION_FAILED', 'TabletConfigScreen', 'testConnection', 'Resposta inválida do servidor');
        Alert.alert('Erro', 'Resposta inválida do servidor');
      }
    } catch (error) {
      logger.logError('CONNECTION_ERROR', 'TabletConfigScreen', 'testConnection', error.message);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor. Verifique o IP e a conexão.');
    }
  };

  const resetConfig = async () => {
    Alert.alert(
      'Resetar Configurações',
      'Deseja resetar todas as configurações para o padrão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: async () => {
            logger.logAction('CONFIG_RESET', 'TabletConfigScreen', 'resetConfig', 'Resetando configurações para padrão');
            
            const defaultConfig = {
              setorCozinha: null,
              setorBar: null,
              modoExibicao: 'tablet',
              autoRefresh: true,
              refreshInterval: 30,
              somNotificacao: true,
              vibracao: true
            };
            
            await saveConfig(defaultConfig);
            logger.logAction('CONFIG_RESET_SUCCESS', 'TabletConfigScreen', 'resetConfig', 'Configurações resetadas com sucesso');
            Alert.alert('Sucesso', 'Configurações resetadas com sucesso!');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuração de Setores</Text>
        
        <TouchableOpacity 
          style={styles.configItem}
          onPress={() => selectSetor('setorCozinha')}
        >
          <View style={styles.configLeft}>
            <Ionicons name="restaurant" size={24} color="#4CAF50" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Setor Cozinha</Text>
              <Text style={styles.configValue}>{getSetorName(config.setorCozinha)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.configItem}
          onPress={() => selectSetor('setorBar')}
        >
          <View style={styles.configLeft}>
            <Ionicons name="wine" size={24} color="#2196F3" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Setor Bar</Text>
              <Text style={styles.configValue}>{getSetorName(config.setorBar)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modo de Exibição</Text>
        
        <View style={styles.configItem}>
          <View style={styles.configLeft}>
            <Ionicons name="tablet-portrait" size={24} color="#FF9800" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Exibir em Tablet</Text>
              <Text style={styles.configDescription}>Mostra pedidos na tela do tablet</Text>
            </View>
          </View>
          <Switch
            value={config.modoExibicao === 'tablet'}
            onValueChange={(value) => saveConfig({ modoExibicao: value ? 'tablet' : 'impressao' })}
          />
        </View>

        <View style={styles.configItem}>
          <View style={styles.configLeft}>
            <Ionicons name="print" size={24} color="#9C27B0" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Enviar para Impressão</Text>
              <Text style={styles.configDescription}>Imprime pedidos automaticamente</Text>
            </View>
          </View>
          <Switch
            value={config.modoExibicao === 'impressao'}
            onValueChange={(value) => saveConfig({ modoExibicao: value ? 'impressao' : 'tablet' })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>
        
        <View style={styles.configItem}>
          <View style={styles.configLeft}>
            <Ionicons name="volume-high" size={24} color="#607D8B" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Som de Notificação</Text>
              <Text style={styles.configDescription}>Toca som ao receber novo pedido</Text>
            </View>
          </View>
          <Switch
            value={config.somNotificacao}
            onValueChange={(value) => saveConfig({ somNotificacao: value })}
          />
        </View>

        <View style={styles.configItem}>
          <View style={styles.configLeft}>
            <Ionicons name="phone-portrait" size={24} color="#795548" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Vibração</Text>
              <Text style={styles.configDescription}>Vibra ao receber novo pedido</Text>
            </View>
          </View>
          <Switch
            value={config.vibracao}
            onValueChange={(value) => saveConfig({ vibracao: value })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atualização</Text>
        
        <View style={styles.configItem}>
          <View style={styles.configLeft}>
            <Ionicons name="refresh" size={24} color="#4CAF50" />
            <View style={styles.configText}>
              <Text style={styles.configLabel}>Atualização Automática</Text>
              <Text style={styles.configDescription}>Atualiza pedidos automaticamente</Text>
            </View>
          </View>
          <Switch
            value={config.autoRefresh}
            onValueChange={(value) => saveConfig({ autoRefresh: value })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.actionButton} onPress={testConnection}>
          <Ionicons name="wifi" size={24} color="#007AFF" />
          <Text style={styles.actionButtonText}>Testar Conexão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.resetButton]} onPress={resetConfig}>
          <Ionicons name="refresh-circle" size={24} color="#FF3B30" />
          <Text style={[styles.actionButtonText, styles.resetButtonText]}>Resetar Configurações</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  section: {
    backgroundColor: 'white',
    marginBottom: 15,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  configLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  configText: {
    marginLeft: 15,
    flex: 1,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  configValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  configDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 10,
  },
  resetButton: {
    backgroundColor: '#fff5f5',
  },
  resetButtonText: {
    color: '#FF3B30',
  },
});