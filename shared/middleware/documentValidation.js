"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeStrings = exports.validateRequiredFields = exports.validateUniqueFields = exports.validateDocuments = void 0;
const DocumentValidator_1 = require("../validators/DocumentValidator");
const ContactValidator_1 = require("../validators/ContactValidator");
const logger_1 = require("../utils/logger");
const validateDocuments = (req, res, next) => {
    const errors = [];
    try {
        req.validatedData = req.validatedData || {};
        if (req.body.cpfCnpj) {
            const documentValidation = DocumentValidator_1.DocumentValidator.validateDocument(req.body.cpfCnpj);
            if (!documentValidation.valid) {
                errors.push({
                    field: 'cpfCnpj',
                    message: documentValidation.error
                });
            }
            else {
                const cleanDoc = DocumentValidator_1.DocumentValidator.sanitizeDocument(req.body.cpfCnpj);
                const formattedDoc = DocumentValidator_1.DocumentValidator.formatDocument(cleanDoc);
                req.validatedData.cpfCnpjClean = cleanDoc;
                req.body.cpfCnpj = formattedDoc;
                logger_1.logger.debug('Documento validado e formatado', {
                    original: req.body.cpfCnpj,
                    clean: cleanDoc,
                    formatted: formattedDoc
                });
            }
        }
        if (req.body.email) {
            const emailValidation = ContactValidator_1.ContactValidator.validateEmail(req.body.email);
            if (!emailValidation.valid) {
                errors.push({
                    field: 'email',
                    message: emailValidation.error
                });
            }
            else {
                const cleanEmail = ContactValidator_1.ContactValidator.sanitizeEmail(req.body.email);
                req.validatedData.emailClean = cleanEmail;
                req.body.email = cleanEmail;
            }
        }
        if (req.body.phone) {
            const phoneValidation = ContactValidator_1.ContactValidator.validatePhone(req.body.phone);
            if (!phoneValidation.valid) {
                errors.push({
                    field: 'phone',
                    message: phoneValidation.error
                });
            }
            else {
                const cleanPhone = ContactValidator_1.ContactValidator.sanitizePhone(req.body.phone);
                const formattedPhone = ContactValidator_1.ContactValidator.formatPhone(cleanPhone);
                req.validatedData.phoneClean = cleanPhone;
                req.body.phone = formattedPhone;
            }
        }
        if (req.body.secondaryPhone) {
            const phoneValidation = ContactValidator_1.ContactValidator.validatePhone(req.body.secondaryPhone);
            if (!phoneValidation.valid) {
                errors.push({
                    field: 'secondaryPhone',
                    message: phoneValidation.error
                });
            }
            else {
                const cleanPhone = ContactValidator_1.ContactValidator.sanitizePhone(req.body.secondaryPhone);
                const formattedPhone = ContactValidator_1.ContactValidator.formatPhone(cleanPhone);
                req.body.secondaryPhone = formattedPhone;
            }
        }
        if (errors.length > 0) {
            logger_1.logger.warn('Erros de validação de documentos detectados', {
                errors,
                body: req.body
            });
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos',
                details: errors.map(err => err.message),
                fields: errors.reduce((acc, err) => {
                    acc[err.field] = err.message;
                    return acc;
                }, {})
            });
        }
        logger_1.logger.debug('Validação de documentos concluída com sucesso');
        next();
    }
    catch (error) {
        logger_1.logger.error('Erro no middleware de validação de documentos', { error });
        return res.status(500).json({
            success: false,
            error: 'Erro interno na validação de dados'
        });
    }
};
exports.validateDocuments = validateDocuments;
const validateUniqueFields = (modelName, fields, prismaClient) => {
    return async (req, res, next) => {
        try {
            const { companyId } = req.user || {};
            const errors = [];
            if (!companyId) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuário não autenticado ou empresa não identificada'
                });
            }
            for (const field of fields) {
                if (req.body[field]) {
                    const fieldValue = req.validatedData?.[`${field}Clean`] || req.body[field];
                    const existing = await prismaClient[modelName].findFirst({
                        where: {
                            companyId,
                            [field]: fieldValue,
                            ...(req.params.id && { id: { not: req.params.id } })
                        }
                    });
                    if (existing) {
                        const fieldDisplayName = field === 'cpfCnpj' ? 'CPF/CNPJ' :
                            field === 'phone' ? 'Telefone' :
                                field === 'email' ? 'Email' : field;
                        errors.push({
                            field,
                            message: `${fieldDisplayName} já está em uso por outro registro`
                        });
                    }
                }
            }
            if (errors.length > 0) {
                logger_1.logger.warn('Campos únicos duplicados detectados', {
                    errors,
                    modelName,
                    companyId
                });
                return res.status(409).json({
                    success: false,
                    error: 'Dados duplicados',
                    details: errors.map(err => err.message),
                    fields: errors.reduce((acc, err) => {
                        acc[err.field] = err.message;
                        return acc;
                    }, {})
                });
            }
            logger_1.logger.debug('Validação de campos únicos concluída', { modelName, fields });
            next();
        }
        catch (error) {
            logger_1.logger.error('Erro na validação de campos únicos', {
                error,
                modelName,
                fields
            });
            return res.status(500).json({
                success: false,
                error: 'Erro interno na validação de unicidade'
            });
        }
    };
};
exports.validateUniqueFields = validateUniqueFields;
const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        const errors = [];
        for (const field of requiredFields) {
            if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
                const fieldDisplayName = field === 'cpfCnpj' ? 'CPF/CNPJ' :
                    field === 'phone' ? 'Telefone' :
                        field === 'email' ? 'Email' :
                            field === 'name' ? 'Nome' : field;
                errors.push({
                    field,
                    message: `${fieldDisplayName} é obrigatório`
                });
            }
        }
        if (errors.length > 0) {
            logger_1.logger.warn('Campos obrigatórios não fornecidos', { errors });
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios não preenchidos',
                details: errors.map(err => err.message),
                fields: errors.reduce((acc, err) => {
                    acc[err.field] = err.message;
                    return acc;
                }, {})
            });
        }
        next();
    };
};
exports.validateRequiredFields = validateRequiredFields;
const sanitizeStrings = (req, res, next) => {
    try {
        const sanitizeValue = (value) => {
            if (typeof value === 'string') {
                return value.trim();
            }
            else if (Array.isArray(value)) {
                return value.map(sanitizeValue);
            }
            else if (value && typeof value === 'object') {
                const sanitized = {};
                for (const key in value) {
                    sanitized[key] = sanitizeValue(value[key]);
                }
                return sanitized;
            }
            return value;
        };
        req.body = sanitizeValue(req.body);
        req.query = sanitizeValue(req.query);
        next();
    }
    catch (error) {
        logger_1.logger.error('Erro na sanitização de strings', { error });
        next();
    }
};
exports.sanitizeStrings = sanitizeStrings;
//# sourceMappingURL=documentValidation.js.map