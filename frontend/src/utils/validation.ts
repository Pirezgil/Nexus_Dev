// ERP Nexus - Frontend Validation Utilities
// Enhanced validation functions with detailed error feedback

/**
 * UUID validation utilities
 */
export const uuidValidation = {
  /**
   * Check if string is a valid UUID v4 format
   */
  isValidUUID: (uuid: string): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  /**
   * Validate UUID with detailed error information
   */
  validateUUID: (uuid: string, fieldName = 'ID'): { isValid: boolean; error?: string; suggestions?: string[] } => {
    if (!uuid) {
      return {
        isValid: false,
        error: `${fieldName} é obrigatório`,
        suggestions: ['Forneça um ID válido']
      };
    }

    if (typeof uuid !== 'string') {
      return {
        isValid: false,
        error: `${fieldName} deve ser uma string`,
        suggestions: ['Verifique o tipo do dado fornecido']
      };
    }

    if (!uuidValidation.isValidUUID(uuid)) {
      return {
        isValid: false,
        error: `${fieldName} possui formato inválido`,
        suggestions: [
          'Verifique se o ID foi copiado corretamente',
          'O formato deve ser: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          'Utilize apenas caracteres hexadecimais (0-9, a-f)'
        ]
      };
    }

    return { isValid: true };
  },

  /**
   * Sanitize UUID string (remove extra whitespace, convert to lowercase)
   */
  sanitizeUUID: (uuid: string): string => {
    return uuid?.trim().toLowerCase() || '';
  }
};

/**
 * Customer validation utilities
 */
export const customerValidation = {
  /**
   * Validate customer ID before operations
   */
  validateCustomerId: (customerId: string): { isValid: boolean; error?: string; suggestions?: string[] } => {
    // Basic validation - check if ID exists and is not empty
    if (!customerId || typeof customerId !== 'string' || customerId.trim().length === 0) {
      return {
        isValid: false,
        error: 'ID do cliente é obrigatório',
        suggestions: ['Forneça um ID válido do cliente']
      };
    }

    // Allow both UUID format and custom IDs (like test-customer-cache-123)
    // This is more flexible for test data and special cases
    const trimmedId = customerId.trim();
    
    // Check if it's a valid UUID or a reasonable custom ID
    const isValidUUID = uuidValidation.isValidUUID(trimmedId);
    const isValidCustomId = /^[a-zA-Z0-9\-_]+$/.test(trimmedId) && trimmedId.length >= 3 && trimmedId.length <= 255;
    
    if (!isValidUUID && !isValidCustomId) {
      return {
        isValid: false,
        error: 'ID do cliente possui formato inválido',
        suggestions: [
          'Use formato UUID padrão (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)',
          'Ou use um ID customizado com letras, números, hífens e underscores (3-255 caracteres)',
          'Evite caracteres especiais como espaços ou símbolos'
        ]
      };
    }

    return { isValid: true };
  },

  /**
   * Validate customer data for creation/update
   */
  validateCustomerData: (data: any): { 
    isValid: boolean; 
    errors: Record<string, string>; 
    suggestions: string[] 
  } => {
    const errors: Record<string, string> = {};
    const suggestions: string[] = [];

    // Required name validation
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.name = 'Nome é obrigatório';
      suggestions.push('Forneça o nome completo do cliente');
    } else if (data.name.trim().length < 2) {
      errors.name = 'Nome deve ter pelo menos 2 caracteres';
      suggestions.push('Use o nome completo do cliente');
    } else if (data.name.length > 255) {
      errors.name = 'Nome muito longo (máximo 255 caracteres)';
      suggestions.push('Use uma versão mais concisa do nome');
    }

    // Email validation (optional)
    if (data.email && data.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.email = 'Email possui formato inválido';
        suggestions.push('Verifique o formato do email (exemplo@dominio.com)');
      }
    }

    // Phone validation (optional)
    if (data.phone && data.phone.trim() !== '') {
      const cleanPhone = data.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        errors.phone = 'Telefone deve ter 10 ou 11 dígitos';
        suggestions.push('Use o formato: (11) 99999-9999 ou (11) 9999-9999');
      }
    }

    // Document validation (CPF/CNPJ - optional)
    if (data.document && data.document.trim() !== '') {
      const cleanDoc = data.document.replace(/\D/g, '');
      if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        errors.document = 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)';
        suggestions.push('Verifique se todos os números foram informados');
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      suggestions
    };
  }
};

/**
 * General form validation utilities
 */
export const formValidation = {
  /**
   * Check if required fields are present
   */
  validateRequiredFields: (data: Record<string, any>, requiredFields: string[]): {
    isValid: boolean;
    missingFields: string[];
    error?: string;
  } => {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || 
      data[field] === null || 
      (typeof data[field] === 'string' && data[field].trim() === '')
    );

    if (missingFields.length > 0) {
      return {
        isValid: false,
        missingFields,
        error: `Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`
      };
    }

    return { isValid: true, missingFields: [] };
  },

  /**
   * Sanitize string inputs
   */
  sanitizeString: (value: string): string => {
    return value?.toString().trim() || '';
  },

  /**
   * Check string length constraints
   */
  validateStringLength: (value: string, fieldName: string, min = 0, max = Infinity): {
    isValid: boolean;
    error?: string;
  } => {
    const length = value?.length || 0;
    
    if (length < min) {
      return {
        isValid: false,
        error: `${fieldName} deve ter pelo menos ${min} caracteres`
      };
    }
    
    if (length > max) {
      return {
        isValid: false,
        error: `${fieldName} deve ter no máximo ${max} caracteres`
      };
    }

    return { isValid: true };
  }
};

/**
 * Error formatting utilities
 */
export const errorFormatting = {
  /**
   * Format API error for user display
   */
  formatApiError: (error: any): {
    title: string;
    message: string;
    suggestions: string[];
    type: 'validation' | 'not_found' | 'unauthorized' | 'forbidden' | 'conflict' | 'server_error';
  } => {
    const status = error?.response?.status || error?.status || 500;
    const errorData = error?.response?.data || error?.data || {};
    const details = errorData.details || {};

    switch (status) {
      case 400:
        return {
          title: 'Dados inválidos',
          message: errorData.message || 'Os dados fornecidos são inválidos',
          suggestions: details.suggestions || ['Verifique os dados informados e tente novamente'],
          type: 'validation'
        };

      case 401:
        return {
          title: 'Não autorizado',
          message: errorData.message || 'Você não tem permissão para realizar esta ação',
          suggestions: details.suggestions || ['Verifique sua autenticação', 'Faça login novamente se necessário'],
          type: 'unauthorized'
        };

      case 403:
        return {
          title: 'Acesso negado',
          message: errorData.message || 'Acesso negado para esta operação',
          suggestions: details.suggestions || ['Contate o administrador para obter as permissões necessárias'],
          type: 'forbidden'
        };

      case 404:
        return {
          title: 'Não encontrado',
          message: errorData.message || 'O item solicitado não foi encontrado',
          suggestions: details.suggestions || [
            'Verifique se o ID está correto',
            'O item pode ter sido removido anteriormente',
            'Atualize a lista e tente novamente'
          ],
          type: 'not_found'
        };

      case 409:
        return {
          title: 'Conflito de dados',
          message: errorData.message || 'Já existe um registro com estes dados',
          suggestions: details.suggestions || ['Verifique os dados duplicados', 'Use informações diferentes'],
          type: 'conflict'
        };

      case 422:
        return {
          title: 'Dados inválidos',
          message: errorData.message || 'Os dados não atendem aos critérios de validação',
          suggestions: details.suggestions || ['Corrija os erros indicados', 'Verifique todos os campos obrigatórios'],
          type: 'validation'
        };

      default:
        return {
          title: 'Erro do servidor',
          message: errorData.message || 'Ocorreu um erro interno no servidor',
          suggestions: details.suggestions || [
            'Tente novamente em alguns minutos',
            'Se o problema persistir, contate o suporte técnico'
          ],
          type: 'server_error'
        };
    }
  },

  /**
   * Get user-friendly error message for common scenarios
   */
  getCommonErrorMessage: (scenario: string): string => {
    const messages: Record<string, string> = {
      'customer_not_found': 'Cliente não encontrado ou não pertence à sua empresa',
      'customer_delete_failed': 'Não foi possível excluir o cliente',
      'invalid_customer_id': 'ID do cliente possui formato inválido',
      'network_error': 'Erro de conexão. Verifique sua internet e tente novamente',
      'session_expired': 'Sua sessão expirou. Faça login novamente',
      'insufficient_permissions': 'Você não tem permissão para realizar esta ação'
    };

    return messages[scenario] || 'Ocorreu um erro inesperado';
  }
};

/**
 * Pre-validation hooks for common operations
 */
export const preValidation = {
  /**
   * Validate before customer deletion
   */
  beforeCustomerDelete: (customerId: string): { 
    canProceed: boolean; 
    errors: string[]; 
    warnings: string[] 
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate customer ID
    const uuidValidation = customerValidation.validateCustomerId(customerId);
    if (!uuidValidation.isValid) {
      errors.push(uuidValidation.error!);
    }

    // Add warnings about the deletion action
    warnings.push('Esta ação não pode ser desfeita');
    warnings.push('Todos os dados relacionados (notas, interações) serão removidos');

    return {
      canProceed: errors.length === 0,
      errors,
      warnings
    };
  }
};