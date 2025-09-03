/**
 * Configuração Centralizada de Timeouts - ERP Nexus
 * Política Hierárquica de Timeouts para Comunicação Inter-módulos
 * 
 * PRINCÍPIOS:
 * 1. Camadas mais externas têm timeouts maiores
 * 2. Valores configuráveis via variáveis de ambiente
 * 3. Fallbacks seguros em caso de configuração ausente
 * 4. Prevenção de estados inconsistentes na cascata de timeouts
 */

// Valores padrão da política hierárquica (em milissegundos)
const DEFAULT_TIMEOUTS = {
  // Health checks - deve ser rápido para detectar problemas
  HEALTH_CHECK: 5000,
  
  // Operações rápidas - refresh token, validações simples
  QUICK_OPERATIONS: 10000,
  
  // Serviços internos - comunicação entre módulos (ModuleIntegrator)
  INTERNAL_SERVICE: 25000,
  
  // Cliente API - frontend para gateway (deve ser maior que INTERNAL_SERVICE)
  API_CLIENT: 30000,
  
  // Gateway proxy - camada mais externa (uploads, processamentos longos)
  GATEWAY: 60000,
} as const;

/**
 * Configuração de Timeouts Centralizada
 * Lê valores de variáveis de ambiente com fallback para valores seguros
 */
export const TIMEOUT_CONFIG = {
  // Health checks (5 segundos)
  HEALTH_CHECK: parseInt(process.env.TIMEOUT_HEALTH_CHECK || DEFAULT_TIMEOUTS.HEALTH_CHECK.toString(), 10),
  
  // Operações rápidas - refresh token, validações (10 segundos)
  QUICK_OPERATIONS: parseInt(process.env.TIMEOUT_QUICK_OPERATIONS || DEFAULT_TIMEOUTS.QUICK_OPERATIONS.toString(), 10),
  
  // Comunicação entre serviços internos - ModuleIntegrator (25 segundos)
  INTERNAL_SERVICE: parseInt(process.env.TIMEOUT_INTERNAL_SERVICE || DEFAULT_TIMEOUTS.INTERNAL_SERVICE.toString(), 10),
  
  // Cliente API - frontend para gateway (30 segundos) 
  API_CLIENT: parseInt(process.env.TIMEOUT_API_CLIENT || DEFAULT_TIMEOUTS.API_CLIENT.toString(), 10),
  
  // Gateway proxy - uploads e processamentos longos (60 segundos)
  GATEWAY: parseInt(process.env.TIMEOUT_GATEWAY || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
  
  // Operações específicas por módulo
  GATEWAY_CRM: parseInt(process.env.TIMEOUT_GATEWAY_CRM || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
  GATEWAY_SERVICES: parseInt(process.env.TIMEOUT_GATEWAY_SERVICES || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
  GATEWAY_AGENDAMENTO: parseInt(process.env.TIMEOUT_GATEWAY_AGENDAMENTO || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
  
  // Integrações externas (WhatsApp, etc.)
  EXTERNAL_API: parseInt(process.env.TIMEOUT_EXTERNAL_API || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
} as const;

/**
 * Validação da Política de Timeouts
 * Garante que a hierarquia está correta
 */
export const validateTimeoutHierarchy = (): void => {
  const config = TIMEOUT_CONFIG;
  
  // Verificar ordem hierárquica: HEALTH_CHECK < QUICK_OPERATIONS < INTERNAL_SERVICE < API_CLIENT < GATEWAY
  if (config.HEALTH_CHECK >= config.QUICK_OPERATIONS) {
    console.warn('⚠️ Warning: TIMEOUT_HEALTH_CHECK should be smaller than TIMEOUT_QUICK_OPERATIONS');
  }
  
  if (config.QUICK_OPERATIONS >= config.INTERNAL_SERVICE) {
    console.warn('⚠️ Warning: TIMEOUT_QUICK_OPERATIONS should be smaller than TIMEOUT_INTERNAL_SERVICE');
  }
  
  if (config.INTERNAL_SERVICE >= config.API_CLIENT) {
    console.warn('⚠️ Warning: TIMEOUT_INTERNAL_SERVICE should be smaller than TIMEOUT_API_CLIENT');
  }
  
  if (config.API_CLIENT >= config.GATEWAY) {
    console.warn('⚠️ Warning: TIMEOUT_API_CLIENT should be smaller than TIMEOUT_GATEWAY');
  }
  
  console.log('✅ Timeout Configuration Loaded:', {
    HEALTH_CHECK: `${config.HEALTH_CHECK}ms`,
    QUICK_OPERATIONS: `${config.QUICK_OPERATIONS}ms`, 
    INTERNAL_SERVICE: `${config.INTERNAL_SERVICE}ms`,
    API_CLIENT: `${config.API_CLIENT}ms`,
    GATEWAY: `${config.GATEWAY}ms`,
    hierarchy: 'HEALTH_CHECK < QUICK_OPERATIONS < INTERNAL_SERVICE < API_CLIENT < GATEWAY'
  });
};

/**
 * Helper para timeouts baseados no contexto da operação
 */
export const getTimeoutForOperation = (operation: string): number => {
  switch (operation.toLowerCase()) {
    case 'health':
    case 'ping':
      return TIMEOUT_CONFIG.HEALTH_CHECK;
      
    case 'auth':
    case 'refresh':
    case 'validate':
      return TIMEOUT_CONFIG.QUICK_OPERATIONS;
      
    case 'internal':
    case 'integration':
    case 'cross-module':
      return TIMEOUT_CONFIG.INTERNAL_SERVICE;
      
    case 'frontend':
    case 'client':
      return TIMEOUT_CONFIG.API_CLIENT;
      
    case 'upload':
    case 'report':
    case 'export':
    case 'gateway':
      return TIMEOUT_CONFIG.GATEWAY;
      
    case 'whatsapp':
    case 'external':
      return TIMEOUT_CONFIG.EXTERNAL_API;
      
    default:
      return TIMEOUT_CONFIG.INTERNAL_SERVICE; // Fallback seguro
  }
};

/**
 * Configuração de Axios com timeout apropriado
 */
export const createTimeoutConfig = (operationType: string) => ({
  timeout: getTimeoutForOperation(operationType),
  // Headers para debugging
  headers: {
    'X-Timeout-Policy': `${getTimeoutForOperation(operationType)}ms`,
    'X-Operation-Type': operationType,
  }
});

// Executar validação na inicialização
validateTimeoutHierarchy();

export default TIMEOUT_CONFIG;