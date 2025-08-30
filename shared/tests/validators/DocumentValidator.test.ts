/**
 * Testes unitários para DocumentValidator
 * Valida CPF/CNPJ conforme algoritmos oficiais brasileiros
 */

import { describe, it, expect } from '@jest/globals';
import { DocumentValidator } from '../../validators/DocumentValidator';

describe('DocumentValidator', () => {
  describe('validateCPF', () => {
    it('deve validar CPF válido sem formatação', () => {
      const result = DocumentValidator.validateCPF('11144477735');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar CPF válido com formatação', () => {
      const result = DocumentValidator.validateCPF('111.444.777-35');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar CPF com todos os dígitos iguais', () => {
      const result = DocumentValidator.validateCPF('11111111111');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CPF inválido');
    });

    it('deve rejeitar CPF com tamanho inválido', () => {
      const result = DocumentValidator.validateCPF('123456789');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CPF deve ter 11 dígitos');
    });

    it('deve rejeitar CPF vazio', () => {
      const result = DocumentValidator.validateCPF('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CPF é obrigatório');
    });

    it('deve rejeitar CPF com dígito verificador inválido', () => {
      const result = DocumentValidator.validateCPF('11144477734'); // Último dígito errado
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CPF inválido');
    });

    it('deve validar CPFs conhecidamente válidos', () => {
      const validCPFs = [
        '02815517078',
        '17033259504',
        '34608514300',
        '52998224725'
      ];

      validCPFs.forEach(cpf => {
        const result = DocumentValidator.validateCPF(cpf);
        expect(result.valid).toBe(true);
      });
    });

    it('deve rejeitar CPFs conhecidamente inválidos', () => {
      const invalidCPFs = [
        '12345678901',
        '98765432100',
        '00000000000',
        '99999999999'
      ];

      invalidCPFs.forEach(cpf => {
        const result = DocumentValidator.validateCPF(cpf);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateCNPJ', () => {
    it('deve validar CNPJ válido sem formatação', () => {
      const result = DocumentValidator.validateCNPJ('11222333000181');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve validar CNPJ válido com formatação', () => {
      const result = DocumentValidator.validateCNPJ('11.222.333/0001-81');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar CNPJ com todos os dígitos iguais', () => {
      const result = DocumentValidator.validateCNPJ('11111111111111');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CNPJ inválido');
    });

    it('deve rejeitar CNPJ com tamanho inválido', () => {
      const result = DocumentValidator.validateCNPJ('123456789012');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CNPJ deve ter 14 dígitos');
    });

    it('deve rejeitar CNPJ vazio', () => {
      const result = DocumentValidator.validateCNPJ('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CNPJ é obrigatório');
    });

    it('deve rejeitar CNPJ com dígito verificador inválido', () => {
      const result = DocumentValidator.validateCNPJ('11222333000180'); // Último dígito errado
      expect(result.valid).toBe(false);
      expect(result.error).toBe('CNPJ inválido');
    });

    it('deve validar CNPJs conhecidamente válidos', () => {
      const validCNPJs = [
        '11444777000161',
        '34073077000198',
        '07526557000154',
        '60701190000104'
      ];

      validCNPJs.forEach(cnpj => {
        const result = DocumentValidator.validateCNPJ(cnpj);
        expect(result.valid).toBe(true);
      });
    });

    it('deve rejeitar CNPJs conhecidamente inválidos', () => {
      const invalidCNPJs = [
        '12345678901234',
        '98765432109876',
        '00000000000000',
        '99999999999999'
      ];

      invalidCNPJs.forEach(cnpj => {
        const result = DocumentValidator.validateCNPJ(cnpj);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateDocument', () => {
    it('deve detectar e validar CPF automaticamente', () => {
      const result = DocumentValidator.validateDocument('11144477735');
      expect(result.valid).toBe(true);
    });

    it('deve detectar e validar CNPJ automaticamente', () => {
      const result = DocumentValidator.validateDocument('11222333000181');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar documento com tamanho inválido', () => {
      const result = DocumentValidator.validateDocument('123456789');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)');
    });

    it('deve forçar validação como CPF quando especificado', () => {
      const result = DocumentValidator.validateDocument('11144477735', 'cpf');
      expect(result.valid).toBe(true);
    });

    it('deve forçar validação como CNPJ quando especificado', () => {
      const result = DocumentValidator.validateDocument('11222333000181', 'cnpj');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar documento vazio', () => {
      const result = DocumentValidator.validateDocument('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Documento é obrigatório');
    });
  });

  describe('formatCPF', () => {
    it('deve formatar CPF corretamente', () => {
      const result = DocumentValidator.formatCPF('11144477735');
      expect(result).toBe('111.444.777-35');
    });

    it('deve retornar original se CPF inválido', () => {
      const result = DocumentValidator.formatCPF('123456789');
      expect(result).toBe('123456789');
    });

    it('deve remover formatação existente antes de reformatar', () => {
      const result = DocumentValidator.formatCPF('111.444.777-35');
      expect(result).toBe('111.444.777-35');
    });
  });

  describe('formatCNPJ', () => {
    it('deve formatar CNPJ corretamente', () => {
      const result = DocumentValidator.formatCNPJ('11222333000181');
      expect(result).toBe('11.222.333/0001-81');
    });

    it('deve retornar original se CNPJ inválido', () => {
      const result = DocumentValidator.formatCNPJ('123456789012');
      expect(result).toBe('123456789012');
    });

    it('deve remover formatação existente antes de reformatar', () => {
      const result = DocumentValidator.formatCNPJ('11.222.333/0001-81');
      expect(result).toBe('11.222.333/0001-81');
    });
  });

  describe('formatDocument', () => {
    it('deve formatar CPF automaticamente', () => {
      const result = DocumentValidator.formatDocument('11144477735');
      expect(result).toBe('111.444.777-35');
    });

    it('deve formatar CNPJ automaticamente', () => {
      const result = DocumentValidator.formatDocument('11222333000181');
      expect(result).toBe('11.222.333/0001-81');
    });

    it('deve retornar original se não conseguir identificar', () => {
      const result = DocumentValidator.formatDocument('123456789');
      expect(result).toBe('123456789');
    });
  });

  describe('sanitizeDocument', () => {
    it('deve remover caracteres especiais', () => {
      const result = DocumentValidator.sanitizeDocument('111.444.777-35');
      expect(result).toBe('11144477735');
    });

    it('deve remover espaços', () => {
      const result = DocumentValidator.sanitizeDocument('111 444 777 35');
      expect(result).toBe('11144477735');
    });

    it('deve remover caracteres mistos', () => {
      const result = DocumentValidator.sanitizeDocument('111.444.777-35 ');
      expect(result).toBe('11144477735');
    });
  });

  describe('detectDocumentType', () => {
    it('deve detectar CPF', () => {
      const result = DocumentValidator.detectDocumentType('11144477735');
      expect(result).toBe('cpf');
    });

    it('deve detectar CNPJ', () => {
      const result = DocumentValidator.detectDocumentType('11222333000181');
      expect(result).toBe('cnpj');
    });

    it('deve retornar null para tamanho inválido', () => {
      const result = DocumentValidator.detectDocumentType('123456789');
      expect(result).toBeNull();
    });

    it('deve detectar com formatação', () => {
      const cpfResult = DocumentValidator.detectDocumentType('111.444.777-35');
      const cnpjResult = DocumentValidator.detectDocumentType('11.222.333/0001-81');
      
      expect(cpfResult).toBe('cpf');
      expect(cnpjResult).toBe('cnpj');
    });
  });

  describe('Edge cases', () => {
    it('deve lidar com null/undefined', () => {
      // @ts-ignore - Testando edge case
      const cpfResult = DocumentValidator.validateCPF(null);
      // @ts-ignore - Testando edge case
      const cnpjResult = DocumentValidator.validateCNPJ(undefined);
      
      expect(cpfResult.valid).toBe(false);
      expect(cnpjResult.valid).toBe(false);
    });

    it('deve lidar com números', () => {
      // @ts-ignore - Testando edge case
      const result = DocumentValidator.validateCPF(11144477735);
      expect(result.valid).toBe(false); // Deve ser string
    });

    it('deve lidar com strings com apenas espaços', () => {
      const result = DocumentValidator.validateDocument('   ');
      expect(result.valid).toBe(false);
    });
  });
});