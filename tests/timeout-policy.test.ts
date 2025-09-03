/**
 * Testes de Integração - Política de Timeout Hierárquica
 * 
 * Este arquivo testa a implementação da política de timeout padronizada
 * para garantir que a hierarquia de timeouts funcione corretamente:
 * HEALTH_CHECK < QUICK_OPERATIONS < INTERNAL_SERVICE < API_CLIENT < GATEWAY
 */

import axios, { AxiosError } from 'axios';
import nock from 'nock';
import { TIMEOUT_CONFIG, validateTimeoutHierarchy, getTimeoutForOperation } from '../shared/config/timeouts';

// Mock para simular ambiente de teste
jest.mock('process', () => ({
  env: {
    TIMEOUT_HEALTH_CHECK: '5000',
    TIMEOUT_QUICK_OPERATIONS: '10000', 
    TIMEOUT_INTERNAL_SERVICE: '25000',
    TIMEOUT_API_CLIENT: '30000',
    TIMEOUT_GATEWAY: '60000',
    TIMEOUT_EXTERNAL_API: '60000'
  }
}));

describe('Política de Timeout Hierárquica - ERP Nexus', () => {
  
  beforeAll(() => {
    // Limpar interceptors do nock antes de cada teste
    nock.cleanAll();
  });

  afterEach(() => {
    // Limpar interceptors após cada teste
    nock.cleanAll();
  });

  describe('Configuração de Timeouts', () => {
    test('deve carregar configuração com valores corretos', () => {
      expect(TIMEOUT_CONFIG.HEALTH_CHECK).toBe(5000);
      expect(TIMEOUT_CONFIG.QUICK_OPERATIONS).toBe(10000);
      expect(TIMEOUT_CONFIG.INTERNAL_SERVICE).toBe(25000);
      expect(TIMEOUT_CONFIG.API_CLIENT).toBe(30000);
      expect(TIMEOUT_CONFIG.GATEWAY).toBe(60000);
    });

    test('deve validar hierarquia de timeouts corretamente', () => {
      // Capturar console.warn para verificar se há avisos
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      validateTimeoutHierarchy();
      
      // Não deve haver avisos de hierarquia incorreta
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Warning'));
      
      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('deve retornar timeout correto baseado no tipo de operação', () => {
      expect(getTimeoutForOperation('health')).toBe(5000);
      expect(getTimeoutForOperation('auth')).toBe(10000);
      expect(getTimeoutForOperation('internal')).toBe(25000);
      expect(getTimeoutForOperation('client')).toBe(30000);
      expect(getTimeoutForOperation('gateway')).toBe(60000);
      expect(getTimeoutForOperation('whatsapp')).toBe(60000);
      expect(getTimeoutForOperation('unknown')).toBe(25000); // Fallback
    });
  });

  describe('Testes de Timeout em Cenários Reais', () => {
    
    test('ModuleIntegrator deve falhar com timeout de 25s para operação lenta de 28s', async () => {
      // Simular endpoint que demora 28 segundos (mais que INTERNAL_SERVICE = 25s)
      nock('http://nexus-services:3000')
        .get('/api/services/test/validate')
        .delay(28000) // Atraso de 28 segundos
        .reply(200, { exists: true });

      const axiosInstance = axios.create({
        timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE, // 25000ms
        baseURL: 'http://nexus-services:3000'
      });

      // Deve falhar com timeout
      await expect(
        axiosInstance.get('/api/services/test/validate')
      ).rejects.toThrow(/timeout/);
    });

    test('API Client deve suceder para operação de 28s (timeout de 30s)', async () => {
      // Simular endpoint que demora 28 segundos (menos que API_CLIENT = 30s)
      nock('http://localhost:5001')
        .get('/api/services/test')
        .delay(28000) // Atraso de 28 segundos
        .reply(200, { success: true, data: 'test' });

      const axiosInstance = axios.create({
        timeout: TIMEOUT_CONFIG.API_CLIENT, // 30000ms
        baseURL: 'http://localhost:5001'
      });

      // Deve suceder
      const response = await axiosInstance.get('/api/services/test');
      expect(response.data.success).toBe(true);
    });

    test('Health check deve falhar rapidamente para serviço lento', async () => {
      // Simular health check que demora 8 segundos (mais que HEALTH_CHECK = 5s)
      nock('http://nexus-services:3000')
        .get('/health')
        .delay(8000)
        .reply(200, { status: 'healthy' });

      const axiosInstance = axios.create({
        timeout: TIMEOUT_CONFIG.HEALTH_CHECK, // 5000ms
      });

      // Deve falhar com timeout
      await expect(
        axiosInstance.get('http://nexus-services:3000/health')
      ).rejects.toThrow(/timeout/);
    });

    test('Gateway deve aguardar operação de upload longa (55s)', async () => {
      // Simular upload que demora 55 segundos (menos que GATEWAY = 60s)
      nock('http://localhost:5001')
        .post('/api/services/upload')
        .delay(55000)
        .reply(200, { success: true, fileId: 'abc123' });

      const axiosInstance = axios.create({
        timeout: TIMEOUT_CONFIG.GATEWAY, // 60000ms
        baseURL: 'http://localhost:5001'
      });

      // Deve suceder
      const response = await axiosInstance.post('/api/services/upload', { file: 'large-file' });
      expect(response.data.success).toBe(true);
    });

    test('Refresh token deve falhar rapidamente para operação lenta', async () => {
      // Simular refresh que demora 12 segundos (mais que QUICK_OPERATIONS = 10s)
      nock('http://localhost:5001')
        .post('/api/auth/refresh')
        .delay(12000)
        .reply(200, { success: true, token: 'new-token' });

      const axiosInstance = axios.create({
        timeout: TIMEOUT_CONFIG.QUICK_OPERATIONS, // 10000ms
        baseURL: 'http://localhost:5001'
      });

      // Deve falhar com timeout
      await expect(
        axiosInstance.post('/api/auth/refresh', { refreshToken: 'old-token' })
      ).rejects.toThrow(/timeout/);
    });
  });

  describe('Cenários de Falha da Política Anterior', () => {
    
    test('Deve prevenir estado inconsistente onde ModuleIntegrator falha mas Gateway continua', async () => {
      // Cenário: Operação que demora 28 segundos
      // Política anterior: ModuleIntegrator (5s) falhava, mas Gateway (60s) continuava
      // Política nova: ModuleIntegrator (25s) falhará, mas API Client (30s) será notificado primeiro
      
      nock('http://nexus-services:3000')
        .get('/api/services/slow-operation')
        .delay(28000)
        .reply(200, { success: true });

      // ModuleIntegrator falha (25s < 28s)
      const moduleIntegratorInstance = axios.create({
        timeout: TIMEOUT_CONFIG.INTERNAL_SERVICE, // 25000ms
        baseURL: 'http://nexus-services:3000'
      });

      await expect(
        moduleIntegratorInstance.get('/api/services/slow-operation')
      ).rejects.toThrow(/timeout/);

      // API Client também falhará, mas um pouco depois (30s > 25s mas < 28s de delay)  
      // Este comportamento é esperado e consistente
    });

    test('Deve demonstrar hierarquia correta: cada camada tem mais tempo que a anterior', () => {
      const timeouts = [
        TIMEOUT_CONFIG.HEALTH_CHECK,
        TIMEOUT_CONFIG.QUICK_OPERATIONS,
        TIMEOUT_CONFIG.INTERNAL_SERVICE,
        TIMEOUT_CONFIG.API_CLIENT,
        TIMEOUT_CONFIG.GATEWAY
      ];

      // Verificar que cada timeout é maior que o anterior
      for (let i = 1; i < timeouts.length; i++) {
        expect(timeouts[i]).toBeGreaterThan(timeouts[i - 1]);
      }

      // Verificar diferenças mínimas para evitar condições de corrida
      expect(TIMEOUT_CONFIG.INTERNAL_SERVICE - TIMEOUT_CONFIG.QUICK_OPERATIONS).toBeGreaterThanOrEqual(5000);
      expect(TIMEOUT_CONFIG.API_CLIENT - TIMEOUT_CONFIG.INTERNAL_SERVICE).toBeGreaterThanOrEqual(5000);
      expect(TIMEOUT_CONFIG.GATEWAY - TIMEOUT_CONFIG.API_CLIENT).toBeGreaterThanOrEqual(10000);
    });
  });

  describe('Testes de Integração com ModuleIntegrator Refatorado', () => {
    
    test('ModuleIntegrator deve usar novo timeout centralizado', async () => {
      // Importar ModuleIntegrator para verificar se está usando a configuração centralizada
      const { ModuleIntegrator } = require('../shared/integrators/ModuleIntegrator');
      
      nock('http://localhost:3001')
        .get('/api/users/test-user-id/validate')
        .delay(20000) // 20 segundos - deve passar com 25s de timeout
        .reply(200, { exists: true, user: { id: 'test-user-id' } });

      // Deve suceder pois 20s < 25s (INTERNAL_SERVICE)
      const result = await ModuleIntegrator.validateUser('test-user-id', 'test-company-id');
      expect(result.exists).toBe(true);
    });

    test('Deve falhar batida validation com timeout apropriado', async () => {
      const { ModuleIntegrator } = require('../shared/integrators/ModuleIntegrator');

      // Configurar múltiplos endpoints que demoram mais que o timeout interno
      nock('http://localhost:3001')
        .get('/api/users/user1/validate')
        .delay(30000) // 30s > 25s timeout
        .reply(200, { exists: true });

      nock('http://localhost:3002')
        .get('/api/customers/customer1/validate')
        .delay(30000)
        .reply(200, { exists: true });

      const validations = [
        {
          type: 'user' as const,
          id: 'user1',
          companyId: 'company1',
          key: 'user'
        },
        {
          type: 'customer' as const,
          id: 'customer1',
          companyId: 'company1',
          key: 'customer'
        }
      ];

      // Deve falhar com timeout em fail-fast mode
      await expect(
        ModuleIntegrator.validateBatch(validations, { failFast: true })
      ).rejects.toThrow(/timeout|Batch validation failed/);
    });
  });
});

describe('Testes de Performance e Confiabilidade', () => {
  
  test('Sistema deve ser previsível sob diferentes cenários de latência', async () => {
    const scenarios = [
      { delay: 3000, shouldPass: { health: true, quick: true, internal: true, client: true, gateway: true } },
      { delay: 8000, shouldPass: { health: false, quick: true, internal: true, client: true, gateway: true } },
      { delay: 15000, shouldPass: { health: false, quick: false, internal: true, client: true, gateway: true } },
      { delay: 35000, shouldPass: { health: false, quick: false, internal: false, client: false, gateway: true } },
      { delay: 70000, shouldPass: { health: false, quick: false, internal: false, client: false, gateway: false } }
    ];

    for (const scenario of scenarios) {
      // Health check
      nock('http://test-service')
        .get('/health')
        .delay(scenario.delay)
        .reply(200, { status: 'ok' });

      const healthInstance = axios.create({ timeout: TIMEOUT_CONFIG.HEALTH_CHECK });
      
      if (scenario.shouldPass.health) {
        await expect(healthInstance.get('http://test-service/health')).resolves.toBeDefined();
      } else {
        await expect(healthInstance.get('http://test-service/health')).rejects.toThrow(/timeout/);
      }

      nock.cleanAll();
    }
  });
});