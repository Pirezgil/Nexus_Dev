# Estratégia de Banco de Dados - Nexus ERP

## Decisão Arquitetural: Banco Único com Schemas Separados

### Configuração Escolhida
- **PostgreSQL:** localhost:5433
- **Estratégia:** Single Database + Multiple Schemas
- **Padrão de Schema:** `nexus_[nome_modulo]`

## Estrutura de Schemas

### Schema por Módulo
```sql
-- Módulo de Autenticação
CREATE SCHEMA nexus_auth;

-- Módulo de Gestão de Usuários  
CREATE SCHEMA nexus_user_management;

-- Módulo de CRM
CREATE SCHEMA nexus_crm;

-- Módulo de Vendas
CREATE SCHEMA nexus_sales;

-- Módulo de Estoque
CREATE SCHEMA nexus_inventory;

-- Módulo Financeiro
CREATE SCHEMA nexus_financial;

-- Schema compartilhado (logs, auditorias, etc.)
CREATE SCHEMA nexus_shared;
```

## Justificativa da Decisão

### Vantagens da Abordagem Escolhida
1. **Integridade Referencial Cross-Module**
   - Foreign keys entre módulos (ex: sales.customer_id → crm.customers.id)
   - Constraints de integridade mantidas pelo PostgreSQL
   
2. **Transações Distribuídas**
   - ACID compliance em operações cross-module
   - Ex: Venda → Redução Estoque → Lançamento Financeiro (transação única)
   
3. **Relatórios Consolidados**
   - JOINs diretos entre schemas
   - Views materializadas cross-module
   - Performance superior em consultas complexas
   
4. **Gestão Operacional Simplificada**
   - Backup único e consistente
   - Monitoring centralizado
   - Migration scripts centralizados
   
5. **Economia de Recursos**
   - Single connection pool
   - Compartilhamento de índices e cache
   - Menor overhead de containers

### Considerações de Design

#### Isolamento por Schema
- Cada módulo acessa apenas seu schema principal
- Acesso cross-schema apenas via APIs ou views específicas
- Permissões PostgreSQL por schema para segurança

#### Comunicação Entre Módulos
- **Preferencial:** APIs REST entre módulos
- **Eventual:** Queries cross-schema quando performance crítica
- **Message Broker:** Redis para eventos assíncronos

## Configuração Prisma por Módulo

### Estrutura de Arquivos
```
modules/
├── auth/
│   ├── prisma/
│   │   ├── schema.prisma      # Schema: nexus_auth
│   │   └── migrations/
├── crm/
│   ├── prisma/
│   │   ├── schema.prisma      # Schema: nexus_crm  
│   │   └── migrations/
└── [outros-modulos]/
```

### Exemplo de Configuração Schema
```prisma
// modules/auth/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["nexus_auth", "nexus_shared"]
}

model User {
  id    String @id @default(cuid())
  email String @unique
  
  @@map("users")
  @@schema("nexus_auth")
}
```

## Padrões de Desenvolvimento

### Naming Conventions
- **Schemas:** `nexus_[modulo]` (snake_case)
- **Tabelas:** `[entidade]s` (plural, snake_case) 
- **Campos:** `snake_case`
- **Indexes:** `idx_[tabela]_[campo]`
- **FK Constraints:** `fk_[tabela_origem]_[tabela_destino]`

### Estrutura Padrão por Schema
```sql
-- Exemplo: nexus_crm schema
Tables:
├── customers          # Entidade principal
├── contacts          # Relacionada
├── activities        # Logs/histórico
├── custom_fields     # Campos customizáveis
└── audit_log         # Auditoria do módulo
```

## Migrations e Deploy

### Estratégia de Migration
1. **Desenvolvimento:** Cada módulo executa suas migrations independentemente
2. **CI/CD:** Script centralizado executa migrations de todos os módulos
3. **Rollback:** Suporte a rollback por módulo ou completo

### Comando de Migration
```bash
# Migration por módulo
docker-compose exec auth npx prisma migrate deploy
docker-compose exec crm npx prisma migrate deploy

# Migration global (script)
./scripts/migrate-all-modules.sh
```

## Segurança e Permissões

### Usuários PostgreSQL por Módulo
```sql
-- Usuário específico por módulo
CREATE USER nexus_auth_user WITH PASSWORD 'secure_password';
GRANT USAGE ON SCHEMA nexus_auth TO nexus_auth_user;
GRANT ALL ON ALL TABLES IN SCHEMA nexus_auth TO nexus_auth_user;

-- Usuário read-only para relatórios
CREATE USER nexus_reports_user WITH PASSWORD 'secure_password';
GRANT USAGE ON ALL SCHEMAS TO nexus_reports_user;
GRANT SELECT ON ALL TABLES IN SCHEMA nexus_* TO nexus_reports_user;
```

### Connection Strings por Módulo
```env
# modules/auth/.env
DATABASE_URL="postgresql://nexus_auth_user:password@localhost:5433/nexus_erp?schema=nexus_auth"

# modules/crm/.env  
DATABASE_URL="postgresql://nexus_crm_user:password@localhost:5433/nexus_erp?schema=nexus_crm"
```

## Monitoramento e Performance

### Métricas por Schema
- Query performance por módulo
- Table size growth por schema
- Connection usage por módulo
- Lock contention cross-schema

### Backup Strategy
```bash
# Backup completo (todos os schemas)
pg_dump -h localhost -p 5433 -U postgres nexus_erp > backup_complete.sql

# Backup por schema
pg_dump -h localhost -p 5433 -U postgres -n nexus_crm nexus_erp > backup_crm.sql
```

## Próximos Passos
1. Setup inicial do PostgreSQL com schemas
2. Configuração Docker Compose com database
3. Templates Prisma por módulo
4. Scripts de migration automatizados
5. Setup de permissões e usuários específicos