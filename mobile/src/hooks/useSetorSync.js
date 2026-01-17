import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';

/**
 * Hook para sincronização em tempo real de pedidos do setor
 * Usa WebSocket para receber atualizações instantâneas
 */
export function useSetorSync(setorId, onUpdate) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = () => {
    if (!setorId || !onUpdate) return;

    const wsUrl = apiService.getWsUrl();
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket conectado para setor:', setorId);
        setConnected(true);
        
        // Enviar identificação do setor
        ws.send(JSON.stringify({
          type: 'register_setor',
          setorId: setorId
        }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.type === 'sale:update' && payload.payload) {
            onUpdate(payload.payload);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket erro:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket desconectado');
        setConnected(false);
        
        // Tentar reconectar após 5 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Tentando reconectar WebSocket...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      setConnected(false);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [setorId]);

  return {
    connected,
    reconnect: connect
  };
}