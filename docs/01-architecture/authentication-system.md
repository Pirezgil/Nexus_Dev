# Deep Dive: Autenticação & Autorização - Nexus ERP

Sistema de autenticação multi-tenant com isolamento total por empresa, hierarquia customizável de roles e auditoria completa de todas as ações.

## 1. Arquitetura Multi-Tenant com Schema Isolado

### Decisões Arquiteturais
- **Isolamento:** Schema separado por empresa (`nexus_company_[company_id]`)
- **Usuários:** 1 usuário = 1 empresa (zero chance de cross-company access)
- **Segurança:** Empresas concorrentes totalmente isoladas
- **Roles:** Hierarquia customizável por empresa via drag-and-drop

## 2. Fluxo de Login e Autenticação

| Etapa | Arquivo | Função | Responsabilidade |
|:------|:--------|:--------|:-----------------|
| Rota Login | `modules/auth/routes/auth.ts` | `POST /auth/login` | Recebe credenciais, aplica rate limiting, valida schema |
| Controller | `modules/auth/controllers/authController.ts` | `login()` | Extrai dados, identifica empresa, chama serviço de auth |
| Tenant Resolver | `modules/auth/services/tenantResolver.ts` | `resolveCompanyByEmail()` | Identifica schema da empresa pelo email do usuário |
| Schema Switcher | `shared/middleware/schemaContext.ts` | `setCompanySchema()` | Configura conexão Prisma para schema específico |
| Auth Service | `modules/auth/services/authService.ts` | `authenticateUser()` | Valida credenciais no schema correto, gera JWT |
| JWT Generator | `shared/utils/jwtUtils.ts` | `generateToken()` | Cria token com userId + companyId + permissions |
| Response | `modules/auth/controllers/authController.ts` | `sendAuthResponse()` | Retorna token, dados user, módulos habilitados |

## 3. Estrutura de Banco Multi-Tenant

### Schema Global (nexus_global)
```sql
-- Gestão de empresas (apenas desenvolvedores Nexus)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  schema_name VARCHAR(50) NOT NULL UNIQUE,
  enabled_modules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Controle de módulos por empresa (apenas desenvolvedores)
CREATE TABLE company_module_access (
  company_id UUID REFERENCES companies(id),
  module_name VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMP,
  PRIMARY KEY (company_id, module_name)
);
```

### Schema por Empresa (nexus_company_[id])
```sql
-- Usuários da empresa
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES custom_roles(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Hierarquia de roles customizada
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_role_id UUID REFERENCES custom_roles(id),
  level INTEGER NOT NULL, -- Para drag-and-drop ordering
  can_manage_below BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permissões por role
CREATE TABLE role_permissions (
  role_id UUID REFERENCES custom_roles(id),
  module_name VARCHAR(50) NOT NULL,
  feature_name VARCHAR(50) NOT NULL,
  can_access BOOLEAN DEFAULT false,
  PRIMARY KEY (role_id, module_name, feature_name)
);

-- Auditoria completa
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, VIEW
  resource_type VARCHAR(50) NOT NULL, -- customer, product, sale
  resource_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  module_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 4. Sistema de Roles Customizáveis

### Criação de Hierarquia Drag-and-Drop

| Etapa | Arquivo | Função | Responsabilidade |
|:------|:--------|:--------|:-----------------|
| Frontend | `frontend/components/admin/RoleHierarchy.tsx` | `DragDropRoleTree` | Interface drag-and-drop para reordenar roles |
| API Route | `modules/auth/routes/roles.ts` | `PUT /roles/hierarchy` | Recebe nova estrutura hierárquica |
| Controller | `modules/auth/controllers/roleController.ts` | `updateHierarchy()` | Valida permissões, processa mudanças |
| Service | `modules/auth/services/roleService.ts` | `rebuildHierarchy()` | Recalcula níveis, valida integridade |
| Validation | `modules/auth/services/hierarchyValidator.ts` | `validateHierarchy()` | Evita loops, valida dependências |
| Update DB | `modules/auth/services/roleService.ts` | `updateRoleLevels()` | Salva nova estrutura no banco |

### Estrutura Hierárquica Padrão
```typescript
interface RoleHierarchy {
  id: string;
  name: string;
  level: number;
  parentId: string | null;
  canManageBelow: boolean;
  children: RoleHierarchy[];
}

// Exemplo de hierarquia padrão
const defaultHierarchy: RoleHierarchy = {
  id: "owner",
  name: "Owner/Proprietário", 
  level: 0,
  parentId: null,
  canManageBelow: true,
  children: [
    {
      id: "manager", 
      name: "Gerente",
      level: 1,
      parentId: "owner",
      canManageBelow: true,
      children: [
        {
          id: "employee",
          name: "Funcionário",
          level: 2, 
          parentId: "manager",
          canManageBelow: false,
          children: []
        }
      ]
    }
  ]
};
```

## 5. Middleware de Tenant Isolation

| Middleware | Arquivo | Função | Responsabilidade |
|:-----------|:--------|:--------|:-----------------|
| Schema Context | `shared/middleware/schemaContext.ts` | `injectSchemaContext()` | Extrai companyId do JWT, configura Prisma schema |
| Permission Check | `shared/middleware/permissions.ts` | `requirePermission()` | Valida acesso a feature específica |
| Module Access | `shared/middleware/moduleAccess.ts` | `requireModuleAccess()` | Verifica se empresa tem módulo habilitado |
| Audit Logger | `shared/middleware/auditLogger.ts` | `logAction()` | Registra todas as ações no audit_trail |

### Implementação Schema Context
```typescript
// shared/middleware/schemaContext.ts
export const injectSchemaContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractTokenFromHeader(req);
    const payload = verifyJWT(token);
    
    // Define schema da empresa no contexto
    const schemaName = `nexus_company_${payload.companyId}`;
    req.companySchema = schemaName;
    req.user = payload;
    
    // Configura Prisma para usar schema correto
    req.prisma = new PrismaClient({
      datasources: {
        db: {
          url: `${DATABASE_URL}?schema=${schemaName}`
        }
      }
    });
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication' });
  }
};
```

## 6. Sistema de Permissões por Feature

### Validação de Permissões

| Etapa | Arquivo | Função | Responsabilidade |
|:------|:--------|:--------|:-----------------|
| Permission Check | `shared/middleware/permissions.ts` | `requirePermission(module, feature)` | Verifica se user tem acesso à feature |
| Role Resolver | `modules/auth/services/roleResolver.ts` | `getUserPermissions()` | Busca permissões do usuário + herança hierárquica |
| Cache Layer | `shared/services/permissionCache.ts` | `getCachedPermissions()` | Cache Redis de permissões por usuário |
| DB Query | `modules/auth/services/permissionService.ts` | `getEffectivePermissions()` | Calcula permissões efetivas com herança |

### Mapeamento de Features por Módulo
```typescript
// shared/types/permissions.ts
export const ModuleFeatures = {
  AUTH: ['manage_users', 'manage_roles', 'view_audit'],
  CRM: ['create_customer', 'edit_customer', 'delete_customer', 'view_customers'],
  SALES: ['create_sale', 'edit_sale', 'delete_sale', 'view_sales', 'generate_reports'],
  INVENTORY: ['add_product', 'edit_product', 'delete_product', 'view_inventory'],
  FINANCIAL: ['view_finances', 'create_transaction', 'generate_reports']
};

// Exemplo de uso
app.get('/api/crm/customers', 
  injectSchemaContext,
  requirePermission('CRM', 'view_customers'),
  customersController.list
);
```

## 7. Auditoria Completa de Ações

### Log Automático de Todas as Ações

| Trigger | Arquivo | Função | Responsabilidade |
|:--------|:--------|:--------|:-----------------|
| API Middleware | `shared/middleware/auditLogger.ts` | `logApiAction()` | Intercepta todas requests, gera logs |
| Database Triggers | `shared/database/auditTriggers.sql` | `audit_trigger()` | Triggers SQL para changes em tabelas críticas |
| Service Layer | `shared/services/auditService.ts` | `createAuditEntry()` | Cria entradas estruturadas de auditoria |
| Cleanup Job | `shared/jobs/auditCleanup.ts` | `cleanOldAudits()` | Remove logs antigos (compliance) |

### Estrutura de Log de Auditoria
```typescript
interface AuditEntry {
  id: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT';
  resourceType: string; // 'customer', 'product', 'sale'
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  moduleName: string;
  timestamp: Date;
}

// Exemplo de uso automático
export const auditLogger = (action: string, resourceType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(body) {
      // Log após response bem-sucedida
      auditService.createAuditEntry({
        userId: req.user.id,
        action,
        resourceType,
        resourceId: req.params.id,
        newValues: req.body,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        moduleName: req.originalUrl.split('/')[2]
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};
```

## 8. Gestão de Módulos por Empresa

### Controle de Acesso a Módulos (Apenas Desenvolvedores Nexus)

| Operação | Arquivo | Função | Responsabilidade |
|:---------|:--------|:--------|:-----------------|
| Admin Panel | `admin/components/CompanyModules.tsx` | `ModuleAccessManager` | Interface para habilitar/desabilitar módulos |
| API Admin | `admin/routes/companies.ts` | `PUT /admin/companies/:id/modules` | Endpoint para alterar acesso a módulos |
| Validation | `admin/controllers/companyController.ts` | `updateModuleAccess()` | Valida permissões de admin, atualiza acesso |
| Sync Service | `shared/services/moduleSyncService.ts` | `syncModuleAccess()` | Sincroniza mudanças com cache Redis |

### Validação de Acesso a Módulo
```typescript
// shared/middleware/moduleAccess.ts
export const requireModuleAccess = (moduleName: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user.companyId;
      
      const hasAccess = await checkModuleAccess(companyId, moduleName);
      
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Module not enabled for this company',
          module: moduleName
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Module access validation failed' });
    }
  };
};
```

## 9. Segurança e Rate Limiting

### Proteções Implementadas

| Proteção | Arquivo | Implementação | Configuração |
|:----------|:--------|:-------------|:------------|
| Rate Limiting | `shared/middleware/rateLimiting.ts` | `authRateLimit` | 5 tentativas/15min por IP |
| Password Policy | `modules/auth/services/passwordService.ts` | `validatePassword()` | Min 8 chars, maiúsc, núm, especial |
| JWT Expiration | `shared/utils/jwtUtils.ts` | Token expiry | 24h access + 7d refresh |
| Schema Isolation | `shared/middleware/schemaContext.ts` | Dynamic schema | Zero cross-tenant queries |
| Audit Encryption | `shared/services/auditService.ts` | Sensitive data encrypt | PII fields encrypted |

## 10. Scripts de Deploy e Migrations

### Gerenciamento Multi-Schema

| Script | Arquivo | Função | Uso |
|:-------|:--------|:--------|:----|
| Create Company | `scripts/createCompany.js` | `createNewCompanySchema()` | Novo cliente Nexus |
| Migrate All | `scripts/migrateAllCompanies.js` | `runMigrationsAllSchemas()` | Deploy de updates |
| Backup Schema | `scripts/backupCompany.js` | `backupCompanySchema()` | Backup específico |
| Health Check | `scripts/healthCheckSchemas.js` | `validateAllSchemas()` | Monitoramento |

```bash
# Exemplo de uso dos scripts
npm run schema:create -- --company="Empresa ABC" --owner-email="admin@empresa.com"
npm run schema:migrate-all
npm run schema:backup -- --company-id="uuid-da-empresa"
npm run schema:health-check
```

## 11. Testes de Segurança

### Validação de Isolamento Multi-Tenant

| Teste | Arquivo | Cenário | Validação |
|:------|:--------|:---------|:----------|
| Schema Isolation | `tests/security/schemaIsolation.test.ts` | User A tenta acessar dados da Empresa B | 403 Forbidden |
| Permission Bypass | `tests/security/permissionBypass.test.ts` | Employee tenta acessar features de Manager | 403 Forbidden |
| Token Tampering | `tests/security/tokenTampering.test.ts` | JWT modificado com companyId diferente | 401 Unauthorized |
| Audit Integrity | `tests/security/auditIntegrity.test.ts` | Todas ações são logadas corretamente | Logs presentes |

## 12. Monitoramento e Alertas

### Métricas de Segurança

| Métrica | Coleta | Alerta | Ação |
|:--------|:-------|:-------|:-----|
| Failed Logins | `auditLogger.ts` | >10 failures/min | Block IP temporarily |
| Cross-tenant Attempts | `schemaContext.ts` | Any occurrence | Immediate alert |
| Permission Escalation | `permissions.ts` | Unauthorized access attempts | Security log |
| Unusual Activity | `auditService.ts` | Off-hours bulk operations | Notify admins |