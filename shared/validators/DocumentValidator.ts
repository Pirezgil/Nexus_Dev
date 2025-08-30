/**
 * DocumentValidator - Validador de Documentos Brasileiros
 * 
 * Implementa validação completa de CPF e CNPJ conforme algoritmos oficiais
 * Inclui formatação e sanitização de dados
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class DocumentValidator {
  
  /**
   * Valida CPF brasileiro usando algoritmo oficial
   * @param cpf - CPF com ou sem formatação
   * @returns ValidationResult com resultado da validação
   */
  static validateCPF(cpf: string): ValidationResult {
    if (!cpf) return { valid: false, error: 'CPF é obrigatório' }
    
    // Remove caracteres especiais
    const cleanCPF = cpf.replace(/\D/g, '')
    
    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) {
      return { valid: false, error: 'CPF deve ter 11 dígitos' }
    }
    
    // Verifica se não são todos dígitos iguais (ex: 11111111111)
    if (/^(\d)\1+$/.test(cleanCPF)) {
      return { valid: false, error: 'CPF inválido' }
    }
    
    // Algoritmo de validação CPF - Primeiro dígito verificador
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF[i]) * (10 - i)
    }
    
    let remainder = sum % 11
    let digit1 = remainder < 2 ? 0 : 11 - remainder
    
    if (digit1 !== parseInt(cleanCPF[9])) {
      return { valid: false, error: 'CPF inválido' }
    }
    
    // Segundo dígito verificador
    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF[i]) * (11 - i)
    }
    
    remainder = sum % 11
    let digit2 = remainder < 2 ? 0 : 11 - remainder
    
    if (digit2 !== parseInt(cleanCPF[10])) {
      return { valid: false, error: 'CPF inválido' }
    }
    
    return { valid: true }
  }
  
  /**
   * Valida CNPJ brasileiro usando algoritmo oficial
   * @param cnpj - CNPJ com ou sem formatação
   * @returns ValidationResult com resultado da validação
   */
  static validateCNPJ(cnpj: string): ValidationResult {
    if (!cnpj) return { valid: false, error: 'CNPJ é obrigatório' }
    
    const cleanCNPJ = cnpj.replace(/\D/g, '')
    
    if (cleanCNPJ.length !== 14) {
      return { valid: false, error: 'CNPJ deve ter 14 dígitos' }
    }
    
    // Verifica se não são todos dígitos iguais
    if (/^(\d)\1+$/.test(cleanCNPJ)) {
      return { valid: false, error: 'CNPJ inválido' }
    }
    
    // Algoritmo de validação CNPJ
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    
    // Primeiro dígito verificador
    let sum = 0
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanCNPJ[i]) * weights1[i]
    }
    
    let remainder = sum % 11
    let digit1 = remainder < 2 ? 0 : 11 - remainder
    
    if (digit1 !== parseInt(cleanCNPJ[12])) {
      return { valid: false, error: 'CNPJ inválido' }
    }
    
    // Segundo dígito verificador
    sum = 0
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanCNPJ[i]) * weights2[i]
    }
    
    remainder = sum % 11
    let digit2 = remainder < 2 ? 0 : 11 - remainder
    
    if (digit2 !== parseInt(cleanCNPJ[13])) {
      return { valid: false, error: 'CNPJ inválido' }
    }
    
    return { valid: true }
  }
  
  /**
   * Valida documento (CPF ou CNPJ) com auto-detecção de tipo
   * @param document - Documento com ou sem formatação
   * @param type - Forçar tipo específico (opcional)
   * @returns ValidationResult com resultado da validação
   */
  static validateDocument(document: string, type?: 'cpf' | 'cnpj'): ValidationResult {
    if (!document) return { valid: false, error: 'Documento é obrigatório' }
    
    const cleanDoc = document.replace(/\D/g, '')
    
    // Auto-detectar tipo se não especificado
    if (!type) {
      if (cleanDoc.length === 11) {
        type = 'cpf'
      } else if (cleanDoc.length === 14) {
        type = 'cnpj'
      } else {
        return { valid: false, error: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)' }
      }
    }
    
    return type === 'cpf' ? this.validateCPF(document) : this.validateCNPJ(document)
  }
  
  /**
   * Formata CPF para exibição (111.222.333-44)
   * @param cpf - CPF apenas números
   * @returns CPF formatado
   */
  static formatCPF(cpf: string): string {
    const clean = cpf.replace(/\D/g, '')
    if (clean.length !== 11) return cpf // Retorna original se não for válido
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  
  /**
   * Formata CNPJ para exibição (11.222.333/0001-44)
   * @param cnpj - CNPJ apenas números  
   * @returns CNPJ formatado
   */
  static formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '')
    if (clean.length !== 14) return cnpj // Retorna original se não for válido
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  
  /**
   * Formata documento automaticamente baseado no tamanho
   * @param document - Documento apenas números
   * @returns Documento formatado
   */
  static formatDocument(document: string): string {
    const clean = document.replace(/\D/g, '')
    
    if (clean.length === 11) {
      return this.formatCPF(clean)
    } else if (clean.length === 14) {
      return this.formatCNPJ(clean)
    }
    
    return document // Retorna original se não conseguir identificar
  }
  
  /**
   * Remove formatação do documento, deixando apenas números
   * @param document - Documento com ou sem formatação
   * @returns Documento apenas com números
   */
  static sanitizeDocument(document: string): string {
    return document.replace(/\D/g, '')
  }
  
  /**
   * Detecta tipo do documento baseado no tamanho
   * @param document - Documento com ou sem formatação
   * @returns Tipo detectado ou null se inválido
   */
  static detectDocumentType(document: string): 'cpf' | 'cnpj' | null {
    const clean = document.replace(/\D/g, '')
    
    if (clean.length === 11) return 'cpf'
    if (clean.length === 14) return 'cnpj'
    
    return null
  }
}