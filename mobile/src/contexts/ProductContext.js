import React, { createContext, useContext, useState, useCallback } from 'react';

const ProductContext = createContext();

export const useProduct = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProduct deve ser usado dentro de um ProductProvider');
  }
  return context;
};

export const ProductProvider = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastAction, setLastAction] = useState(null);

  // Função para disparar refresh na listagem
  const triggerRefresh = useCallback((action = 'update') => {
    setRefreshTrigger(prev => prev + 1);
    setLastAction(action);
  }, []);

  // Função para mostrar mensagem de sucesso
  const showSuccessMessage = useCallback((message) => {
    // Esta função pode ser expandida para mostrar toast ou outras notificações
    console.log('Success:', message);
  }, []);

  const value = {
    refreshTrigger,
    lastAction,
    triggerRefresh,
    showSuccessMessage,
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
};