/**
 * Testes unitários para ContactValidator
 * Valida emails e telefones brasileiros
 */

import { describe, it, expect } from '@jest/globals';
import { ContactValidator } from '../../validators/ContactValidator';

describe('ContactValidator', () => {
  describe('validateEmail', () => {
    it('deve validar email válido', () => {
      const result = ContactValidator.validateEmail('usuario@exemplo.com');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar emails com diferentes domínios', () => {
      const validEmails = [
        'test@gmail.com',
        'user@outlook.com',
        'contact@empresa.com.br',
        'admin@subdomain.domain.org',
        'user.name@example.co.uk'
      ];

      validEmails.forEach(email => {
        const result = ContactValidator.validateEmail(email);
        expect(result.valid).toBe(true);
      });
    });

    it('deve rejeitar emails com formato inválido', () => {
      const invalidEmails = [
        'email-sem-arroba.com',
        '@sem-local-part.com',
        'sem-dominio@',
        'usuario@',
        '@dominio.com',
        'usuario.dominio.com',
        'usuario@dominio',
        'usuario@@duplo-arroba.com'
      ];

      invalidEmails.forEach(email => {
        const result = ContactValidator.validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Formato de email inválido');
      });
    });

    it('deve rejeitar email vazio', () => {
      const result = ContactValidator.validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email é obrigatório');
    });

    it('deve rejeitar emails muito longos', () => {
      const longEmail = 'a'.repeat(250) + '@exemplo.com';
      const result = ContactValidator.validateEmail(longEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email muito longo (máximo 254 caracteres)');
    });

    it('deve rejeitar parte local muito longa', () => {
      const longLocalPart = 'a'.repeat(65) + '@exemplo.com';
      const result = ContactValidator.validateEmail(longLocalPart);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Parte local do email muito longa');
    });

    it('deve rejeitar emails que começam/terminam com ponto', () => {
      const invalidEmails = [
        '.usuario@exemplo.com',
        'usuario.@exemplo.com'
      ];

      invalidEmails.forEach(email => {
        const result = ContactValidator.validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Email não pode começar ou terminar com ponto');
      });
    });

    it('deve rejeitar emails com pontos consecutivos', () => {
      const result = ContactValidator.validateEmail('usuario..teste@exemplo.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email não pode ter pontos consecutivos');
    });

    it('deve rejeitar domínios temporários/suspeitos', () => {
      const suspiciousEmails = [
        'test@tempmail.org',
        'user@10minutemail.com',
        'fake@guerrillamail.com',
        'temp@yopmail.com'
      ];

      suspiciousEmails.forEach(email => {
        const result = ContactValidator.validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Email temporário ou suspeito não é permitido');
      });
    });

    it('deve normalizar email para lowercase', () => {
      const result = ContactValidator.validateEmail('USUARIO@EXEMPLO.COM');
      expect(result.valid).toBe(true);
    });

    it('deve remover espaços em branco', () => {
      const result = ContactValidator.validateEmail('  usuario@exemplo.com  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePhone', () => {
    it('deve validar celular com DDD (11 dígitos)', () => {
      const result = ContactValidator.validatePhone('11987654321');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar telefone fixo com DDD (10 dígitos)', () => {
      const result = ContactValidator.validatePhone('1134567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar telefone sem DDD (8 dígitos)', () => {
      const result = ContactValidator.validatePhone('34567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar celular sem DDD (9 dígitos)', () => {
      const result = ContactValidator.validatePhone('987654321');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar telefones com formatação', () => {
      const formattedPhones = [
        '(11) 98765-4321',
        '(11) 3456-7890',
        '11-98765-4321',
        '+55 11 98765-4321'
      ];

      formattedPhones.forEach(phone => {
        const result = ContactValidator.validatePhone(phone);
        expect(result.valid).toBe(true);
      });
    });

    it('deve validar diferentes códigos de área válidos', () => {
      const validAreaCodes = [
        '11987654321', // São Paulo
        '21987654321', // Rio de Janeiro
        '31987654321', // Minas Gerais
        '41987654321', // Paraná
        '51987654321', // Rio Grande do Sul
        '61987654321', // Distrito Federal
        '71987654321', // Bahia
        '81987654321', // Pernambuco
        '85987654321', // Ceará
        '91987654321'  // Pará
      ];

      validAreaCodes.forEach(phone => {
        const result = ContactValidator.validatePhone(phone);
        expect(result.valid).toBe(true);
      });
    });

    it('deve rejeitar telefone vazio', () => {
      const result = ContactValidator.validatePhone('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Telefone é obrigatório');
    });

    it('deve rejeitar telefone muito curto', () => {
      const result = ContactValidator.validatePhone('1234567');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Telefone deve ter entre 8 e 11 dígitos');
    });

    it('deve rejeitar telefone muito longo', () => {
      const result = ContactValidator.validatePhone('119876543210');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Telefone deve ter entre 8 e 11 dígitos');
    });

    it('deve rejeitar código de área inválido', () => {
      const result = ContactValidator.validatePhone('99987654321');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Código de área inválido');
    });

    it('deve rejeitar celular sem 9 após DDD', () => {
      const result = ContactValidator.validatePhone('11887654321');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Número de celular deve começar com 9 após o DDD');
    });

    it('deve rejeitar telefone fixo que começa com 9', () => {
      const result = ContactValidator.validatePhone('1198765432');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Telefone fixo não pode começar com 9. Use 11 dígitos para celular');
    });

    it('deve rejeitar números com todos dígitos iguais', () => {
      const result = ContactValidator.validatePhone('11111111111');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Número de telefone inválido');
    });
  });

  describe('formatPhone', () => {
    it('deve formatar celular com DDD', () => {
      const result = ContactValidator.formatPhone('11987654321');
      expect(result).toBe('(11) 98765-4321');
    });

    it('deve formatar telefone fixo com DDD', () => {
      const result = ContactValidator.formatPhone('1134567890');
      expect(result).toBe('(11) 3456-7890');
    });

    it('deve formatar celular sem DDD', () => {
      const result = ContactValidator.formatPhone('987654321');
      expect(result).toBe('98765-4321');
    });

    it('deve formatar telefone fixo sem DDD', () => {
      const result = ContactValidator.formatPhone('34567890');
      expect(result).toBe('3456-7890');
    });

    it('deve retornar original se formato não reconhecido', () => {
      const result = ContactValidator.formatPhone('123456');
      expect(result).toBe('123456');
    });
  });

  describe('sanitizeEmail', () => {
    it('deve converter para lowercase', () => {
      const result = ContactValidator.sanitizeEmail('USUARIO@EXEMPLO.COM');
      expect(result).toBe('usuario@exemplo.com');
    });

    it('deve remover espaços em branco', () => {
      const result = ContactValidator.sanitizeEmail('  usuario@exemplo.com  ');
      expect(result).toBe('usuario@exemplo.com');
    });
  });

  describe('sanitizePhone', () => {
    it('deve remover formatação', () => {
      const result = ContactValidator.sanitizePhone('(11) 98765-4321');
      expect(result).toBe('11987654321');
    });

    it('deve remover todos os caracteres não numéricos', () => {
      const result = ContactValidator.sanitizePhone('+55 (11) 98765-4321');
      expect(result).toBe('5511987654321');
    });
  });

  describe('detectPhoneType', () => {
    it('deve detectar celular', () => {
      const result = ContactValidator.detectPhoneType('11987654321');
      expect(result).toBe('mobile');
    });

    it('deve detectar telefone fixo', () => {
      const result = ContactValidator.detectPhoneType('1134567890');
      expect(result).toBe('landline');
    });

    it('deve detectar telefone curto', () => {
      const result = ContactValidator.detectPhoneType('34567890');
      expect(result).toBe('short');
    });

    it('deve detectar tipo desconhecido', () => {
      const result = ContactValidator.detectPhoneType('123456');
      expect(result).toBe('unknown');
    });
  });

  describe('isMobile', () => {
    it('deve identificar celular corretamente', () => {
      expect(ContactValidator.isMobile('11987654321')).toBe(true);
      expect(ContactValidator.isMobile('1134567890')).toBe(false);
    });
  });

  describe('extractAreaCode', () => {
    it('deve extrair DDD de telefone com DDD', () => {
      const result = ContactValidator.extractAreaCode('11987654321');
      expect(result).toBe('11');
    });

    it('deve extrair DDD de telefone fixo', () => {
      const result = ContactValidator.extractAreaCode('1134567890');
      expect(result).toBe('11');
    });

    it('deve retornar null para telefone sem DDD', () => {
      const result = ContactValidator.extractAreaCode('987654321');
      expect(result).toBeNull();
    });

    it('deve retornar null para telefone muito curto', () => {
      const result = ContactValidator.extractAreaCode('34567890');
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('deve lidar com null/undefined', () => {
      // @ts-ignore - Testando edge case
      const emailResult = ContactValidator.validateEmail(null);
      // @ts-ignore - Testando edge case
      const phoneResult = ContactValidator.validatePhone(undefined);
      
      expect(emailResult.valid).toBe(false);
      expect(phoneResult.valid).toBe(false);
    });

    it('deve lidar com números', () => {
      // @ts-ignore - Testando edge case
      const result = ContactValidator.validateEmail(123);
      expect(result.valid).toBe(false);
    });

    it('deve lidar com strings com apenas espaços', () => {
      const emailResult = ContactValidator.validateEmail('   ');
      const phoneResult = ContactValidator.validatePhone('   ');
      
      expect(emailResult.valid).toBe(false);
      expect(phoneResult.valid).toBe(false);
    });

    it('deve lidar com caracteres especiais em telefone', () => {
      const result = ContactValidator.validatePhone('(11) 9 8765-4321');
      expect(result.valid).toBe(true); // Deve remover espaços extras
    });
  });
});