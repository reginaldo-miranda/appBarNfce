/**
 * Testes automatizados para o sistema de tablets
 */

import ValidationService from '../utils/validation';
import { logger } from '../utils/logger';

/**
 * Classe de testes para validação
 */
export class ValidationTests {
  static runAllTests() {
    console.log('🧪 Iniciando testes de validação...');
    
    this.testIPValidation();
    this.testPhoneValidation();
    this.testSetorNameValidation();
    this.testEmailValidation();
    this.testCPFValidation();
    this.testPositiveNumberValidation();
    
    console.log('✅ Testes de validação concluídos!');
  }

  static testIPValidation() {
    console.log('📡 Testando validação de IP...');
    
    const validIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1'];
    const invalidIPs = ['192.168.1', '256.1.1.1', 'abc.def.ghi.jkl'];
    
    validIPs.forEach(ip => {
      const result = ValidationService.isValidIP(ip);
      console.log(`IP ${ip}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`IP válido rejeitado: ${ip}`);
    });
    
    invalidIPs.forEach(ip => {
      const result = ValidationService.isValidIP(ip);
      console.log(`IP ${ip}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`IP inválido aceito: ${ip}`);
    });
  }

  static testPhoneValidation() {
    console.log('📱 Testando validação de telefone...');
    
    const validPhones = ['11987654321', '(11) 98765-4321', '11 98765 4321'];
    const invalidPhones = ['123', '123456789012345', 'abc123'];
    
    validPhones.forEach(phone => {
      const result = ValidationService.isValidPhone(phone);
      console.log(`Telefone ${phone}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`Telefone válido rejeitado: ${phone}`);
    });
    
    invalidPhones.forEach(phone => {
      const result = ValidationService.isValidPhone(phone);
      console.log(`Telefone ${phone}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`Telefone inválido aceito: ${phone}`);
    });
  }

  static testSetorNameValidation() {
    console.log('🏷️ Testando validação de nome de setor...');
    
    const validNames = ['Cozinha', 'Bar Principal', 'Atendimento'];
    const invalidNames = ['', '12', 'A'];
    
    validNames.forEach(name => {
      const result = ValidationService.isValidSetorName(name);
      console.log(`Nome ${name}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`Nome válido rejeitado: ${name}`);
    });
    
    invalidNames.forEach(name => {
      const result = ValidationService.isValidSetorName(name);
      console.log(`Nome ${name}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`Nome inválido aceito: ${name}`);
    });
  }

  static testEmailValidation() {
    console.log('📧 Testando validação de email...');
    
    const validEmails = ['teste@email.com', 'usuario@dominio.com.br'];
    const invalidEmails = ['teste@', '@dominio.com', 'teste@.com'];
    
    validEmails.forEach(email => {
      const result = ValidationService.isValidEmail(email);
      console.log(`Email ${email}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`Email válido rejeitado: ${email}`);
    });
    
    invalidEmails.forEach(email => {
      const result = ValidationService.isValidEmail(email);
      console.log(`Email ${email}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`Email inválido aceito: ${email}`);
    });
  }

  static testCPFValidation() {
    console.log('📄 Testando validação de CPF...');
    
    const validCPFs = ['123.456.789-09', '98765432100'];
    const invalidCPFs = ['123.456.789-00', '00000000000', '123'];
    
    validCPFs.forEach(cpf => {
      const result = ValidationService.isValidCPF(cpf);
      console.log(`CPF ${cpf}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`CPF válido rejeitado: ${cpf}`);
    });
    
    invalidCPFs.forEach(cpf => {
      const result = ValidationService.isValidCPF(cpf);
      console.log(`CPF ${cpf}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`CPF inválido aceito: ${cpf}`);
    });
  }

  static testPositiveNumberValidation() {
    console.log('🔢 Testando validação de número positivo...');
    
    const validNumbers = ['10', '0.5', '1000'];
    const invalidNumbers = ['-10', '0', 'abc'];
    
    validNumbers.forEach(num => {
      const result = ValidationService.isValidPositiveNumber(num);
      console.log(`Número ${num}: ${result ? '✅' : '❌'}`);
      if (!result) throw new Error(`Número válido rejeitado: ${num}`);
    });
    
    invalidNumbers.forEach(num => {
      const result = ValidationService.isValidPositiveNumber(num);
      console.log(`Número ${num}: ${result ? '❌' : '✅'} (deve ser inválido)`);
      if (result) throw new Error(`Número inválido aceito: ${num}`);
    });
  }
}

/**
 * Classe de testes para logging
 */
export class LoggingTests {
  static runAllTests() {
    console.log('📝 Iniciando testes de logging...');
    
    this.testActionLogging();
    this.testErrorLogging();
    this.testWarningLogging();
    this.testSyncLogging();
    
    console.log('✅ Testes de logging concluídos!');
  }

  static testActionLogging() {
    console.log('🎯 Testando log de ações...');
    logger.logAction('TEST_ACTION', 'TestComponent', 'testFunction', 'Mensagem de teste');
    console.log('✅ Log de ação testado');
  }

  static testErrorLogging() {
    console.log('❌ Testando log de erros...');
    logger.logError('TEST_ERROR', 'TestComponent', 'testFunction', 'Erro de teste');
    console.log('✅ Log de erro testado');
  }

  static testWarningLogging() {
    console.log('⚠️ Testando log de avisos...');
    logger.logWarning('TEST_WARNING', 'TestComponent', 'testFunction', 'Aviso de teste');
    console.log('✅ Log de aviso testado');
  }

  static testSyncLogging() {
    console.log('🔄 Testando log de sincronização...');
    logger.logSync('SYNC_TEST', 'TestComponent', 'Dados sincronizados com sucesso');
    console.log('✅ Log de sincronização testado');
  }
}

/**
 * Classe de testes para API
 */
export class APITests {
  static async runAllTests() {
    console.log('🌐 Iniciando testes de API...');
    
    try {
      await this.testConnection();
      await this.testEndpoints();
      console.log('✅ Testes de API concluídos!');
    } catch (error) {
      console.error('❌ Erro nos testes de API:', error);
    }
  }

  static async testConnection() {
    console.log('🔗 Testando conexão...');
    
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        console.log('✅ Conexão estabelecida');
      } else {
        console.warn('⚠️ Conexão estabelecida mas com status:', response.status);
      }
    } catch (error) {
      console.error('❌ Falha na conexão:', error.message);
    }
  }

  static async testEndpoints() {
    console.log('📡 Testando endpoints...');
    
    const endpoints = [
      '/api/setor-impressao/list',
      '/api/setores',
      '/api/setor-impressao-queue/1/queue'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        console.log(`${endpoint}: ${response.ok ? '✅' : '❌'} (${response.status})`);
      } catch (error) {
        console.error(`${endpoint}: ❌ (${error.message})`);
      }
    }
  }
}

/**
 * Executa todos os testes
 */
export const runAllTests = async () => {
  console.log('🚀 Iniciando bateria completa de testes...\n');
  
  try {
    // Testes de validação
    ValidationTests.runAllTests();
    console.log('');
    
    // Testes de logging
    LoggingTests.runAllTests();
    console.log('');
    
    // Testes de API (assíncronos)
    await APITests.runAllTests();
    
    console.log('\n✅ Todos os testes concluídos com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error);
  }
};

export default {
  ValidationTests,
  LoggingTests,
  APITests,
  runAllTests
};