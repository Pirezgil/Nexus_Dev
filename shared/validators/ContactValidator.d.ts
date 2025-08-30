export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare class ContactValidator {
    private static suspiciousDomains;
    private static validAreaCodes;
    static validateEmail(email: string): ValidationResult;
    static validatePhone(phone: string): ValidationResult;
    static formatPhone(phone: string): string;
    static sanitizeEmail(email: string): string;
    static sanitizePhone(phone: string): string;
    static detectPhoneType(phone: string): 'mobile' | 'landline' | 'short' | 'unknown';
    static isMobile(phone: string): boolean;
    static extractAreaCode(phone: string): string | null;
}
//# sourceMappingURL=ContactValidator.d.ts.map