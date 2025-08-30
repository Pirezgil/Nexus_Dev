import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                companyId: string;
                userId: string;
                role: string;
                permissions?: Record<string, string[]>;
            };
        }
    }
}
interface Permission {
    module: string;
    action: 'read' | 'write' | 'delete' | 'admin';
    resource?: string;
}
export declare const requirePermission: (permission: Permission) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const validateOwnership: (modelName: string, prismaClient: any) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const requireMinimumRole: (minimumRole: string) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const logAccess: (action: string) => (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=permissionValidation.d.ts.map