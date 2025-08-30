"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.performanceLogger = exports.logger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor(context) {
        this.context = context;
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
                return `${timestamp} [${level.toUpperCase()}] [${context || this.context}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
            })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/cross-module-integration.log',
                    level: 'info'
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/cross-module-errors.log',
                    level: 'error'
                })
            ]
        });
    }
    info(message, meta) {
        this.logger.info(message, { context: this.context, ...meta });
    }
    error(message, meta) {
        this.logger.error(message, { context: this.context, ...meta });
    }
    warn(message, meta) {
        this.logger.warn(message, { context: this.context, ...meta });
    }
    debug(message, meta) {
        this.logger.debug(message, { context: this.context, ...meta });
    }
}
exports.Logger = Logger;
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'erp-nexus',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5,
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(process.cwd(), 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        })
    ]
});
exports.performanceLogger = {
    database: (operation, duration, details) => {
        exports.logger.info('Database Operation', {
            type: 'performance',
            category: 'database',
            operation,
            duration,
            details
        });
    },
    api: (endpoint, method, duration, statusCode) => {
        exports.logger.info('API Request', {
            type: 'performance',
            category: 'api',
            endpoint,
            method,
            duration,
            statusCode
        });
    },
    validation: (validationType, duration, success) => {
        exports.logger.info('Validation', {
            type: 'performance',
            category: 'validation',
            validationType,
            duration,
            success
        });
    }
};
exports.auditLogger = {
    create: (resource, resourceId, userId, data) => {
        exports.logger.info('Resource Created', {
            type: 'audit',
            action: 'create',
            resource,
            resourceId,
            userId,
            data: JSON.stringify(data)
        });
    },
    update: (resource, resourceId, userId, changes) => {
        exports.logger.info('Resource Updated', {
            type: 'audit',
            action: 'update',
            resource,
            resourceId,
            userId,
            changes: JSON.stringify(changes)
        });
    },
    delete: (resource, resourceId, userId) => {
        exports.logger.info('Resource Deleted', {
            type: 'audit',
            action: 'delete',
            resource,
            resourceId,
            userId
        });
    }
};
exports.default = Logger;
//# sourceMappingURL=logger.js.map