/**
 * ContactValidator - Validador de Contatos (Email e Telefone)
 * 
 * Implementa validação de emails e telefones brasileiros
 * Inclui formatação e sanitização de dados
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class ContactValidator {
  
  // Lista de domínios temporários/suspeitos não permitidos
  private static suspiciousDomains = [
    'tempmail.org', 
    '10minutemail.com', 
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    'temp-mail.org',
    'getairmail.com',
    'yopmail.com'
  ];
  
  // Códigos de área válidos no Brasil
  private static validAreaCodes = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
    21, 22, 24, // Rio de Janeiro
    27, 28, // Espírito Santo
    31, 32, 33, 34, 35, 37, 38, // Minas Gerais
    41, 42, 43, 44, 45, 46, // Paraná
    47, 48, 49, // Santa Catarina
    51, 53, 54, 55, // Rio Grande do Sul
    61, // Distrito Federal
    62, 64, // Goiás
    65, 66, // Mato Grosso
    67, // Mato Grosso do Sul
    68, // Acre
    69, // Rondônia
    71, 73, 74, 75, 77, // Bahia
    79, // Sergipe
    81, 87, // Pernambuco
    82, // Alagoas
    83, // Paraíba
    84, // Rio Grande do Norte
    85, 88, // Ceará
    86, 89, // Piauí
    91, 93, 94, // Pará
    92, 97, // Amazonas
    95, // Roraima
    96, // Amapá
    98, 99, // Maranhão
  ];
  
  /**
   * Valida endereço de email
   * @param email - Endereço de email
   * @returns ValidationResult com resultado da validação
   */
  static validateEmail(email: string): ValidationResult {
    if (!email) return { valid: false, error: 'Email é obrigatório' }
    
    // Remove espaços em branco
    email = email.trim().toLowerCase()
    
    // Regex básico para email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Formato de email inválido' }
    }
    
    // Verifica se o email não é muito longo
    if (email.length > 254) {
      return { valid: false, error: 'Email muito longo (máximo 254 caracteres)' }
    }
    
    // Verifica a parte local (antes do @)
    const [localPart, domainPart] = email.split('@')
    
    if (localPart.length > 64) {
      return { valid: false, error: 'Parte local do email muito longa' }
    }
    
    if (localPart.length === 0) {
      return { valid: false, error: 'Parte local do email não pode estar vazia' }
    }
    
    // Verifica se não começa ou termina com ponto
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return { valid: false, error: 'Email não pode começar ou terminar com ponto' }
    }
    
    // Verifica pontos consecutivos
    if (localPart.includes('..')) {
      return { valid: false, error: 'Email não pode ter pontos consecutivos' }
    }
    
    // Verifica domínios suspeitos ou temporários
    if (this.suspiciousDomains.includes(domainPart)) {
      return { valid: false, error: 'Email temporário ou suspeito não é permitido' }
    }
    
    // Verifica se o domínio tem formato válido
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(domainPart)) {
      return { valid: false, error: 'Domínio do email inválido' }
    }
    
    return { valid: true }
  }
  
  /**
   * Valida número de telefone brasileiro
   * @param phone - Número de telefone com ou sem formatação
   * @returns ValidationResult com resultado da validação
   */
  static validatePhone(phone: string): ValidationResult {
    if (!phone) return { valid: false, error: 'Telefone é obrigatório' }
    
    const cleanPhone = phone.replace(/\D/g, '')
    
    // Aceitar formatos: 11999999999, 1199999999, 99999999
    if (cleanPhone.length < 8 || cleanPhone.length > 11) {
      return { valid: false, error: 'Telefone deve ter entre 8 e 11 dígitos' }
    }
    
    // Se tem 11 dígitos, deve ser celular com DDD
    if (cleanPhone.length === 11) {
      const areaCode = parseInt(cleanPhone.substr(0, 2))
      
      if (!this.validAreaCodes.includes(areaCode)) {
        return { valid: false, error: 'Código de área inválido' }
      }
      
      // Celular deve ter 9 como primeiro dígito após área (padrão brasileiro)
      if (cleanPhone[2] !== '9') {
        return { valid: false, error: 'Número de celular deve começar com 9 após o DDD' }
      }
    }
    
    // Se tem 10 dígitos, deve ser telefone fixo com DDD
    if (cleanPhone.length === 10) {
      const areaCode = parseInt(cleanPhone.substr(0, 2))
      
      if (!this.validAreaCodes.includes(areaCode)) {
        return { valid: false, error: 'Código de área inválido' }
      }
      
      // Telefone fixo não pode começar com 9 (seria celular)
      if (cleanPhone[2] === '9') {
        return { valid: false, error: 'Telefone fixo não pode começar com 9. Use 11 dígitos para celular' }
      }
    }
    
    // Verifica se não são todos números iguais
    if (/^(\d)\1+$/.test(cleanPhone)) {
      return { valid: false, error: 'Número de telefone inválido' }
    }
    
    return { valid: true }
  }
  
  /**
   * Formata número de telefone para exibição
   * @param phone - Telefone apenas números
   * @returns Telefone formatado
   */
  static formatPhone(phone: string): string {
    const clean = phone.replace(/\D/g, '')
    
    if (clean.length === 11) {
      // (11) 99999-9999
      return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    } else if (clean.length === 10) {
      // (11) 9999-9999
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else if (clean.length === 9) {
      // 99999-9999
      return clean.replace(/(\d{5})(\d{4})/, '$1-$2')
    } else if (clean.length === 8) {
      // 9999-9999
      return clean.replace(/(\d{4})(\d{4})/, '$1-$2')
    }
    
    return phone // Retorna original se não conseguir formatar
  }
  
  /**
   * Remove formatação do email, padronizando para lowercase
   * @param email - Email com ou sem formatação
   * @returns Email sanitizado
   */
  static sanitizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }
  
  /**
   * Remove formatação do telefone, deixando apenas números
   * @param phone - Telefone com ou sem formatação
   * @returns Telefone apenas com números
   */
  static sanitizePhone(phone: string): string {
    return phone.replace(/\D/g, '')
  }
  
  /**
   * Detecta tipo de telefone baseado no tamanho
   * @param phone - Telefone com ou sem formatação
   * @returns Tipo detectado
   */
  static detectPhoneType(phone: string): 'mobile' | 'landline' | 'short' | 'unknown' {
    const clean = phone.replace(/\D/g, '')
    
    if (clean.length === 11 && clean[2] === '9') {
      return 'mobile' // Celular com DDD
    } else if (clean.length === 10 && clean[2] !== '9') {
      return 'landline' // Fixo com DDD
    } else if (clean.length === 8 || clean.length === 9) {
      return 'short' // Sem DDD
    }
    
    return 'unknown'
  }
  
  /**
   * Verifica se o telefone é móvel (celular)
   * @param phone - Telefone com ou sem formatação
   * @returns true se for celular
   */
  static isMobile(phone: string): boolean {
    return this.detectPhoneType(phone) === 'mobile'
  }
  
  /**
   * Extrai DDD do telefone (se houver)
   * @param phone - Telefone com ou sem formatação
   * @returns DDD ou null se não houver
   */
  static extractAreaCode(phone: string): string | null {
    const clean = phone.replace(/\D/g, '')
    
    if (clean.length >= 10) {
      return clean.substr(0, 2)
    }
    
    return null
  }
}