export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare class DocumentValidator {
    static validateCPF(cpf: string): ValidationResult;
    static validateCNPJ(cnpj: string): ValidationResult;
    static validateDocument(document: string, type?: 'cpf' | 'cnpj'): ValidationResult;
    static formatCPF(cpf: string): string;
    static formatCNPJ(cnpj: string): string;
    static formatDocument(document: string): string;
    static sanitizeDocument(document: string): string;
    static detectDocumentType(document: string): 'cpf' | 'cnpj' | null;
}
//# sourceMappingURL=DocumentValidator.d.ts.map