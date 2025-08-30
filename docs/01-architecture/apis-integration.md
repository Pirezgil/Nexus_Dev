# Deep Dive: APIs & Integrações - Nexus ERP

Sistema de comunicação entre módulos baseado em arquitetura híbrida REST + Message Broker, com controle de cotas por empresa e monitoramento inteligente via IA.

## 1. Estratégia de Comunicação Híbrida

### Decisão Arquitetural: REST + Message Broker
Baseado em análise de **segurança** e **risco de informações incorretas**:

| Tipo | REST APIs | Message Broker | GraphQL |
|:-----|:---------:|:--------------:|:-------:|
| **Segurança** | 4/5 | 3/5 | 2/5 |
| **Risco Info Incorreta** | 2/5 | 4/5 | 3/5 |

### Aplicação por Tipo de Operação

#### REST APIs - Dados Críticos (Escolhido)
**Uso:** Operações diretas e dados críticos
- Consultar cliente, criar venda, verificar estoque
- Transações financeiras, autenticação
- Operações que precisam de resposta imediata

**Vantagens:**
- Comunicação direta e segura
- Dados sempre em tempo real
- Fácil rastreamento de erros
- HTTPS + JWT = canal seguro

#### Message Broker - Notificações e Eventos
**Uso:** Eventos não-críticos e notificações
- Logs de auditoria, relatórios, sincronizações
- Notificações de mudanças entre módulos
- Operações assíncronas que podem aguardar

**Tecnologia:** Redis Pub/Sub
- Menor risco para operações não-críticas
- Desacoplamento entre módulos
- Performance melhor para eventos em cascata

## 2. Mapeamento de Comunicação por Módulo

### REST APIs - Operações Críticas

| Módulo Origem | Módulo Destino | Operação | Endpoint | Justificativa |
|:-------------|:--------------|:---------|:---------|:-------------|
| CRM | Auth | Validar usuário | `GET /auth/validate` | Segurança crítica |
| Sales | CRM | Buscar cliente | `GET /crm/customers/:id` | Dados precisos para venda |
| Sales | Inventory | Verificar estoque | `GET /inventory/products/:id/stock` | Evitar venda sem produto |
| Sales | Inventory | Baixar estoque | `POST /inventory/products/:id/reserve` | Transação crítica |
| Financial | Sales | Confirmar pagamento | `POST /sales/orders/:id/payment` | Dados financeiros precisos |

### Message Broker - Eventos e Notificações

| Evento | Módulos Interessados | Payload | Ação |
|:-------|:-------------------|:--------|:-----|
| `customer.created` | Sales, Financial | `{customerId, name, email}` | Sincronizar cadastros |
| `sale.completed` | Inventory, Financial, Audit | `{saleId, customerId, products, total}` | Atualizar registros |
| `product.updated` | Sales, Reports | `{productId, name, price, stock}` | Refresh caches |
| `user.login` | Audit | `{userId, timestamp, ip}` | Log de segurança |
| `report.generated` | Notification | `{reportId, userId, type}` | Notificar conclusão |

## 3. Versionamento e Compatibilidade

### Ambiente de Homologação Espelhado

| Etapa | Componente | Função | Responsabilidade |
|:------|:----------|:--------|:-----------------|
| Deploy Request | `CI/CD Pipeline` | `deployToStaging()` | Sobe nova versão em ambiente isolado |
| Environment Setup | `Docker Compose` | `staging.docker-compose.yml` | Cria ambiente idêntico ao produção |
| Schema Migration | `Migration Scripts` | `runStagingMigrations()` | Aplica mudanças de banco em schema staging |
| Integration Tests | `Test Suite` | `runCompatibilityTests()` | Executa 500+ testes automáticos |
| Cross-Module Tests | `API Testing` | `testModuleCommunication()` | Valida comunicação entre módulos |
| Business Tests | `E2E Testing` | `simulateBusinessFlow()` | Simula operações reais (cliente → venda → estoque) |
| Approval Gate | `Automation` | `validateResults()` | ✅ Libera produção / ❌ Bloqueia deploy |

### Testes de Compatibilidade Automáticos
```typescript
// Exemplo de teste cross-module
describe('CRM → Sales Integration', () => {
  it('should create sale with customer from CRM v2.1', async () => {
    // 1. Criar cliente no CRM (nova versão)
    const customer = await crmApi.createCustomer(customerData);
    
    // 2. Criar venda no Sales (versão atual)
    const sale = await salesApi.createSale({
      customerId: customer.id,
      products: [{ id: 'prod-1', qty: 2 }]
    });
    
    // 3. Validar que venda foi criada corretamente
    expect(sale.customer.name).toBe(customer.name);
    expect(sale.status).toBe('completed');
  });
});
```

## 4. Sistema de Cotas e Rate Limiting

### Estratégia de Cotas por Empresa

#### Modelo de Negócio
- **Monetização:** Diferentes níveis de performance por preço
- **Isolamento:** Uma empresa não afeta performance de outra
- **Escalabilidade:** Sistema cresce conforme demanda

#### Estrutura de Planos
```typescript
interface QuotaPlan {
  name: string;
  requestsPerMonth: number;
  moduleDistribution: {
    CRM: number;      // Porcentagem da cota total
    SALES: number;
    FINANCIAL: number;
    INVENTORY: number;
  };
}

const quotaPlans = {
  BASIC: {
    name: "Básico",
    requestsPerMonth: 10000,
    moduleDistribution: {
      CRM: 40,        // 4.000 requests
      SALES: 30,      // 3.000 requests  
      FINANCIAL: 20,  // 2.000 requests
      INVENTORY: 10   // 1.000 requests
    }
  },
  PROFESSIONAL: {
    name: "Profissional", 
    requestsPerMonth: 50000,
    moduleDistribution: {
      CRM: 35, SALES: 35, FINANCIAL: 20, INVENTORY: 10
    }
  },
  ENTERPRISE: {
    name: "Enterprise",
    requestsPerMonth: 200000,
    moduleDistribution: {
      CRM: 30, SALES: 30, FINANCIAL: 25, INVENTORY: 15
    }
  }
};
```

### Implementação de Rate Limiting

| Camada | Arquivo | Função | Responsabilidade |
|:-------|:--------|:--------|:-----------------|
| Middleware | `shared/middleware/rateLimiting.ts` | `companyRateLimit()` | Intercepta requests, valida cota da empresa |
| Counter | `shared/services/quotaCounter.ts` | `incrementUsage()` | Conta requests por empresa/módulo no Redis |
| Validator | `shared/services/quotaValidator.ts` | `checkQuotaAvailable()` | Valida se empresa ainda tem cota disponível |
| Distributor | `shared/services/quotaDistributor.ts` | `allocateByModule()` | Distribui cota total pelos módulos da empresa |

### Monitoramento de Capacidade do Servidor
```typescript
// Sistema de coleta de métricas (implementar agora)
interface ServerMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  totalRequests: number;
  companiesActive: number;
}

interface CompanyMetrics {
  companyId: string;
  module: 'CRM' | 'SALES' | 'FINANCIAL' | 'INVENTORY';
  requestCount: number;
  responseTime: number;
  errorRate: number;
  quotaUsed: number;
  quotaLimit: number;
}
```

### Plataforma de Gestão de Cotas (Implementar quando servidor atingir 60% capacidade)

#### Dashboard de Capacidade
- **Gauge de Servidor:** % uso atual vs limite
- **Ranking Empresas:** Top consumidores de requests
- **Projeção:** Curva de crescimento baseada em histórico
- **Alertas:** Notificação quando capacidade > 60%

#### Gestão de Cotas por Cliente
```typescript
interface QuotaManagementUI {
  companyInfo: {
    id: string;
    name: string;
    currentPlan: string;
    modulesEnabled: string[];
  };
  quotaConfig: {
    monthlyLimit: number;
    moduleDistribution: Record<string, number>;
    overagePolicy: 'block' | 'throttle' | 'charge';
  };
  usage: {
    currentMonth: number;
    byModule: Record<string, number>;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}
```

#### Automações do Sistema
- **Cliente Novo:** Cota padrão baseada em módulos habilitados
- **Upgrade Automático:** Detecta padrão alto de uso → sugere plano superior
- **Alertas de Cota:** Email quando empresa usar 80% da cota mensal
- **Bloqueio Suave:** Throttling em 90%, bloqueio completo em 100%

## 5. Monitoramento Inteligente com IA

### Arquitetura IA Monitor (Sistema Separado)

| Componente | Responsabilidade | Tecnologia | Dados Coletados |
|:-----------|:----------------|:-----------|:----------------|
| **Collector** | Coleta métricas do Nexus via API | Node.js + Redis | Response times, error rates, business metrics |
| **Storage** | Armazena dados históricos para análise | InfluxDB/TimescaleDB | Time-series data por empresa/módulo |
| **IA Engine** | Detecta anomalias e padrões perigosos | Python + ML (scikit-learn) | Trends, outliers, cascata de erros |
| **Alert Manager** | Filtra alertas por criticidade | Node.js | Severity levels, rate limiting de alertas |
| **Telegram Bot** | Envia alertas inteligentes | Bot API | Mensagens formatadas com context |

### Métricas Enviadas pelo Nexus para IA

#### Métricas Técnicas
```typescript
interface TechnicalMetrics {
  companyId: string;
  module: string;
  endpoint: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  errorMessage?: string;
}
```

#### Métricas de Negócio
```typescript
interface BusinessMetrics {
  companyId: string;
  salesPerHour: number;
  activeUsers: number;
  transactionsCompleted: number;
  transactionsFailed: number;
  timestamp: Date;
}
```

### Padrões de Detecção da IA

#### Degradação Gradual (Trend Analysis)
```python
# IA detecta trends perigosos que humanos perdem
if response_time_trend > 0.1 and days_trending > 3:
    alert_severity = "HIGH" 
    message = f"Response time aumentando {trend_percentage}% há {days} dias"
```

#### Anomalia de Negócio (Outlier Detection)
```python
# Detecta quedas súbitas em métricas de negócio
if today_sales < (avg_sales * 0.3) and hour > 12:
    alert_severity = "CRITICAL"
    message = f"Vendas 70% abaixo do normal - possível bug sistêmico"
```

#### Cascata de Erros (Pattern Recognition)
```python
# Identifica efeito dominó entre módulos
if crm_errors > threshold and sales_errors > threshold and time_diff < 30min:
    alert_severity = "CRITICAL"
    message = f"Cascata de erros detectada - falha sistêmica provável"
```

### Alertas Inteligentes via Telegram

#### Formato de Alert Crítico
```
🚨 NEXUS - ALERTA CRÍTICO

Empresa: MultiLog Transportes
Problema: Módulo Vendas sem resposta há 45min
Impacto Estimado: R$ 12.000 em vendas perdidas
Horário: 14:35 - 23/08/2024

Ações Sugeridas:
1. Verificar logs do módulo Sales
2. Validar integração CRM → Sales  
3. Checar conectividade do banco de dados

Métricas:
- Response time: 0ms (timeout)
- Error rate: 100% 
- Última transação: 13:50

Dashboard: https://nexus-admin.com/company/multilog
```

#### Sistema de Severidade
- 🟢 **INFO:** Métricas normais, relatório diário
- 🟡 **WARNING:** Degradação detectada, monitorar
- 🟠 **HIGH:** Problema confirmado, requer atenção
- 🔴 **CRITICAL:** Sistema parado, ação imediata

### Configurações da IA (Definir posteriormente)
```typescript
// Placeholder para configurações futuras
interface AIMonitorConfig {
  anomalyThreshold: number;
  trendAnalysisDays: number;
  businessMetricsSensitivity: 'low' | 'medium' | 'high';
  alertFrequencyLimit: number; // Max alerts per hour
  telegramChannels: {
    critical: string;
    warning: string;
    reports: string;
  };
}
```

## 6. Endpoints e Contratos de API

### Padrões de API REST

#### Estrutura de URL
```
https://api.nexus.com/v1/{module}/{resource}
```

#### Autenticação e Tenant
```typescript
// Headers obrigatórios
{
  "Authorization": "Bearer jwt.token.here",
  "X-Company-ID": "uuid-da-empresa",
  "Content-Type": "application/json"
}
```

#### Respostas Padronizadas
```typescript
// Success Response
{
  "success": true,
  "data": {...},
  "meta": {
    "timestamp": "2024-08-23T14:30:00Z",
    "requestId": "uuid"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "INVALID_CUSTOMER",
    "message": "Customer not found",
    "details": {...}
  },
  "meta": {
    "timestamp": "2024-08-23T14:30:00Z", 
    "requestId": "uuid"
  }
}
```

## 7. Segurança em Integrações

### Validação de Requests Cross-Module

| Validação | Implementação | Arquivo | Responsabilidade |
|:----------|:-------------|:--------|:-----------------|
| JWT Token | `shared/middleware/auth.ts` | `validateJWT()` | Verifica assinatura e expiração |
| Company Isolation | `shared/middleware/tenantIsolation.ts` | `validateCompanyAccess()` | Impede acesso cross-tenant |
| Module Permission | `shared/middleware/moduleAccess.ts` | `requireModuleAccess()` | Valida módulo habilitado para empresa |
| Rate Limiting | `shared/middleware/rateLimiting.ts` | `companyRateLimit()` | Respeita cotas por empresa |
| Input Validation | `shared/middleware/validation.ts` | `validateSchema()` | Valida payload com Zod schemas |

### Logs de Auditoria para Integrações
```typescript
interface IntegrationAuditLog {
  requestId: string;
  sourceModule: string;
  targetModule: string;
  endpoint: string;
  companyId: string;
  userId?: string;
  requestPayload: any;
  responseStatus: number;
  responseTime: number;
  timestamp: Date;
}
```

## 8. Performance e Cache

### Estratégia de Cache por Tipo de Dado

| Tipo de Dado | Cache Strategy | TTL | Justificativa |
|:-------------|:-------------|:----|:-------------|
| **User Sessions** | Redis | 24h | Autenticação frequente |
| **Company Settings** | Redis | 1h | Raramente mudam |
| **Product Catalog** | Redis | 30min | Consultas constantes |
| **Customer Data** | No cache | - | Dados críticos sempre frescos |
| **Reports Data** | Redis | 15min | Operação pesada |

### Cache Invalidation
```typescript
// Invalidação automática por eventos
events.on('customer.updated', (customerId) => {
  cache.delete(`customer:${customerId}`);
  cache.deletePattern(`reports:*:${customerId}`);
});

events.on('product.updated', (productId) => {
  cache.delete(`product:${productId}`);
  cache.deletePattern(`inventory:*:${productId}`);
});
```

## 9. Implementação Roadmap

### Fase 1 - MVP (Imediato)
- [x] REST APIs entre módulos críticos
- [x] Autenticação JWT com company isolation
- [x] Message broker Redis para eventos simples
- [x] Rate limiting básico por IP
- [x] Logs de auditoria básicos

### Fase 2 - Cotas e Monitoramento (60% capacidade servidor)
- [ ] Sistema de cotas por empresa
- [ ] Métricas de usage por módulo
- [ ] Plataforma admin de gestão de cotas
- [ ] Alertas básicos por Telegram

### Fase 3 - IA e Automação (Scale)
- [ ] IA Monitor para análise de patterns
- [ ] Alertas inteligentes contextuais
- [ ] Automação de upgrades de plano
- [ ] Previsão de capacidade

### Fase 4 - Optimização (Maturidade)
- [ ] GraphQL para queries complexas (relatórios)
- [ ] Cache distribuído avançado
- [ ] Load balancing inteligente
- [ ] Self-healing automático