// Sistema de logs para o aplicativo
export class Logger {
  static logs = [];
  static maxLogs = 100;

  static add(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      id: Date.now() + Math.random()
    };
    
    this.logs.unshift(logEntry);
    
    // Limitar número de logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Também logar no console
    if (__DEV__) {
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    }
  }

  static info(message, data) {
    this.add('info', message, data);
  }

  static warn(message, data) {
    this.add('warn', message, data);
  }

  static error(message, data) {
    this.add('error', message, data);
  }

  static debug(message, data) {
    if (__DEV__) {
      this.add('debug', message, data);
    }
  }

  static getLogs() {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
  }

  static exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Helper para logar ações do usuário
export const logUserAction = (action, details = {}) => {
  Logger.info(`Ação do usuário: ${action}`, details);
};

// Helper para logar erros de API
export const logApiError = (endpoint, error, details = {}) => {
  Logger.error(`Erro na API ${endpoint}`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
    ...details
  });
};

// Helper para logar eventos de sincronização
export const logSyncEvent = (event, data = {}) => {
  Logger.info(`Evento de sincronização: ${event}`, data);
};