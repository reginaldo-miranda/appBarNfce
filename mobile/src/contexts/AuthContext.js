import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, systemService, clearApiBaseUrl, getCurrentBaseUrl, testApiConnection } from '../services/api';

// Interface para o contexto de autenticação
const defaultAuthContext = {
  user: null,
  loading: false,
  isAuthenticated: false,
  login: async (credentials) => ({ success: false, message: 'Contexto não inicializado' }),
  logout: async () => {},
  hasPermission: () => false,
  clearAllStorage: async () => {},
};

const AuthContext = createContext(defaultAuthContext);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  console.log('🚀 AuthProvider: Inicializando com loading:', loading, 'isAuthenticated:', isAuthenticated);

  // Verificar se há usuário logado ao inicializar
  useEffect(() => {
    console.log('🚀 AuthProvider: useEffect executado - chamando checkAuthState');
    checkAuthState();
  }, []);

  const clearAllData = async () => {
    try {
      await AsyncStorage.clear();
      console.log('🧹 AuthContext: AsyncStorage limpo completamente');
    } catch (error) {
      console.error('🧹 AuthContext: Erro ao limpar AsyncStorage:', error);
    }
  };

  const checkAuthState = async () => {
    try {
      setLoading(true);
      console.log('🔍 AuthContext: Verificando estado de autenticação...');
      
      // Verificar se AsyncStorage está disponível
      if (!AsyncStorage) {
        console.log('🔍 AuthContext: AsyncStorage não disponível - assumindo não autenticado');
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      
      console.log('🔍 AuthContext: Token encontrado:', !!token);
      console.log('🔍 AuthContext: UserData encontrado:', !!userData);

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setIsAuthenticated(true);
          console.log('🔍 AuthContext: Sessão restaurada para usuário:', parsedUser?.email || parsedUser?.nome);
        } catch (parseError) {
          console.error('🔍 AuthContext: Erro ao fazer parse dos dados do usuário:', parseError);
          // Limpar dados corrompidos
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userData');
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('🔍 AuthContext: Erro ao verificar autenticação:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
      console.log('🔍 AuthContext: Verificação concluída');
    }
  };

  const login = async (credentials) => {
    try {
      console.log('🔐 AuthContext: Iniciando login com:', credentials.email);
      setLoading(true);
      
      const response = await authService.login(credentials);
      console.log('🔐 AuthContext: Resposta completa do login:', response);
      console.log('🔐 AuthContext: Status da resposta:', response.status);
      console.log('🔐 AuthContext: Dados da resposta:', response.data);
      
      if (response.data && response.data.token) {
        console.log('🔐 AuthContext: Login bem-sucedido, salvando dados...');
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
        
        console.log('🔐 AuthContext: Dados do usuário salvos:', response.data.user);
        setUser(response.data.user);
        setIsAuthenticated(true);
        console.log('🔐 AuthContext: Usuário autenticado com sucesso!');
        
        return { success: true, data: response.data };
      }
      
      console.log('🔐 AuthContext: Login falhou - sem token na resposta');
      return { success: false, message: 'Resposta inválida do servidor' };
    } catch (error) {
      const safeMsg = typeof error === 'object' && error !== null
        ? (error.message ?? 'Erro desconhecido')
        : String(error ?? 'Erro desconhecido');
      const safeResp = (error && typeof error === 'object' && error.response) ? error.response : undefined;
      const safeStatus = safeResp?.status ?? 0;
      const serverMessage =
        safeResp?.data?.message ??
        safeResp?.data?.error ??
        safeMsg;

      console.error('🔐 AuthContext: Erro detalhado no login:', error);
      console.error('🔐 AuthContext: Erro status:', safeStatus);
      console.error('🔐 AuthContext: Mensagem derivada:', serverMessage);

      let errorMessage = 'Erro ao conectar com o servidor';
      if (safeResp) {
        errorMessage = serverMessage || `Erro ${safeStatus}`;
      } else if (error?.request) {
        errorMessage = 'Não foi possível conectar com o servidor';
      } else {
        errorMessage = serverMessage;
      }

      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  };



  const logout = async () => {
    try {
      setLoading(true);
      
      // Tentar fazer shutdown/logout no servidor
      try {
        await systemService.shutdown();
      } catch (error) {
        console.warn('Erro ao encerrar servidor:', error);
      }
      
      // Limpar dados locais
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para limpar completamente o AsyncStorage (para debug)
  const clearAllStorage = async () => {
    try {
      console.log('🧹 AuthContext: Limpando todo o AsyncStorage...');
      await AsyncStorage.clear();
      setUser(null);
      setIsAuthenticated(false);
      console.log('🧹 AuthContext: AsyncStorage limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar AsyncStorage:', error);
    }
  };

  // Funções para verificar permissões
  const hasPermission = (permission) => {
    if (!user) {
      return false;
    }
    if (user.tipo === 'admin') {
      return true;
    }
    const hasAccess = user.permissoes?.[permission] || false;
    return hasAccess;
  };

  const isAdmin = () => {
    return user?.tipo === 'admin';
  };

  const isFuncionario = () => {
    return user?.tipo === 'funcionario';
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    checkAuthState,
    clearAllStorage,
    hasPermission,
    isAdmin,
    isFuncionario,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;