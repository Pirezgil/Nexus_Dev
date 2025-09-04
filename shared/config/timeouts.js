"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimeoutConfig = exports.getTimeoutForOperation = exports.validateTimeoutHierarchy = exports.TIMEOUT_CONFIG = void 0;
const DEFAULT_TIMEOUTS = {
    HEALTH_CHECK: 5000,
    QUICK_OPERATIONS: 10000,
    INTERNAL_SERVICE: 25000,
    API_CLIENT: 30000,
    GATEWAY: 60000,
};
exports.TIMEOUT_CONFIG = {
    HEALTH_CHECK: parseInt(process.env.TIMEOUT_HEALTH_CHECK || DEFAULT_TIMEOUTS.HEALTH_CHECK.toString(), 10),
    QUICK_OPERATIONS: parseInt(process.env.TIMEOUT_QUICK_OPERATIONS || DEFAULT_TIMEOUTS.QUICK_OPERATIONS.toString(), 10),
    INTERNAL_SERVICE: parseInt(process.env.TIMEOUT_INTERNAL_SERVICE || DEFAULT_TIMEOUTS.INTERNAL_SERVICE.toString(), 10),
    API_CLIENT: parseInt(process.env.TIMEOUT_API_CLIENT || DEFAULT_TIMEOUTS.API_CLIENT.toString(), 10),
    GATEWAY: parseInt(process.env.TIMEOUT_GATEWAY || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
    GATEWAY_CRM: parseInt(process.env.TIMEOUT_GATEWAY_CRM || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
    GATEWAY_SERVICES: parseInt(process.env.TIMEOUT_GATEWAY_SERVICES || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
    GATEWAY_AGENDAMENTO: parseInt(process.env.TIMEOUT_GATEWAY_AGENDAMENTO || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
    EXTERNAL_API: parseInt(process.env.TIMEOUT_EXTERNAL_API || DEFAULT_TIMEOUTS.GATEWAY.toString(), 10),
};
const validateTimeoutHierarchy = () => {
    const config = exports.TIMEOUT_CONFIG;
    if (config.HEALTH_CHECK >= config.QUICK_OPERATIONS) {
        console.warn('⚠️ Warning: TIMEOUT_HEALTH_CHECK should be smaller than TIMEOUT_QUICK_OPERATIONS');
    }
    if (config.QUICK_OPERATIONS >= config.INTERNAL_SERVICE) {
        console.warn('⚠️ Warning: TIMEOUT_QUICK_OPERATIONS should be smaller than TIMEOUT_INTERNAL_SERVICE');
    }
    if (config.INTERNAL_SERVICE >= config.API_CLIENT) {
        console.warn('⚠️ Warning: TIMEOUT_INTERNAL_SERVICE should be smaller than TIMEOUT_API_CLIENT');
    }
    if (config.API_CLIENT >= config.GATEWAY) {
        console.warn('⚠️ Warning: TIMEOUT_API_CLIENT should be smaller than TIMEOUT_GATEWAY');
    }
    console.log('✅ Timeout Configuration Loaded:', {
        HEALTH_CHECK: `${config.HEALTH_CHECK}ms`,
        QUICK_OPERATIONS: `${config.QUICK_OPERATIONS}ms`,
        INTERNAL_SERVICE: `${config.INTERNAL_SERVICE}ms`,
        API_CLIENT: `${config.API_CLIENT}ms`,
        GATEWAY: `${config.GATEWAY}ms`,
        hierarchy: 'HEALTH_CHECK < QUICK_OPERATIONS < INTERNAL_SERVICE < API_CLIENT < GATEWAY'
    });
};
exports.validateTimeoutHierarchy = validateTimeoutHierarchy;
const getTimeoutForOperation = (operation) => {
    switch (operation.toLowerCase()) {
        case 'health':
        case 'ping':
            return exports.TIMEOUT_CONFIG.HEALTH_CHECK;
        case 'auth':
        case 'refresh':
        case 'validate':
            return exports.TIMEOUT_CONFIG.QUICK_OPERATIONS;
        case 'internal':
        case 'integration':
        case 'cross-module':
            return exports.TIMEOUT_CONFIG.INTERNAL_SERVICE;
        case 'frontend':
        case 'client':
            return exports.TIMEOUT_CONFIG.API_CLIENT;
        case 'upload':
        case 'report':
        case 'export':
        case 'gateway':
            return exports.TIMEOUT_CONFIG.GATEWAY;
        case 'whatsapp':
        case 'external':
            return exports.TIMEOUT_CONFIG.EXTERNAL_API;
        default:
            return exports.TIMEOUT_CONFIG.INTERNAL_SERVICE;
    }
};
exports.getTimeoutForOperation = getTimeoutForOperation;
const createTimeoutConfig = (operationType) => ({
    timeout: (0, exports.getTimeoutForOperation)(operationType),
    headers: {
        'X-Timeout-Policy': `${(0, exports.getTimeoutForOperation)(operationType)}ms`,
        'X-Operation-Type': operationType,
    }
});
exports.createTimeoutConfig = createTimeoutConfig;
(0, exports.validateTimeoutHierarchy)();
exports.default = exports.TIMEOUT_CONFIG;
//# sourceMappingURL=timeouts.js.map