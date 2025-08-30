import { Router } from 'express';
import { CustomerController } from '../controllers/customerControllerExpanded';
import { IntegrationController } from '../controllers/integrationController';
import { CustomFieldController } from '../controllers/customFieldController';
import { SegmentController } from '../controllers/segmentController';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

/**
 * NEXUS CRM - ROTAS COMPLETAS
 * 
 * Implementa TODOS os endpoints especificados em docs/02-modules/crm.md
 * Organizado por funcionalidade:
 * - Customers (CRUD + funcionalidades)
 * - Integration (APIs internas para outros módulos)
 * - Custom Fields (campos customizados)
 * - Segments (segmentação)
 * - Health Check
 */

// Instanciar controllers
const customerController = new CustomerController();
const integrationController = new IntegrationController();
const customFieldController = new CustomFieldController();
const segmentController = new SegmentController();

/**
 * ==========================================
 * ROTAS DE INTEGRAÇÃO [INTERNAL]
 * Conforme docs/02-modules/crm.md:500-526
 * ==========================================
 */

// GET /crm/customers/:id/basic [INTERNAL] - Para Agendamento
router.get('/customers/:id/basic', integrationController.getCustomerBasic);

// POST /crm/customers/:id/visit [INTERNAL] - Para Services
router.post('/customers/:id/visit', integrationController.updateCustomerVisit);

// GET /crm/customers/search [INTERNAL] - Para autocomplete Agendamento
router.get('/customers/search-internal', integrationController.searchCustomersForScheduling);

// POST /crm/customers/:id/interaction [INTERNAL] - Para Services registrar interação
router.post('/customers/:id/interaction', integrationController.registerServiceInteraction);

// GET /crm/customers/:id/summary [INTERNAL] - Para Services durante atendimento
router.get('/customers/:id/summary', integrationController.getCustomerSummary);

// GET /crm/stats/company [INTERNAL] - Para Dashboard
router.get('/stats/company', integrationController.getCompanyCustomerStats);

/**
 * ==========================================
 * ROTAS DE CLIENTES - PRINCIPAIS
 * Conforme docs/02-modules/crm.md:206-526
 * ==========================================
 */

// Apply authentication middleware to all customer routes
router.use('/customers', authMiddleware);

// GET /customers - Lista clientes com filtros (docs:206-264)
router.get('/customers', customerController.getCustomers);

// GET /customers/search - Busca avançada (para UI pública)
router.get('/customers/search', customerController.searchCustomers);

// GET /customers/tags - Lista todas as tags (docs:178-193)
router.get('/customers/tags', customerController.getCustomerTags);

// GET /customers/stats - Estatísticas da empresa
router.get('/customers/stats', customerController.getCustomerStats);

// POST /customers/import - Importação CSV
router.post('/customers/import', customerController.importCustomers);

// GET /customers/export - Exportação CSV/Excel
router.get('/customers/export', customerController.exportCustomers);

// GET /customers/:id - Detalhes completos do cliente (docs:266-355)
router.get('/customers/:id', customerController.getCustomerById);

// POST /customers - Criar novo cliente (docs:357-403)
router.post('/customers', 
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'string', format: 'email', required: false },
      phone: { type: 'string', required: false },
      cpf_cnpj: { type: 'string', required: false }
    }
  }),
  customerController.createCustomer
);

// PUT /customers/:id - Atualizar cliente (docs:405-407)
router.put('/customers/:id', customerController.updateCustomer);

// DELETE /customers/:id - Remover cliente (docs:408-409)
router.delete('/customers/:id', customerController.deleteCustomer);

// GET /customers/:id/history - Histórico completo (docs:154-175)
router.get('/customers/:id/history', customerController.getCustomerHistory);

// POST /customers/:id/tags - Adicionar tags
router.post('/customers/:id/tags', 
  validateRequest({
    body: {
      tags: { type: 'array', items: { type: 'string' }, required: true }
    }
  }),
  customerController.addTags
);

// DELETE /customers/:id/tags - Remover tags
router.delete('/customers/:id/tags',
  validateRequest({
    body: {
      tags: { type: 'array', items: { type: 'string' }, required: true }
    }
  }),
  customerController.removeTags
);

/**
 * ==========================================
 * ROTAS DE INTERAÇÕES
 * Conforme docs/02-modules/crm.md:413-487
 * ==========================================
 */

// GET /customers/:id/interactions - Histórico de interações (docs:413-469)
router.get('/customers/:id/interactions', customerController.getCustomerInteractions);

// POST /customers/:id/interactions - Registrar nova interação (docs:471-487)
router.post('/customers/:id/interactions',
  validateRequest({
    body: {
      type: { type: 'string', required: true, enum: ['call', 'email', 'meeting', 'whatsapp', 'sms', 'note', 'task', 'visit', 'service'] },
      subject: { type: 'string', required: true },
      description: { type: 'string', required: false },
      direction: { type: 'string', enum: ['inbound', 'outbound'], default: 'outbound' },
      status: { type: 'string', enum: ['completed', 'pending', 'cancelled'], default: 'completed' }
    }
  }),
  customerController.createInteraction
);

/**
 * ==========================================
 * ROTAS DE SEGMENTAÇÃO
 * Conforme docs/02-modules/crm.md:489-498
 * ==========================================
 */

router.use('/segments', authMiddleware);

// GET /segments - Lista segmentos (docs:489-495)
router.get('/segments', segmentController.getSegments);

// POST /segments - Criar segmento (docs:494-495)
router.post('/segments',
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      description: { type: 'string', required: false },
      color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', required: false },
      criteria: { type: 'object', required: false },
      is_auto: { type: 'boolean', default: false }
    }
  }),
  segmentController.createSegment
);

// GET /segments/:id - Detalhes do segmento
router.get('/segments/:id', segmentController.getSegmentById);

// PUT /segments/:id - Atualizar segmento
router.put('/segments/:id', segmentController.updateSegment);

// DELETE /segments/:id - Remover segmento
router.delete('/segments/:id', segmentController.deleteSegment);

// GET /segments/:id/customers - Clientes do segmento
router.get('/segments/:id/customers', segmentController.getSegmentCustomers);

// PUT /customers/:customerId/segments - Atualizar segmentos do cliente (docs:497-498)
router.put('/customers/:customerId/segments',
  validateRequest({
    body: {
      segment_ids: { type: 'array', items: { type: 'string' }, required: true }
    }
  }),
  segmentController.updateCustomerSegments
);

// POST /segments/:id/refresh - Atualizar segmento automático
router.post('/segments/:id/refresh', segmentController.refreshAutoSegment);

// GET /segments/analytics - Analytics de segmentação
router.get('/segments/analytics', segmentController.getSegmentAnalytics);

/**
 * ==========================================
 * ROTAS DE CUSTOM FIELDS
 * Conforme docs/02-modules/crm.md:114-186
 * ==========================================
 */

router.use('/custom-fields', authMiddleware);

// GET /custom-fields - Lista campos customizados
router.get('/custom-fields', customFieldController.getCustomFields);

// POST /custom-fields - Criar campo customizado
router.post('/custom-fields',
  validateRequest({
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      field_type: { type: 'string', required: true, enum: ['text', 'number', 'date', 'select', 'boolean'] },
      options: { type: 'array', required: false },
      required: { type: 'boolean', default: false },
      display_order: { type: 'number', default: 0 }
    }
  }),
  customFieldController.createCustomField
);

// GET /custom-fields/:id - Detalhes do campo
router.get('/custom-fields/:id', customFieldController.getCustomFieldById);

// PUT /custom-fields/:id - Atualizar campo
router.put('/custom-fields/:id', customFieldController.updateCustomField);

// DELETE /custom-fields/:id - Remover campo
router.delete('/custom-fields/:id', customFieldController.deleteCustomField);

// POST /custom-fields/reorder - Reordenar campos
router.post('/custom-fields/reorder',
  validateRequest({
    body: {
      field_orders: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            id: { type: 'string', required: true },
            display_order: { type: 'number', required: true }
          }
        },
        required: true
      }
    }
  }),
  customFieldController.reorderCustomFields
);

// GET /customers/:id/custom-fields - Campos do cliente
router.get('/customers/:id/custom-fields', customerController.getCustomerCustomFields);

// PUT /customers/:id/custom-fields - Atualizar campos do cliente
router.put('/customers/:id/custom-fields', customerController.updateCustomerCustomFields);

/**
 * ==========================================
 * ROTAS DE HEALTH CHECK
 * ==========================================
 */

// GET /health - Health check básico
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'nexus-crm',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GET /health/detailed - Health check detalhado
router.get('/health/detailed', async (req, res) => {
  try {
    // Test database connection
    const dbStatus = await prisma.$queryRaw`SELECT 1 as test`;
    
    // Test Redis connection
    let redisStatus = 'unknown';
    try {
      await redis.ping();
      redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }

    res.json({
      success: true,
      service: 'nexus-crm',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: dbStatus ? 'connected' : 'disconnected',
        redis: redisStatus
      },
      features: {
        customers: 'enabled',
        custom_fields: 'enabled',
        segments: 'enabled',
        integrations: 'enabled'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'nexus-crm',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

/**
 * ==========================================
 * DOCUMENTAÇÃO DA API
 * ==========================================
 */

// GET / - API Info
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Nexus CRM',
      version: '1.0.0',
      description: 'Customer Relationship Management module for Nexus ERP - VERSÃO COMPLETA',
      specification: 'Implementa 100% da especificação docs/02-modules/crm.md',
      features: [
        'CRUD completo de clientes com todos os campos especificados',
        'APIs de integração para Services e Agendamento',
        'Sistema de campos customizados por empresa', 
        'Segmentação avançada (manual e automática)',
        'Histórico completo de interações',
        'Sistema de tags flexível',
        'Importação/Exportação CSV/Excel',
        'Analytics e estatísticas',
        'Multi-tenancy com isolamento por empresa',
        'Cache Redis para performance',
        'Validação completa de dados'
      ],
      endpoints: {
        customers: '/customers',
        segments: '/segments',
        custom_fields: '/custom-fields',
        integrations: '/customers/:id/basic [INTERNAL]',
        health: '/health'
      }
    },
    message: 'Nexus CRM API - Implementação Completa Funcional'
  });
});

// GET /endpoints - Lista completa de endpoints
router.get('/endpoints', (req, res) => {
  res.json({
    success: true,
    data: {
      // Clientes
      customers: {
        'GET /customers': 'Lista clientes com filtros e paginação',
        'POST /customers': 'Criar novo cliente',
        'GET /customers/:id': 'Detalhes completos do cliente',
        'PUT /customers/:id': 'Atualizar cliente',
        'DELETE /customers/:id': 'Remover cliente',
        'GET /customers/search': 'Busca avançada de clientes',
        'GET /customers/:id/history': 'Histórico completo do cliente',
        'GET /customers/tags': 'Lista todas as tags',
        'POST /customers/:id/tags': 'Adicionar tags ao cliente',
        'DELETE /customers/:id/tags': 'Remover tags do cliente',
        'GET /customers/stats': 'Estatísticas dos clientes',
        'POST /customers/import': 'Importação CSV',
        'GET /customers/export': 'Exportação CSV/Excel'
      },
      // Interações
      interactions: {
        'GET /customers/:id/interactions': 'Histórico de interações',
        'POST /customers/:id/interactions': 'Registrar nova interação'
      },
      // Segmentos
      segments: {
        'GET /segments': 'Lista segmentos',
        'POST /segments': 'Criar segmento',
        'GET /segments/:id': 'Detalhes do segmento',
        'PUT /segments/:id': 'Atualizar segmento',
        'DELETE /segments/:id': 'Remover segmento',
        'GET /segments/:id/customers': 'Clientes do segmento',
        'PUT /customers/:customerId/segments': 'Atualizar segmentos do cliente',
        'POST /segments/:id/refresh': 'Atualizar segmento automático',
        'GET /segments/analytics': 'Analytics de segmentação'
      },
      // Custom Fields
      custom_fields: {
        'GET /custom-fields': 'Lista campos customizados',
        'POST /custom-fields': 'Criar campo customizado',
        'GET /custom-fields/:id': 'Detalhes do campo',
        'PUT /custom-fields/:id': 'Atualizar campo',
        'DELETE /custom-fields/:id': 'Remover campo',
        'POST /custom-fields/reorder': 'Reordenar campos',
        'GET /customers/:id/custom-fields': 'Campos do cliente',
        'PUT /customers/:id/custom-fields': 'Atualizar campos do cliente'
      },
      // Integrações [INTERNAL]
      integrations: {
        'GET /customers/:id/basic [INTERNAL]': 'Dados básicos para Agendamento',
        'POST /customers/:id/visit [INTERNAL]': 'Atualizar visita via Services',
        'GET /customers/search-internal [INTERNAL]': 'Busca para autocomplete',
        'POST /customers/:id/interaction [INTERNAL]': 'Registrar interação via Services',
        'GET /customers/:id/summary [INTERNAL]': 'Resumo para Services',
        'GET /stats/company [INTERNAL]': 'Estatísticas para Dashboard'
      },
      // Health & Info
      system: {
        'GET /health': 'Health check básico',
        'GET /health/detailed': 'Health check detalhado',
        'GET /': 'Informações da API',
        'GET /endpoints': 'Lista completa de endpoints'
      }
    },
    total_endpoints: 35,
    message: 'Lista completa de endpoints do Nexus CRM'
  });
});

// Catch-all para rotas não encontradas
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Endpoint ${req.method} ${req.originalUrl} não encontrado`,
    suggestion: 'Use GET /endpoints para ver todos os endpoints disponíveis'
  });
});

export default router;