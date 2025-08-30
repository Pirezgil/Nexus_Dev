export interface ValidationResult {
    exists: boolean;
    error?: string;
    data?: any;
}
export interface ModuleEndpoints {
    auth: string;
    crm: string;
    services: string;
    agendamento: string;
}
export declare class ModuleIntegrator {
    private static logger;
    private static endpoints;
    static validateCustomer(customerId: string, companyId: string): Promise<ValidationResult>;
    static validateProfessional(professionalId: string, companyId: string): Promise<ValidationResult>;
    static validateService(serviceId: string, companyId: string): Promise<ValidationResult>;
    static validateUser(userId: string, companyId: string): Promise<ValidationResult>;
    static validateCompany(companyId: string): Promise<ValidationResult>;
    static validateAppointment(appointmentId: string, companyId: string): Promise<ValidationResult>;
    static validateBatch(validations: {
        type: 'customer' | 'professional' | 'service' | 'user' | 'company' | 'appointment';
        id: string;
        companyId: string;
        key: string;
    }[]): Promise<{
        [key: string]: ValidationResult;
    }>;
    static healthCheck(): Promise<{
        [module: string]: boolean;
    }>;
    static configure(endpoints: Partial<ModuleEndpoints>): void;
    static getEndpoints(): ModuleEndpoints;
}
export default ModuleIntegrator;
//# sourceMappingURL=ModuleIntegrator.d.ts.map