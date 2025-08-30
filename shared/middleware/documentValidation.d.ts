import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            validatedData?: {
                cpfCnpjClean?: string;
                phoneClean?: string;
                emailClean?: string;
            };
        }
    }
}
export declare const validateDocuments: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const validateUniqueFields: (modelName: string, fields: string[], prismaClient: any) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
export declare const validateRequiredFields: (requiredFields: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>>;
export declare const sanitizeStrings: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=documentValidation.d.ts.map