import { useEffect, useRef, useCallback, useState } from 'react';

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  protocols?: string | string[];
}

interface UseWebSocketResult {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  sendMessage: (type: string, data?: any) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketResult {
  const {
    url,
    enabled = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    protocols
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // Limpar timeout de reconexão
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Conectar WebSocket
  const connect = useCallback(() => {
    if (!enabled || !url || connecting || connected) return;

    setConnecting(true);
    setError(null);
    clearReconnectTimeout();

    try {
      const ws = new WebSocket(url, protocols);
      websocketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        
        console.log('WebSocket connected');
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        onConnect?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        onMessage?.(event);
      };

      ws.onclose = (event: CloseEvent) => {
        if (!mountedRef.current) return;

        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnected(false);
        setConnecting(false);
        websocketRef.current = null;

        onDisconnect?.();

        // Tentar reconectar se não foi fechado intencionalmente
        if (enabled && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && enabled) {
              console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
              connect();
            }
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached');
        }
      };

      ws.onerror = (event: Event) => {
        if (!mountedRef.current) return;

        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setConnecting(false);
        
        onError?.(event);
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
      setConnecting(false);
    }
  }, [
    enabled, 
    url, 
    protocols, 
    connecting, 
    connected, 
    onConnect, 
    onMessage, 
    onDisconnect, 
    onError,
    reconnectInterval,
    maxReconnectAttempts,
    clearReconnectTimeout
  ]);

  // Desconectar WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevenir reconexão automática

    if (websocketRef.current) {
      websocketRef.current.close(1000, 'Disconnected by user');
      websocketRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
    setError(null);
  }, [clearReconnectTimeout, maxReconnectAttempts]);

  // Reconectar manualmente
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Enviar mensagem
  const sendMessage = useCallback((type: string, data?: any) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
      websocketRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', type);
    }
  }, []);

  // Conectar automaticamente quando habilitado
  useEffect(() => {
    if (enabled && !connected && !connecting) {
      connect();
    }
    
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled]); // Só reconecta quando enabled muda

  // Cleanup na desmontagem
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();
      if (websocketRef.current) {
        websocketRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [clearReconnectTimeout]);

  return {
    connected,
    connecting,
    error,
    sendMessage,
    connect,
    disconnect,
    reconnect
  };
}

// Hook especializado para notificações
export function useNotificationWebSocket(token?: string) {
  const [authenticated, setAuthenticated] = useState(false);

  const { connected, sendMessage, ...rest } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:5006',
    enabled: !!token,
    onConnect: () => {
      console.log('Notification WebSocket connected');
      if (token) {
        sendMessage('authenticate', token);
      }
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'authenticated') {
          setAuthenticated(true);
          console.log('WebSocket authenticated');
          
          // Subscrever aos canais padrão
          sendMessage('subscribe', ['user', 'system']);
        } else if (data.type === 'auth_error') {
          setAuthenticated(false);
          console.error('WebSocket authentication failed:', data.message);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    },
    onDisconnect: () => {
      setAuthenticated(false);
    }
  });

  // Método para subscrever a canais específicos
  const subscribeToChannels = useCallback((channels: string[]) => {
    if (connected && authenticated) {
      sendMessage('subscribe', channels);
    }
  }, [connected, authenticated, sendMessage]);

  // Método para desinscrever de canais
  const unsubscribeFromChannels = useCallback((channels: string[]) => {
    if (connected && authenticated) {
      sendMessage('unsubscribe', channels);
    }
  }, [connected, authenticated, sendMessage]);

  return {
    connected,
    authenticated,
    subscribeToChannels,
    unsubscribeFromChannels,
    sendMessage,
    ...rest
  };
}