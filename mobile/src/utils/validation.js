/**
 * Serviço de validação para dados do sistema
 */

export const ValidationService = {
  /**
   * Valida um endereço IP
   */
  isValidIP: (ip) => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  },

  /**
   * Valida um número de telefone/WhatsApp
   */
  isValidPhone: (phone) => {
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    // Verifica se tem entre 10 e 11 dígitos (DDD + número)
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  },

  /**
   * Valida um nome de setor
   */
  isValidSetorName: (name) => {
    return name && name.trim().length >= 3 && name.trim().length <= 50;
  },

  /**
   * Valida um email
   */
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Valida um CPF
   */
  isValidCPF: (cpf) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se é uma sequência de números iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Calcula o primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let firstDigit = 11 - (sum % 11);
    if (firstDigit === 10 || firstDigit === 11) {
      firstDigit = 0;
    }
    
    // Calcula o segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    let secondDigit = 11 - (sum % 11);
    if (secondDigit === 10 || secondDigit === 11) {
      secondDigit = 0;
    }
    
    return parseInt(cleanCPF.charAt(9)) === firstDigit && 
           parseInt(cleanCPF.charAt(10)) === secondDigit;
  },

  /**
   * Valida se um valor é numérico e positivo
   */
  isValidPositiveNumber: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },

  /**
   * Valida se uma string não está vazia
   */
  isRequired: (value) => {
    return value && value.trim().length > 0;
  },

  /**
   * Valida o tamanho de uma string
   */
  hasLength: (value, min, max) => {
    if (!value) return false;
    const length = value.trim().length;
    return length >= min && length <= max;
  },

  /**
   * Formata um número de telefone
   */
  formatPhone: (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
    } else if (cleanPhone.length === 11) {
      return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    }
    return phone;
  },

  /**
   * Formata um CPF
   */
  formatCPF: (cpf) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length === 11) {
      return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9)}`;
    }
    return cpf;
  },

  /**
   * Retorna mensagens de erro apropriadas
   */
  getErrorMessage: (field, validation) => {
    const messages = {
      ip: 'Endereço IP inválido. Use formato: 192.168.1.1',
      phone: 'Telefone inválido. Use DDD + número (10 ou 11 dígitos)',
      setorName: 'Nome do setor deve ter entre 3 e 50 caracteres',
      email: 'Email inválido. Use formato: email@dominio.com',
      cpf: 'CPF inválido. Verifique os dígitos',
      positiveNumber: 'Valor deve ser um número positivo',
      required: 'Este campo é obrigatório',
      length: `Campo deve ter entre ${validation.min} e ${validation.max} caracteres`,
      default: 'Valor inválido para este campo'
    };

    return messages[field] || messages.default;
  }
};

export default ValidationService;