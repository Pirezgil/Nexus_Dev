"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentValidator = void 0;
class DocumentValidator {
    static validateCPF(cpf) {
        if (!cpf)
            return { valid: false, error: 'CPF é obrigatório' };
        const cleanCPF = cpf.replace(/\D/g, '');
        if (cleanCPF.length !== 11) {
            return { valid: false, error: 'CPF deve ter 11 dígitos' };
        }
        if (/^(\d)\1+$/.test(cleanCPF)) {
            return { valid: false, error: 'CPF inválido' };
        }
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleanCPF[i]) * (10 - i);
        }
        let remainder = sum % 11;
        let digit1 = remainder < 2 ? 0 : 11 - remainder;
        if (digit1 !== parseInt(cleanCPF[9])) {
            return { valid: false, error: 'CPF inválido' };
        }
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleanCPF[i]) * (11 - i);
        }
        remainder = sum % 11;
        let digit2 = remainder < 2 ? 0 : 11 - remainder;
        if (digit2 !== parseInt(cleanCPF[10])) {
            return { valid: false, error: 'CPF inválido' };
        }
        return { valid: true };
    }
    static validateCNPJ(cnpj) {
        if (!cnpj)
            return { valid: false, error: 'CNPJ é obrigatório' };
        const cleanCNPJ = cnpj.replace(/\D/g, '');
        if (cleanCNPJ.length !== 14) {
            return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
        }
        if (/^(\d)\1+$/.test(cleanCNPJ)) {
            return { valid: false, error: 'CNPJ inválido' };
        }
        const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(cleanCNPJ[i]) * weights1[i];
        }
        let remainder = sum % 11;
        let digit1 = remainder < 2 ? 0 : 11 - remainder;
        if (digit1 !== parseInt(cleanCNPJ[12])) {
            return { valid: false, error: 'CNPJ inválido' };
        }
        sum = 0;
        for (let i = 0; i < 13; i++) {
            sum += parseInt(cleanCNPJ[i]) * weights2[i];
        }
        remainder = sum % 11;
        let digit2 = remainder < 2 ? 0 : 11 - remainder;
        if (digit2 !== parseInt(cleanCNPJ[13])) {
            return { valid: false, error: 'CNPJ inválido' };
        }
        return { valid: true };
    }
    static validateDocument(document, type) {
        if (!document)
            return { valid: false, error: 'Documento é obrigatório' };
        const cleanDoc = document.replace(/\D/g, '');
        if (!type) {
            if (cleanDoc.length === 11) {
                type = 'cpf';
            }
            else if (cleanDoc.length === 14) {
                type = 'cnpj';
            }
            else {
                return { valid: false, error: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)' };
            }
        }
        return type === 'cpf' ? this.validateCPF(document) : this.validateCNPJ(document);
    }
    static formatCPF(cpf) {
        const clean = cpf.replace(/\D/g, '');
        if (clean.length !== 11)
            return cpf;
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    static formatCNPJ(cnpj) {
        const clean = cnpj.replace(/\D/g, '');
        if (clean.length !== 14)
            return cnpj;
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    static formatDocument(document) {
        const clean = document.replace(/\D/g, '');
        if (clean.length === 11) {
            return this.formatCPF(clean);
        }
        else if (clean.length === 14) {
            return this.formatCNPJ(clean);
        }
        return document;
    }
    static sanitizeDocument(document) {
        return document.replace(/\D/g, '');
    }
    static detectDocumentType(document) {
        const clean = document.replace(/\D/g, '');
        if (clean.length === 11)
            return 'cpf';
        if (clean.length === 14)
            return 'cnpj';
        return null;
    }
}
exports.DocumentValidator = DocumentValidator;
//# sourceMappingURL=DocumentValidator.js.map