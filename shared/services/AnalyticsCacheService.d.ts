/**
 * Serviço de cache especializado para Analytics
 * Gerencia cache inteligente baseado em TTL dinâmico e invalidação por contexto
 */
export declare class AnalyticsCacheService {
    private redis;
    private readonly prefix;
    constructor();
    /**
     * Obtém dados do cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Armazena dados no cache com TTL
     */
    set<T>(key: string, data: T, ttlSeconds?: number): Promise<void>;
    /**
     * Cache com callback automático (get-or-set pattern)
     */
    getOrSet<T>(key: string, callback: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    /**
     * Remove chave específica do cache
     */
    del(key: string): Promise<void>;
    /**
     * Remove múltiplas chaves por padrão
     */
    delPattern(pattern: string): Promise<void>;
    /**
     * Cache para KPIs do dashboard (TTL: 5 minutos)
     */
    getDashboardKPIs(companyId: string, period: string): Promise<unknown>;
    setDashboardKPIs(companyId: string, period: string, data: any): Promise<void>;
    /**
     * Cache para gráfico de receita (TTL: 10 minutos)
     */
    getRevenueChart(companyId: string): Promise<unknown>;
    setRevenueChart(companyId: string, data: any): Promise<void>;
    /**
     * Cache para estatísticas de CRM (TTL: 15 minutos)
     */
    getCRMStats(companyId: string, period?: string): Promise<unknown>;
    setCRMStats(companyId: string, data: any, period?: string): Promise<void>;
    /**
     * Cache para estatísticas de Services (TTL: 10 minutos)
     */
    getServicesStats(companyId: string, period?: string): Promise<unknown>;
    setServicesStats(companyId: string, data: any, period?: string): Promise<void>;
    /**
     * Cache para relatórios customizados (TTL: 30 minutos)
     */
    getCustomReport(companyId: string, reportType: string, params?: any): Promise<unknown>;
    setCustomReport(companyId: string, reportType: string, data: any, params?: any): Promise<void>;
    /**
     * Invalida todos os caches de uma empresa
     */
    invalidateCompany(companyId: string): Promise<void>;
    /**
     * Invalida caches relacionados a CRM
     */
    invalidateCRM(companyId: string): Promise<void>;
    /**
     * Invalida caches relacionados a Services
     */
    invalidateServices(companyId: string): Promise<void>;
    /**
     * Invalida caches relacionados a Agendamento
     */
    invalidateAgendamento(companyId: string): Promise<void>;
    /**
     * Invalida todos os relatórios
     */
    invalidateReports(companyId: string): Promise<void>;
    /**
     * Constrói chave completa do cache
     */
    private buildKey;
    /**
     * Determina TTL baseado no período
     */
    private getTTLForPeriod;
    /**
     * Gera hash dos parâmetros para cache key
     */
    private hashParams;
    /**
     * Obtém informações do cache
     */
    getCacheInfo(): Promise<any>;
    /**
     * Agrupa chaves por tipo para estatísticas
     */
    private groupKeysByType;
    /**
     * Limpa todo o cache de analytics
     */
    clearAll(): Promise<void>;
    /**
     * Fecha conexão Redis
     */
    disconnect(): Promise<void>;
    /**
     * Health check do Redis
     */
    healthCheck(): Promise<boolean>;
}
export declare const getAnalyticsCache: () => AnalyticsCacheService;
export default AnalyticsCacheService;
//# sourceMappingURL=AnalyticsCacheService.d.ts.map