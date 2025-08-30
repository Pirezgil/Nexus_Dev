"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsCache = exports.AnalyticsCacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
/**
 * Serviço de cache especializado para Analytics
 * Gerencia cache inteligente baseado em TTL dinâmico e invalidação por contexto
 */
class AnalyticsCacheService {
    redis;
    prefix = 'analytics:';
    constructor() {
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            lazyConnect: true,
        });
        this.redis.on('error', (error) => {
            logger_1.logger.error('Redis connection error:', { error });
        });
        this.redis.on('connect', () => {
            logger_1.logger.info('Connected to Redis for analytics cache');
        });
    }
    // ===============================
    // CACHE METHODS
    // ===============================
    /**
     * Obtém dados do cache
     */
    async get(key) {
        try {
            const cacheKey = this.buildKey(key);
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                logger_1.logger.debug(`Cache HIT for key: ${key}`);
                return JSON.parse(cached);
            }
            logger_1.logger.debug(`Cache MISS for key: ${key}`);
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting from cache:', { error, key });
            return null;
        }
    }
    /**
     * Armazena dados no cache com TTL
     */
    async set(key, data, ttlSeconds) {
        try {
            const cacheKey = this.buildKey(key);
            const value = JSON.stringify(data);
            if (ttlSeconds) {
                await this.redis.setex(cacheKey, ttlSeconds, value);
            }
            else {
                await this.redis.set(cacheKey, value);
            }
            logger_1.logger.debug(`Cache SET for key: ${key} (TTL: ${ttlSeconds}s)`);
        }
        catch (error) {
            logger_1.logger.error('Error setting cache:', { error, key });
        }
    }
    /**
     * Cache com callback automático (get-or-set pattern)
     */
    async getOrSet(key, callback, ttlSeconds = 300) {
        // Tenta buscar do cache
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        // Cache miss - executa callback e armazena resultado
        try {
            const data = await callback();
            await this.set(key, data, ttlSeconds);
            return data;
        }
        catch (error) {
            logger_1.logger.error('Error in getOrSet callback:', { error, key });
            throw error;
        }
    }
    /**
     * Remove chave específica do cache
     */
    async del(key) {
        try {
            const cacheKey = this.buildKey(key);
            await this.redis.del(cacheKey);
            logger_1.logger.debug(`Cache DEL for key: ${key}`);
        }
        catch (error) {
            logger_1.logger.error('Error deleting from cache:', { error, key });
        }
    }
    /**
     * Remove múltiplas chaves por padrão
     */
    async delPattern(pattern) {
        try {
            const searchPattern = this.buildKey(pattern);
            const keys = await this.redis.keys(searchPattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger_1.logger.info(`Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error deleting pattern from cache:', { error, pattern });
        }
    }
    // ===============================
    // ANALYTICS SPECIFIC METHODS
    // ===============================
    /**
     * Cache para KPIs do dashboard (TTL: 5 minutos)
     */
    async getDashboardKPIs(companyId, period) {
        const key = `dashboard:kpis:${companyId}:${period}`;
        return this.get(key);
    }
    async setDashboardKPIs(companyId, period, data) {
        const key = `dashboard:kpis:${companyId}:${period}`;
        const ttl = this.getTTLForPeriod(period);
        return this.set(key, data, ttl);
    }
    /**
     * Cache para gráfico de receita (TTL: 10 minutos)
     */
    async getRevenueChart(companyId) {
        const key = `revenue:chart:${companyId}`;
        return this.get(key);
    }
    async setRevenueChart(companyId, data) {
        const key = `revenue:chart:${companyId}`;
        return this.set(key, data, 10 * 60); // 10 minutos
    }
    /**
     * Cache para estatísticas de CRM (TTL: 15 minutos)
     */
    async getCRMStats(companyId, period) {
        const key = `crm:stats:${companyId}${period ? `:${period}` : ''}`;
        return this.get(key);
    }
    async setCRMStats(companyId, data, period) {
        const key = `crm:stats:${companyId}${period ? `:${period}` : ''}`;
        const ttl = period ? this.getTTLForPeriod(period) : 15 * 60;
        return this.set(key, data, ttl);
    }
    /**
     * Cache para estatísticas de Services (TTL: 10 minutos)
     */
    async getServicesStats(companyId, period) {
        const key = `services:stats:${companyId}${period ? `:${period}` : ''}`;
        return this.get(key);
    }
    async setServicesStats(companyId, data, period) {
        const key = `services:stats:${companyId}${period ? `:${period}` : ''}`;
        const ttl = period ? this.getTTLForPeriod(period) : 10 * 60;
        return this.set(key, data, ttl);
    }
    /**
     * Cache para relatórios customizados (TTL: 30 minutos)
     */
    async getCustomReport(companyId, reportType, params) {
        const paramHash = params ? this.hashParams(params) : '';
        const key = `reports:${reportType}:${companyId}${paramHash ? `:${paramHash}` : ''}`;
        return this.get(key);
    }
    async setCustomReport(companyId, reportType, data, params) {
        const paramHash = params ? this.hashParams(params) : '';
        const key = `reports:${reportType}:${companyId}${paramHash ? `:${paramHash}` : ''}`;
        return this.set(key, data, 30 * 60); // 30 minutos
    }
    // ===============================
    // INVALIDATION METHODS
    // ===============================
    /**
     * Invalida todos os caches de uma empresa
     */
    async invalidateCompany(companyId) {
        await this.delPattern(`*:${companyId}:*`);
        await this.delPattern(`*:${companyId}`);
    }
    /**
     * Invalida caches relacionados a CRM
     */
    async invalidateCRM(companyId) {
        await this.delPattern(`crm:*:${companyId}*`);
        await this.delPattern(`dashboard:kpis:${companyId}*`);
    }
    /**
     * Invalida caches relacionados a Services
     */
    async invalidateServices(companyId) {
        await this.delPattern(`services:*:${companyId}*`);
        await this.delPattern(`revenue:*:${companyId}*`);
        await this.delPattern(`dashboard:kpis:${companyId}*`);
    }
    /**
     * Invalida caches relacionados a Agendamento
     */
    async invalidateAgendamento(companyId) {
        await this.delPattern(`agendamento:*:${companyId}*`);
        await this.delPattern(`dashboard:kpis:${companyId}*`);
    }
    /**
     * Invalida todos os relatórios
     */
    async invalidateReports(companyId) {
        await this.delPattern(`reports:*:${companyId}*`);
    }
    // ===============================
    // UTILITY METHODS
    // ===============================
    /**
     * Constrói chave completa do cache
     */
    buildKey(key) {
        return `${this.prefix}${key}`;
    }
    /**
     * Determina TTL baseado no período
     */
    getTTLForPeriod(period) {
        switch (period) {
            case 'today':
                return 2 * 60; // 2 minutos
            case 'week':
                return 10 * 60; // 10 minutos
            case 'month':
                return 30 * 60; // 30 minutos
            case 'quarter':
                return 60 * 60; // 1 hora
            default:
                return 5 * 60; // 5 minutos
        }
    }
    /**
     * Gera hash dos parâmetros para cache key
     */
    hashParams(params) {
        const str = JSON.stringify(params, Object.keys(params).sort());
        return Buffer.from(str).toString('base64').slice(0, 10);
    }
    /**
     * Obtém informações do cache
     */
    async getCacheInfo() {
        try {
            const keys = await this.redis.keys(`${this.prefix}*`);
            const memory = await this.redis.memory('usage');
            return {
                totalKeys: keys.length,
                memoryUsage: memory,
                keysByType: this.groupKeysByType(keys),
                redisInfo: await this.redis.info('memory')
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting cache info:', { error });
            return null;
        }
    }
    /**
     * Agrupa chaves por tipo para estatísticas
     */
    groupKeysByType(keys) {
        const groups = {};
        keys.forEach(key => {
            const parts = key.replace(this.prefix, '').split(':');
            const type = parts[0];
            groups[type] = (groups[type] || 0) + 1;
        });
        return groups;
    }
    /**
     * Limpa todo o cache de analytics
     */
    async clearAll() {
        try {
            const keys = await this.redis.keys(`${this.prefix}*`);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger_1.logger.info(`Cleared ${keys.length} analytics cache keys`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error clearing all cache:', { error });
        }
    }
    /**
     * Fecha conexão Redis
     */
    async disconnect() {
        await this.redis.disconnect();
        logger_1.logger.info('Disconnected from Redis analytics cache');
    }
    /**
     * Health check do Redis
     */
    async healthCheck() {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        }
        catch (error) {
            logger_1.logger.error('Redis health check failed:', { error });
            return false;
        }
    }
}
exports.AnalyticsCacheService = AnalyticsCacheService;
// Singleton instance
let cacheInstance = null;
const getAnalyticsCache = () => {
    if (!cacheInstance) {
        cacheInstance = new AnalyticsCacheService();
    }
    return cacheInstance;
};
exports.getAnalyticsCache = getAnalyticsCache;
exports.default = AnalyticsCacheService;
//# sourceMappingURL=AnalyticsCacheService.js.map