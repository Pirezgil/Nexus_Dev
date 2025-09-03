/**
 * HTTP Headers Constants
 * 
 * Define constantes para nomes de headers HTTP utilizados em todo o sistema ERP Nexus.
 * Esta é a Fonte Única da Verdade para padronização de headers entre módulos.
 * 
 * IMPORTANTE: Para leitura de headers no Express.js, use sempre toLowerCase() 
 * pois o Express normaliza os nomes dos headers para minúsculas.
 * 
 * @example
 * // Para DEFINIR header (Set):
 * proxyReq.setHeader(HTTP_HEADERS.COMPANY_ID, companyId);
 * 
 * @example  
 * // Para LER header (Get):
 * const companyId = req.headers[HTTP_HEADERS.COMPANY_ID.toLowerCase()];
 */

export const HTTP_HEADERS = {
  /** Header para identificação da empresa no contexto multi-tenant */
  COMPANY_ID: 'X-Company-ID',
  
  /** Header para identificação do usuário */
  USER_ID: 'X-User-ID',
  
  /** Header para identificação do papel do usuário */
  USER_ROLE: 'X-User-Role',
  
  /** Header para identificação da origem da requisição (API Gateway) */
  GATEWAY_SOURCE: 'X-Gateway-Source',
  
  /** Header para timestamp do gateway */
  GATEWAY_TIMESTAMP: 'X-Gateway-Timestamp',
  
  /** Header para ID da requisição */
  GATEWAY_REQUEST_ID: 'X-Gateway-Request-ID'
} as const;

/**
 * Utility function para obter nome do header em lowercase para leitura
 * @param headerName - Nome do header (ex: HTTP_HEADERS.COMPANY_ID)
 * @returns string - Nome do header em minúsculas para leitura no Express
 * 
 * @example
 * const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)];
 */
export function getHeaderKey(headerName: string): string {
  return headerName.toLowerCase();
}

export default HTTP_HEADERS;