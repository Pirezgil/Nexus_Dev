export declare const TIMEOUT_CONFIG: {
    readonly HEALTH_CHECK: number;
    readonly QUICK_OPERATIONS: number;
    readonly INTERNAL_SERVICE: number;
    readonly API_CLIENT: number;
    readonly GATEWAY: number;
    readonly GATEWAY_CRM: number;
    readonly GATEWAY_SERVICES: number;
    readonly GATEWAY_AGENDAMENTO: number;
    readonly EXTERNAL_API: number;
};
export declare const validateTimeoutHierarchy: () => void;
export declare const getTimeoutForOperation: (operation: string) => number;
export declare const createTimeoutConfig: (operationType: string) => {
    timeout: number;
    headers: {
        'X-Timeout-Policy': string;
        'X-Operation-Type': string;
    };
};
export default TIMEOUT_CONFIG;
//# sourceMappingURL=timeouts.d.ts.map