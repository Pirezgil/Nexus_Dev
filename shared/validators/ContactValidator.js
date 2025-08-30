"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactValidator = void 0;
class ContactValidator {
    static validateEmail(email) {
        if (!email)
            return { valid: false, error: 'Email é obrigatório' };
        email = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Formato de email inválido' };
        }
        if (email.length > 254) {
            return { valid: false, error: 'Email muito longo (máximo 254 caracteres)' };
        }
        const [localPart, domainPart] = email.split('@');
        if (localPart.length > 64) {
            return { valid: false, error: 'Parte local do email muito longa' };
        }
        if (localPart.length === 0) {
            return { valid: false, error: 'Parte local do email não pode estar vazia' };
        }
        if (localPart.startsWith('.') || localPart.endsWith('.')) {
            return { valid: false, error: 'Email não pode começar ou terminar com ponto' };
        }
        if (localPart.includes('..')) {
            return { valid: false, error: 'Email não pode ter pontos consecutivos' };
        }
        if (this.suspiciousDomains.includes(domainPart)) {
            return { valid: false, error: 'Email temporário ou suspeito não é permitido' };
        }
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainRegex.test(domainPart)) {
            return { valid: false, error: 'Domínio do email inválido' };
        }
        return { valid: true };
    }
    static validatePhone(phone) {
        if (!phone)
            return { valid: false, error: 'Telefone é obrigatório' };
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 8 || cleanPhone.length > 11) {
            return { valid: false, error: 'Telefone deve ter entre 8 e 11 dígitos' };
        }
        if (cleanPhone.length === 11) {
            const areaCode = parseInt(cleanPhone.substr(0, 2));
            if (!this.validAreaCodes.includes(areaCode)) {
                return { valid: false, error: 'Código de área inválido' };
            }
            if (cleanPhone[2] !== '9') {
                return { valid: false, error: 'Número de celular deve começar com 9 após o DDD' };
            }
        }
        if (cleanPhone.length === 10) {
            const areaCode = parseInt(cleanPhone.substr(0, 2));
            if (!this.validAreaCodes.includes(areaCode)) {
                return { valid: false, error: 'Código de área inválido' };
            }
            if (cleanPhone[2] === '9') {
                return { valid: false, error: 'Telefone fixo não pode começar com 9. Use 11 dígitos para celular' };
            }
        }
        if (/^(\d)\1+$/.test(cleanPhone)) {
            return { valid: false, error: 'Número de telefone inválido' };
        }
        return { valid: true };
    }
    static formatPhone(phone) {
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 11) {
            return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        else if (clean.length === 10) {
            return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        else if (clean.length === 9) {
            return clean.replace(/(\d{5})(\d{4})/, '$1-$2');
        }
        else if (clean.length === 8) {
            return clean.replace(/(\d{4})(\d{4})/, '$1-$2');
        }
        return phone;
    }
    static sanitizeEmail(email) {
        return email.trim().toLowerCase();
    }
    static sanitizePhone(phone) {
        return phone.replace(/\D/g, '');
    }
    static detectPhoneType(phone) {
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 11 && clean[2] === '9') {
            return 'mobile';
        }
        else if (clean.length === 10 && clean[2] !== '9') {
            return 'landline';
        }
        else if (clean.length === 8 || clean.length === 9) {
            return 'short';
        }
        return 'unknown';
    }
    static isMobile(phone) {
        return this.detectPhoneType(phone) === 'mobile';
    }
    static extractAreaCode(phone) {
        const clean = phone.replace(/\D/g, '');
        if (clean.length >= 10) {
            return clean.substr(0, 2);
        }
        return null;
    }
}
exports.ContactValidator = ContactValidator;
ContactValidator.suspiciousDomains = [
    'tempmail.org',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
    'temp-mail.org',
    'getairmail.com',
    'yopmail.com'
];
ContactValidator.validAreaCodes = [
    11, 12, 13, 14, 15, 16, 17, 18, 19,
    21, 22, 24,
    27, 28,
    31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46,
    47, 48, 49,
    51, 53, 54, 55,
    61,
    62, 64,
    65, 66,
    67,
    68,
    69,
    71, 73, 74, 75, 77,
    79,
    81, 87,
    82,
    83,
    84,
    85, 88,
    86, 89,
    91, 93, 94,
    92, 97,
    95,
    96,
    98, 99,
];
//# sourceMappingURL=ContactValidator.js.map