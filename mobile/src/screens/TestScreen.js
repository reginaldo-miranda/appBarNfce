import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { runAllTests } from '../utils/tests';
import { logger } from '../utils/logger';

export default function TestScreen() {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState([]);

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    try {
      logger.logAction('TEST_START', 'TestScreen', 'runTests', 'Iniciando testes automatizados');
      
      // Capturar logs do console durante os testes
      const originalLog = console.log;
      const originalError = console.error;
      const logs = [];
      
      console.log = (...args) => {
        logs.push({ type: 'log', message: args.join(' ') });
        originalLog.apply(console, args);
      };
      
      console.error = (...args) => {
        logs.push({ type: 'error', message: args.join(' ') });
        originalError.apply(console, args);
      };
      
      // Executar testes
      await runAllTests();
      
      // Restaurar console
      console.log = originalLog;
      console.error = originalError;
      
      setTestResults(logs);
      
      logger.logAction('TEST_SUCCESS', 'TestScreen', 'runTests', 'Testes concluídos com sucesso');
      Alert.alert('Sucesso', 'Todos os testes foram executados! Verifique os resultados abaixo.');
      
    } catch (error) {
      logger.logError('TEST_ERROR', 'TestScreen', 'runTests', error.message);
      Alert.alert('Erro', 'Erro ao executar testes: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const exportLogs = async () => {
    try {
      const logs = await logger.exportLogs();
      Alert.alert('Sucesso', 'Logs exportados com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Erro ao exportar logs: ' + error.message);
    }
  };

  const clearLogs = () => {
    Alert.alert(
      'Confirmar',
      'Deseja limpar todos os logs?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpar', 
          style: 'destructive',
          onPress: () => {
            logger.clearLogs();
            Alert.alert('Sucesso', 'Logs limpos com sucesso!');
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flask" size={32} color="#4CAF50" />
        <Text style={styles.title}>Testes e Diagnóstico</Text>
        <Text style={styles.subtitle}>Execute testes e verifique logs do sistema</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Testes Automatizados</Text>
        <TouchableOpacity 
          style={[styles.button, testing && styles.buttonDisabled]} 
          onPress={runTests}
          disabled={testing}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.buttonText}>
            {testing ? 'Executando Testes...' : 'Executar Todos os Testes'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Logs do Sistema</Text>
        <TouchableOpacity style={styles.button} onPress={exportLogs}>
          <Ionicons name="download" size={20} color="#fff" />
          <Text style={styles.buttonText}>Exportar Logs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearLogs}>
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.buttonText}>Limpar Logs</Text>
        </TouchableOpacity>
      </View>

      {testResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resultados dos Testes</Text>
          <View style={styles.resultsContainer}>
            {testResults.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Ionicons 
                  name={log.type === 'error' ? 'close-circle' : 'checkmark-circle'} 
                  size={16} 
                  color={log.type === 'error' ? '#f44336' : '#4CAF50'} 
                />
                <Text style={[styles.logText, log.type === 'error' && styles.errorText]}>
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações do Sistema</Text>
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="phone-portrait" size={20} color="#666" />
            <Text style={styles.infoText}>Dispositivo: Mobile</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cube" size={20} color="#666" />
            <Text style={styles.infoText}>Plataforma: React Native</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.infoText}>Último teste: {new Date().toLocaleString('pt-BR')}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  dangerButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  resultsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    maxHeight: 300,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  errorText: {
    color: '#f44336',
  },
  infoContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
});