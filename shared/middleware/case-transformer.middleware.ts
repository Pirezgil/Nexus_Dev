/**
 * Case Transformer Middleware
 * 
 * Middleware para transformação automática de nomenclatura de campos entre camelCase e snake_case
 * no API Gateway do Nexus ERP. Resolve inconsistências sistêmicas de nomenclatura identificadas
 * na auditoria de fluxo de dados.
 * 
 * Funcionalidades:
 * - Intercepta requisições: converte camelCase → snake_case no req.body
 * - Intercepta respostas: converte snake_case → camelCase no res.json
 * - Processamento recursivo para objetos aninhados e arrays
 * - Funções puras e testáveis seguindo princípios SOLID
 * 
 * @author Backend Team - Nexus ERP
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Interface para tipos suportados pelo sistema de transformação
 */
type TransformableValue = string | number | boolean | null | undefined | TransformableObject | TransformableValue[];

/**
 * Interface para objetos que podem ser transformados
 */
interface TransformableObject {
  [key: string]: TransformableValue;
}

/**
 * Interface para configuração de logs (se disponível)
 */
interface Logger {
  debug?: (message: string, data?: any) => void;
  error?: (message: string, error?: any) => void;
}

/**
 * Logger simples para debug (fallback caso não haja logger disponível)
 */
const logger: Logger = {
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[CaseTransformer] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[CaseTransformer] ${message}`, error || '');
  }
};

/**
 * Converte string de camelCase para snake_case
 * 
 * Esta função é pura e não produz efeitos colaterais, seguindo princípios de programação funcional.
 * Utiliza regex para identificar letras maiúsculas e convertê-las para minúsculas precedidas de underscore.
 * 
 * @param str - String em camelCase para conversão
 * @returns String convertida para snake_case
 * 
 * @example
 * ```typescript
 * toSnakeCase('firstName') // returns 'first_name'
 * toSnakeCase('isActive') // returns 'is_active'
 * toSnakeCase('userAccountSettings') // returns 'user_account_settings'
 * ```
 */
export const toSnakeCase = (str: string): string => {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  return str
    .replace(/([A-Z])/g, '_$1')  // Adiciona underscore antes de letras maiúsculas
    .toLowerCase()               // Converte tudo para minúsculas
    .replace(/^_/, '');          // Remove underscore inicial se existir
};

/**
 * Converte string de snake_case para camelCase
 * 
 * Esta função é pura e não produz efeitos colaterais. Utiliza regex para identificar
 * padrões de underscore seguido por letra minúscula e convertê-los para letra maiúscula.
 * 
 * @param str - String em snake_case para conversão
 * @returns String convertida para camelCase
 * 
 * @example
 * ```typescript
 * toCamelCase('first_name') // returns 'firstName'
 * toCamelCase('is_active') // returns 'isActive'
 * toCamelCase('user_account_settings') // returns 'userAccountSettings'
 * ```
 */
export const toCamelCase = (str: string): string => {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  return str
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()); // Converte _x para X
};

/**
 * Aplica transformação de chaves de um objeto usando a função de conversão fornecida
 * 
 * Esta função implementa o padrão de recursão para navegação em estruturas de dados complexas.
 * Segue o Princípio da Responsabilidade Única (SRP) ao focar exclusivamente na transformação de chaves.
 * Suporta:
 * - Objetos aninhados (recursão)
 * - Arrays de objetos
 * - Valores primitivos (preservados sem modificação)
 * - Valores null e undefined (preservados)
 * 
 * @param obj - Objeto, array ou valor primitivo para transformação
 * @param converter - Função de conversão de strings (toSnakeCase ou toCamelCase)
 * @returns Objeto com chaves transformadas mantendo a estrutura original
 * 
 * @example
 * ```typescript
 * const input = { 
 *   firstName: 'João', 
 *   userPrefs: { 
 *     autoSave: true,
 *     notifications: [{ isEnabled: true }]
 *   } 
 * };
 * 
 * convertKeys(input, toSnakeCase);
 * // returns: {
 * //   first_name: 'João',
 * //   user_prefs: {
 * //     auto_save: true,
 * //     notifications: [{ is_enabled: true }]
 * //   }
 * // }
 * ```
 */
export const convertKeys = (obj: TransformableValue, converter: (key: string) => string): TransformableValue => {
  // Tratamento de casos base para recursão
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Tratamento de tipos primitivos
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Tratamento de arrays - aplica recursão para cada elemento
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeys(item, converter));
  }
  
  // Tratamento de objetos - aplica conversão nas chaves e recursão nos valores
  const converted: TransformableObject = {};
  
  Object.keys(obj as TransformableObject).forEach(key => {
    const value = (obj as TransformableObject)[key];
    const convertedKey = converter(key);
    
    // Recursão para valores que são objetos ou arrays
    converted[convertedKey] = convertKeys(value, converter);
  });
  
  return converted;
};

/**
 * Valida se o objeto pode ser processado pelo sistema de transformação
 * 
 * Implementa validação defensiva para evitar processamento desnecessário ou erros.
 * Segue o padrão fail-fast para identificar rapidamente casos que não precisam de processamento.
 * 
 * @param obj - Objeto a ser validado
 * @returns true se o objeto pode ser processado, false caso contrário
 */
const isProcessableObject = (obj: any): obj is TransformableObject => {
  return obj !== null && 
         obj !== undefined && 
         typeof obj === 'object' && 
         !Array.isArray(obj) &&
         Object.keys(obj).length > 0;
};

/**
 * Processa dados da requisição convertendo camelCase para snake_case
 * 
 * Esta função encapsula a lógica específica de transformação para requisições HTTP.
 * Implementa o padrão Command para encapsular a operação de transformação.
 * Inclui logging para auditoria e debug em ambiente de desenvolvimento.
 * 
 * @param data - Dados do body da requisição para processamento
 * @param requestId - ID da requisição para correlação de logs (opcional)
 * @returns Dados transformados com chaves em snake_case
 */
const processRequestData = (data: any, requestId?: string): any => {
  try {
    if (!isProcessableObject(data)) {
      logger.debug('Request data não é processável', { requestId, dataType: typeof data });
      return data;
    }
    
    const transformedData = convertKeys(data, toSnakeCase);
    
    logger.debug('Request data transformado com sucesso', { 
      requestId,
      originalKeys: Object.keys(data),
      transformedKeys: Object.keys(transformedData as object)
    });
    
    return transformedData;
    
  } catch (error) {
    logger.error('Erro no processamento de request data', { requestId, error });
    // Retorna dados originais em caso de erro para evitar quebra do sistema
    return data;
  }
};

/**
 * Processa dados da resposta convertendo snake_case para camelCase
 * 
 * Esta função encapsula a lógica específica de transformação para respostas HTTP.
 * Preserva a estrutura padrão de resposta da API ({ success, data, error, meta }).
 * Implementa tratamento defensivo para evitar corrupção de dados.
 * 
 * @param data - Dados da resposta para processamento
 * @param requestId - ID da requisição para correlação de logs (opcional)
 * @returns Dados transformados com chaves em camelCase
 */
const processResponseData = (data: any, requestId?: string): any => {
  try {
    if (!isProcessableObject(data)) {
      logger.debug('Response data não é processável', { requestId, dataType: typeof data });
      return data;
    }
    
    // Preserva estrutura padrão de resposta da API se existir
    if (data.hasOwnProperty('success') || data.hasOwnProperty('data') || data.hasOwnProperty('error')) {
      const transformedResponse = {
        success: data.success,
        data: data.data ? convertKeys(data.data, toCamelCase) : data.data,
        error: data.error,
        meta: data.meta ? convertKeys(data.meta, toCamelCase) : data.meta
      };
      
      logger.debug('Response data (formato API) transformado com sucesso', { requestId });
      
      return transformedResponse;
    }
    
    // Para dados que não seguem o padrão de resposta da API
    const transformedData = convertKeys(data, toCamelCase);
    
    logger.debug('Response data transformado com sucesso', { requestId });
    
    return transformedData;
    
  } catch (error) {
    logger.error('Erro no processamento de response data', { requestId, error });
    // Retorna dados originais em caso de erro para evitar quebra do sistema
    return data;
  }
};

/**
 * Middleware principal de transformação de nomenclatura de campos
 * 
 * Este middleware implementa a interceptação bidirecional de requisições e respostas HTTP:
 * 
 * 1. **Interceptação de Requisição (Request):**
 *    - Processa req.body convertendo camelCase → snake_case
 *    - Permite que módulos backend recebam dados em sua convenção esperada
 * 
 * 2. **Interceptação de Resposta (Response):**
 *    - Sobrescreve res.json para interceptar dados antes do envio
 *    - Converte snake_case → camelCase automaticamente
 *    - Garante que frontend sempre receba dados em camelCase
 * 
 * **Características de Robustez:**
 * - Não quebra o sistema em caso de erro (fail-safe)
 * - Preserva dados originais se transformação falhar
 * - Suporta processamento de objetos complexos e arrays
 * - Logs detalhados para auditoria e debugging
 * 
 * **Padrões Implementados:**
 * - Chain of Responsibility: permite que outros middlewares continuem a execução
 * - Decorator: adiciona funcionalidade de transformação sem modificar código existente
 * - Template Method: define estrutura de processamento com pontos de extensão
 * 
 * @param req - Objeto Request do Express.js
 * @param res - Objeto Response do Express.js  
 * @param next - Função next para continuar cadeia de middlewares
 * 
 * @example
 * ```typescript
 * // Aplicação no Express.js
 * app.use('/api', caseTransformerMiddleware);
 * 
 * // Requisição com camelCase será convertida automaticamente:
 * // POST /api/users { firstName: "João", isActive: true }
 * // Backend recebe: { first_name: "João", is_active: true }
 * 
 * // Resposta com snake_case será convertida automaticamente:
 * // Backend responde: { success: true, data: { first_name: "João", created_at: "2024-01-01" }}
 * // Frontend recebe: { success: true, data: { firstName: "João", createdAt: "2024-01-01" }}
 * ```
 */
export const caseTransformerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Gera ID único para rastreamento desta requisição específica
  const requestId = (req as any).requestId || Math.random().toString(36).substr(2, 9);
  
  try {
    // === TRANSFORMAÇÃO DE ENTRADA (REQUEST) ===
    // Processa body da requisição se existir e for um objeto
    if (req.body && typeof req.body === 'object') {
      const originalBody = req.body;
      
      // Aplicar transformação camelCase → snake_case
      req.body = processRequestData(originalBody, requestId);
      
      logger.debug('Middleware aplicado: request body transformado', {
        requestId,
        method: req.method,
        path: req.path,
        hasBody: !!req.body
      });
    }
    
    // === INTERCEPTAÇÃO DE RESPOSTA ===
    // Preserva referência original do método res.json
    const originalJsonMethod = res.json;
    
    // Sobrescreve res.json com lógica de transformação
    res.json = function(data: any) {
      try {
        // Aplica transformação snake_case → camelCase
        const transformedData = processResponseData(data, requestId);
        
        logger.debug('Middleware aplicado: response data transformado', {
          requestId,
          method: req.method,
          path: req.path,
          hasData: !!transformedData
        });
        
        // Chama método original com dados transformados
        return originalJsonMethod.call(this, transformedData);
        
      } catch (error) {
        // Em caso de erro, usar dados originais para evitar quebra do sistema
        logger.error('Erro na transformação de response', { requestId, error });
        return originalJsonMethod.call(this, data);
      }
    };
    
    // Continua execução da cadeia de middlewares
    next();
    
  } catch (error) {
    // Log do erro mas continua execução para não quebrar o sistema
    logger.error('Erro no middleware de transformação de case', { requestId, error });
    next();
  }
};

/**
 * Exporta o middleware como default para facilitar importação
 */
export default caseTransformerMiddleware;