import { useState, useEffect } from 'react';

/**
 * Hook useDebounce - Otimiza buscas e requisições com delay
 * 
 * Utilizador para evitar requisições excessivas durante digitação do usuário.
 * Especialmente útil em campos de busca e filtros em tempo real.
 * 
 * @param value - Valor a ser debounced
 * @param delay - Delay em millisegundos (padrão: 500ms)
 * @returns Valor debounced
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * 
 * useEffect(() => {
 *   if (debouncedSearchTerm.length >= 2) {
 *     // Fazer busca apenas quando parar de digitar por 300ms
 *     searchCustomers(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Criar timer para atualizar o valor debounced após o delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpar o timer se o valor mudar antes do delay
    // Isso previne que o valor seja atualizado prematuramente
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook useDebounceCallback - Versão callback do useDebounce
 * 
 * Útil quando você quer executar uma função específica após o debounce
 * ao invés de apenas obter o valor debounced.
 * 
 * @param callback - Função a ser executada após o debounce
 * @param delay - Delay em millisegundos (padrão: 500ms)
 * @returns Função debounced
 * 
 * @example
 * ```tsx
 * const debouncedSearch = useDebounceCallback((searchTerm: string) => {
 *   if (searchTerm.length >= 2) {
 *     searchCustomers(searchTerm);
 *   }
 * }, 300);
 * 
 * return (
 *   <input 
 *     onChange={(e) => debouncedSearch(e.target.value)}
 *     placeholder="Buscar clientes..."
 *   />
 * );
 * ```
 */
export function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return (...args: Parameters<T>) => {
    // Limpar timeout anterior se existir
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Criar novo timeout
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}

/**
 * Hook useAdvancedDebounce - Versão avançada com mais controles
 * 
 * Oferece controles adicionais como leading edge, max wait e cancelamento manual.
 * 
 * @param value - Valor a ser debounced
 * @param delay - Delay em millisegundos
 * @param options - Opções adicionais
 * @returns Objeto com valor debounced e funções de controle
 */
interface AdvancedDebounceOptions {
  /** Se true, executa imediatamente na primeira chamada */
  leading?: boolean;
  /** Se true, executa na última chamada após o delay */
  trailing?: boolean;
  /** Tempo máximo para aguardar antes de forçar execução */
  maxWait?: number;
}

interface AdvancedDebounceReturn<T> {
  /** Valor debounced atual */
  debouncedValue: T;
  /** Cancela o debounce pendente */
  cancel: () => void;
  /** Força a execução imediata */
  flush: () => void;
  /** Indica se há um debounce pendente */
  isPending: boolean;
}

export function useAdvancedDebounce<T>(
  value: T,
  delay: number = 500,
  options: AdvancedDebounceOptions = {}
): AdvancedDebounceReturn<T> {
  const { leading = false, trailing = true, maxWait } = options;
  
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [maxTimeoutId, setMaxTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [lastCallTime, setLastCallTime] = useState<number>(0);

  const updateValue = () => {
    setDebouncedValue(value);
    setIsPending(false);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
      setMaxTimeoutId(null);
    }
    setIsPending(false);
  };

  const flush = () => {
    cancel();
    updateValue();
  };

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Leading edge - executa imediatamente na primeira chamada
    if (leading && timeSinceLastCall >= delay) {
      updateValue();
      setLastCallTime(now);
      return;
    }

    setIsPending(true);
    setLastCallTime(now);

    // Timer principal
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      if (trailing) {
        updateValue();
      }
      setIsPending(false);
      setTimeoutId(null);
    }, delay);

    setTimeoutId(newTimeoutId);

    // Max wait timer
    if (maxWait && !maxTimeoutId) {
      const newMaxTimeoutId = setTimeout(() => {
        updateValue();
        setMaxTimeoutId(null);
        if (timeoutId) {
          clearTimeout(timeoutId);
          setTimeoutId(null);
        }
      }, maxWait);

      setMaxTimeoutId(newMaxTimeoutId);
    }

    return () => {
      if (newTimeoutId) {
        clearTimeout(newTimeoutId);
      }
    };
  }, [value, delay, leading, trailing, maxWait]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  return {
    debouncedValue,
    cancel,
    flush,
    isPending
  };
}

export default useDebounce;