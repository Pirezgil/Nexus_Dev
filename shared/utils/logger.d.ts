import winston from 'winston';
export declare class Logger {
    private context;
    private logger;
    constructor(context: string);
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}
export declare const logger: winston.Logger;
export declare const performanceLogger: {
    database: (operation: string, duration: number, details?: string) => void;
    api: (endpoint: string, method: string, duration: number, statusCode: number) => void;
    validation: (validationType: string, duration: number, success: boolean) => void;
};
export declare const auditLogger: {
    create: (resource: string, resourceId: string, userId: string, data: any) => void;
    update: (resource: string, resourceId: string, userId: string, changes: any) => void;
    delete: (resource: string, resourceId: string, userId: string) => void;
};
export default Logger;
//# sourceMappingURL=logger.d.ts.map