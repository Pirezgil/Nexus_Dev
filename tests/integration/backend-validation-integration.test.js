/**
 * Teste de Integração - Validação Backend com Esquema Compartilhado
 * Verifica se o backend ainda rejeita corretamente dados inválidos após a migração para esquema compartilhado
 */

const request = require('supertest');
const { ServiceValidationSchema } = require('../../shared/validation/service-schemas');

// Mock do app Express (substitua pelo seu app real nos testes)
const app = require('../../modules/services/src/app');

describe('Backend Validation Integration - Erro #10 Corrigido', () => {
  let authToken;
  let companyId;

  beforeAll(async () => {
    // Setup de autenticação e dados de teste
    // Substitua por sua lógica de autenticação
    authToken = process.env.TEST_AUTH_TOKEN || 'mock-token';
    companyId = process.env.TEST_COMPANY_ID || 'test-company-uuid';
  });

  describe('POST /api/services - Validação de Duração', () => {
    test('ERRO #10: Deve rejeitar serviço com duração acima de 480 minutos', async () => {
      const invalidService = {
        name: 'Serviço de Teste',
        description: 'Teste com duração inválida',
        duration: 481, // Acima do máximo permitido (480)
        price: 50.00,
        category: 'Teste'
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(invalidService);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/duração máxima é de 480 minutos/i);
    });

    test('ERRO #10: Deve rejeitar serviço com duração menor que 1 minuto', async () => {
      const invalidService = {
        name: 'Serviço de Teste',
        description: 'Teste com duração inválida',
        duration: 0, // Abaixo do mínimo permitido (1)
        price: 50.00,
        category: 'Teste'
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(invalidService);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/duração mínima é de 1 minuto/i);
    });

    test('ERRO #10: Deve aceitar serviço com duração válida (60 minutos)', async () => {
      const validService = {
        name: 'Serviço de Teste Válido',
        description: 'Teste com duração válida',
        duration: 60, // Dentro do range válido (1-480)
        price: 50.00,
        category: 'Teste'
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(validService);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBe(60);
    });

    test('ERRO #10: Deve aceitar exatamente o limite máximo (480 minutos)', async () => {
      const maxDurationService = {
        name: 'Serviço 8 Horas',
        description: 'Teste com duração máxima permitida',
        duration: 480, // Exatamente o máximo
        price: 200.00,
        category: 'Teste'
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(maxDurationService);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBe(480);
    });

    test('ERRO #10: Deve aceitar exatamente o limite mínimo (1 minuto)', async () => {
      const minDurationService = {
        name: 'Serviço Rápido',
        description: 'Teste com duração mínima permitida',
        duration: 1, // Exatamente o mínimo
        price: 5.00,
        category: 'Teste'
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(minDurationService);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBe(1);
    });
  });

  describe('PUT /api/services/:id - Validação de Atualização', () => {
    let serviceId;

    beforeAll(async () => {
      // Criar um serviço para testar atualizações
      const service = {
        name: 'Serviço para Atualização',
        duration: 30,
        price: 25.00
      };

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(service);

      serviceId = response.body.data.id;
    });

    test('ERRO #10: Deve rejeitar atualização com duração inválida', async () => {
      const invalidUpdate = {
        duration: 500 // Acima do máximo
      };

      const response = await request(app)
        .put(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/duração máxima é de 480 minutos/i);
    });

    test('ERRO #10: Deve aceitar atualização com duração válida', async () => {
      const validUpdate = {
        duration: 120 // Duração válida
      };

      const response = await request(app)
        .put(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Company-ID', companyId)
        .set('X-Gateway-Source', 'nexus-api-gateway')
        .send(validUpdate);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duration).toBe(120);
    });
  });

  describe('Consistência do Schema Compartilhado', () => {
    test('Deve usar exatamente as mesmas regras de validação do schema compartilhado', () => {
      // Verificar se o schema backend importado tem as mesmas regras
      const testData = {
        companyId: 'test-uuid',
        name: 'Teste',
        duration: 481,
        price: 50
      };

      const result = ServiceValidationSchema.safeParse(testData);
      
      expect(result.success).toBe(false);
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['duration'],
            message: expect.stringMatching(/duração máxima é de 480 minutos/i)
          })
        ])
      );
    });

    test('Schema compartilhado deve aceitar dados válidos', () => {
      const validData = {
        companyId: 'test-uuid',
        name: 'Serviço Teste',
        duration: 60,
        price: 50
      };

      const result = ServiceValidationSchema.safeParse(validData);
      
      expect(result.success).toBe(true);
      expect(result.data.duration).toBe(60);
    });
  });
});

/**
 * Teste de Carga - Múltiplas Validações
 */
describe('Performance - Validação em Lote', () => {
  test('Deve validar múltiplos serviços rapidamente', async () => {
    const services = Array.from({ length: 100 }, (_, i) => ({
      companyId: 'test-uuid',
      name: `Serviço ${i}`,
      duration: Math.floor(Math.random() * 480) + 1, // 1-480 minutos
      price: Math.floor(Math.random() * 200) + 10 // 10-200 reais
    }));

    const startTime = Date.now();
    
    const validations = services.map(service => 
      ServiceValidationSchema.safeParse(service)
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Deve validar 100 serviços em menos de 100ms
    expect(executionTime).toBeLessThan(100);
    
    // Todos devem ser válidos
    const allValid = validations.every(result => result.success);
    expect(allValid).toBe(true);
  });
});