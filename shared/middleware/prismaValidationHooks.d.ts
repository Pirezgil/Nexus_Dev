import { Prisma } from '@prisma/client';
interface ValidationConfig {
    customerIdField?: string;
    professionalIdField?: string;
    serviceIdField?: string;
    userIdField?: string;
    companyIdField?: string;
    appointmentIdField?: string;
}
export declare class PrismaValidationHooks {
    static createValidationMiddleware(modelName: string, config?: ValidationConfig): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static servicesValidationMiddleware(): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static agendamentoValidationMiddleware(): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static crmValidationMiddleware(): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static createModuleValidationMiddleware(modelConfigs: {
        [modelName: string]: ValidationConfig;
    }): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static loggingMiddleware(): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
    static auditMiddleware(moduleName: string): (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<any>) => Promise<any>;
}
export default PrismaValidationHooks;
//# sourceMappingURL=prismaValidationHooks.d.ts.map