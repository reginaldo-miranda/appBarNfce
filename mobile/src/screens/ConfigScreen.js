import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ValidationService from '../utils/validation';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@barapp:api_ip';

export default function ConfigScreen({ onConfigComplete }) {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');

  useEffect(() => {
    // Carregar IP salvo
    AsyncStorage.getItem(STORAGE_KEY).then(savedIp => {
      if (savedIp) {
        setIp(savedIp);
      }
    });
  }, []);

  const saveConfig = async () => {
    if (!ip || !port) {
      Alert.alert('Erro', 'IP e Porta são obrigatórios');
      logger.logError('VALIDATION_ERROR', 'ConfigScreen', 'saveConfig', 'Campos obrigatórios vazios');
      return;
    }

    // Validar formato do IP usando o serviço de validação
    if (!ValidationService.isValidIP(ip)) {
      Alert.alert('Erro', ValidationService.getErrorMessage('ip'));
      logger.logError('VALIDATION_ERROR', 'ConfigScreen', 'saveConfig', 'IP inválido: ' + ip);
      return;
    }

    try {
      logger.logAction('CONFIG_SAVE_ATTEMPT', 'ConfigScreen', 'saveConfig', `Tentando salvar configuração IP: ${ip}:${port}`);
      
      await AsyncStorage.setItem(STORAGE_KEY, ip);
      
      // Configurar API
      const apiUrl = `http://${ip}:${port}/api`;
      
      // Testar conexão
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) {
        logger.logAction('CONFIG_SAVE_SUCCESS', 'ConfigScreen', 'saveConfig', 'Configuração salva e conexão estabelecida');
        Alert.alert('Sucesso', 'Conexão estabelecida com sucesso!');
        onConfigComplete(apiUrl);
      } else {
        logger.logWarning('CONFIG_SAVE_PARTIAL', 'ConfigScreen', 'saveConfig', 'IP salvo mas sem conexão com servidor');
        Alert.alert('Aviso', 'IP salvo, mas não foi possível conectar ao servidor');
        onConfigComplete(apiUrl);
      }
    } catch (error) {
      logger.logError('CONFIG_SAVE_ERROR', 'ConfigScreen', 'saveConfig', error.message);
      Alert.alert('Erro', 'Não foi possível salvar configuração: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuração do Sistema</Text>
      <Text style={styles.subtitle}>Digite o IP do servidor</Text>
      
      <TextInput
        style={styles.input}
        placeholder="IP do servidor (ex: 192.168.1.100)"
        value={ip}
        onChangeText={setIp}
        keyboardType="numeric"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Porta (padrão: 3000)"
        value={port}
        onChangeText={setPort}
        keyboardType="numeric"
      />
      
      <Button title="Salvar Configuração" onPress={saveConfig} />
      
      <Text style={styles.help}>
        Dica: O IP deve ser da mesma rede WiFi do seu tablet
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: 'white',
    fontSize: 16,
  },
  help: {
    marginTop: 20,
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});