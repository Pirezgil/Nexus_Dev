# 🗄️ PLANO DE MIGRAÇÃO - DATABASE UNIFICADO ERP NEXUS

## 🎯 **OBJETIVO**
Migrar da arquitetura atual (módulos isolados sem foreign keys) para **database unificado com foreign keys cross-module**, mantendo **zero downtime** e **zero data loss**.

---

## ⚠️ **SITUAÇÃO ATUAL CRÍTICA**

### **PROBLEMAS IDENTIFICADOS:**
- ❌ **Módulos completamente isolados** - cada um com sua própria "ilha" de dados
- ❌ **Foreign keys como strings soltas** - `customer_id`, `professional_id`, `service_id` são UUIDs sem validação
- ❌ **Zero integridade referencial** - possível criar appointments com customer_id inexistente  
- ❌ **JOINs cross-module impossíveis** - sem relacionamento real entre tabelas
- ❌ **Inconsistência de dados garantida** - sem constraints do PostgreSQL

### **ARQUITETURA ATUAL:**
```yaml
# Cada módulo "pensa" que tem seu próprio banco
nexus-user-management:
  DATABASE_URL: postgresql://nexus_user:nexus_password@postgres:5432/nexus_erp
nexus-crm:  
  DATABASE_URL: postgresql://nexus_user:nexus_password@postgres:5432/nexus_erp
nexus-services:
  DATABASE_URL: postgresql://nexus_user:nexus_password@postgres:5432/nexus_erp  
nexus-agendamento:
  DATABASE_URL: postgresql://nexus_user:nexus_password@postgres:5432/nexus_erp
```

**RESULTADO:** Tabelas soltas no mesmo database, sem foreign keys, sem schemas específicos.

---

## 🎯 **ARQUITETURA DESEJADA**

### **NOVA ESTRUTURA:**
```sql
-- Database único: nexus_erp
-- Schemas organizados:
CREATE SCHEMA nexus_auth;           -- Users, companies, sessions
CREATE SCHEMA nexus_crm;            -- Customers, notes, interactions  
CREATE SCHEMA nexus_services;       -- Services, professionals, appointments_completed
CREATE SCHEMA nexus_agendamento;    -- Appointments, schedule_blocks, notifications
CREATE SCHEMA nexus_shared;         -- Audit_logs, system_logs, integration_logs
```

### **FOREIGN KEYS CRÍTICAS:**
```sql
-- INTEGRIDADE REAL garantida pelo PostgreSQL:
nexus_agendamento.appointments.customer_id → nexus_crm.customers.id
nexus_agendamento.appointments.professional_id → nexus_services.professionals.id
nexus_agendamento.appointments.service_id → nexus_services.services.id
nexus_services.appointments_completed.customer_id → nexus_crm.customers.id
```

---

## 📋 **FASES DA MIGRAÇÃO**

### **🔍 FASE 1: ANÁLISE E BACKUP (2 horas)**

#### **1.1 Backup Completo**
```bash
# Backup antes de qualquer alteração
pg_dump -h localhost -p 5433 -U nexus_user nexus_erp > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Verificar integridade do backup
pg_restore --list backup_pre_migration_*.sql
```

#### **1.2 Análise dos Dados Existentes**
```sql
-- Verificar dados órfãos ANTES da migração
-- Appointments com customer_id que não existe em customers:
SELECT COUNT(*) as orphan_appointments 
FROM appointments a 
LEFT JOIN customers c ON a.customer_id::uuid = c.id::uuid 
WHERE c.id IS NULL;

-- Services appointments com customer_id órfão:
SELECT COUNT(*) as orphan_service_appointments
FROM appointments_completed ac
LEFT JOIN customers c ON ac.customer_id::uuid = c.id::uuid
WHERE c.id IS NULL;
```

#### **1.3 Limpeza de Dados Órfãos**
```sql
-- CRÍTICO: Limpar dados órfãos ANTES de criar foreign keys
-- Caso contrário, as foreign keys falharão

-- 1. Deletar appointments órfãos (sem customer válido)
DELETE FROM appointments 
WHERE customer_id::uuid NOT IN (SELECT id FROM customers);

-- 2. Deletar appointments_completed órfãos  
DELETE FROM appointments_completed
WHERE customer_id::uuid NOT IN (SELECT id FROM customers);

-- 3. Verificar professionals órfãos
SELECT COUNT(*) FROM professionals p
LEFT JOIN users u ON p."userId"::uuid = u.id::uuid
WHERE u.id IS NULL;
```

### **🏗️ FASE 2: CRIAÇÃO DA NOVA ESTRUTURA (3 horas)**

#### **2.1 Criação dos Schemas**
```sql
-- Executar: database/unified-schema.sql
-- Cria todos os 5 schemas com estrutura completa
-- IMPORTANTE: Executa DROP CASCADE - dados atuais serão perdidos
```

#### **2.2 Migração dos Dados Existentes**
```bash
# Script personalizado para migração de dados
./database/scripts/migrate-data.sh
```

**Conteúdo do migrate-data.sh:**
```bash
#!/bin/bash

echo "🔄 Iniciando migração de dados..."

# 1. Migrar companies (nexus_auth)
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "
INSERT INTO nexus_auth.companies 
SELECT * FROM public.companies;
"

# 2. Migrar users (nexus_auth)  
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "
INSERT INTO nexus_auth.users
SELECT * FROM public.users;
"

# 3. Migrar customers (nexus_crm)
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "
INSERT INTO nexus_crm.customers
SELECT * FROM public.customers;
"

# 4. Migrar services data (nexus_services)
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "
INSERT INTO nexus_services.services
SELECT * FROM public.services;

INSERT INTO nexus_services.professionals  
SELECT * FROM public.professionals;

INSERT INTO nexus_services.appointments_completed
SELECT * FROM public.appointments_completed;
"

# 5. Migrar appointments (nexus_agendamento) - COM foreign keys válidas
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "
INSERT INTO nexus_agendamento.appointments
SELECT * FROM public.appointments
WHERE customer_id::uuid IN (SELECT id FROM nexus_crm.customers)
  AND professional_id::uuid IN (SELECT id FROM nexus_services.professionals)  
  AND service_id::uuid IN (SELECT id FROM nexus_services.services);
"

echo "✅ Migração de dados concluída!"
```

#### **2.3 Aplicação das Foreign Keys**
```sql
-- Executar: database/foreign-keys.sql
-- Cria todas as foreign keys cross-module
-- CRÍTICO: Só funcionará se os dados estão consistentes
```

### **🔧 FASE 3: ATUALIZAÇÃO DO CÓDIGO (4 horas)**

#### **3.1 Schemas Prisma Atualizados** ✅ **CONCLUÍDO**
```prisma
// Exemplo: modules/agendamento/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  
  schemas  = ["nexus_agendamento", "nexus_auth", "nexus_crm", "nexus_services"]
}

model Appointment {
  // Schema específico
  @@map("appointments")
  @@schema("nexus_agendamento")
}
```

#### **3.2 Regeneração dos Prisma Clients**
```bash
# Regenerar clients de todos os módulos
cd modules/user-management && npx prisma generate
cd ../crm && npx prisma generate  
cd ../services && npx prisma generate
cd ../agendamento && npx prisma generate
```

#### **3.3 Atualização das Migrations Prisma**
```bash
# Cada módulo precisa de nova migration
cd modules/user-management && npx prisma migrate dev --name "add_schemas"
cd ../crm && npx prisma migrate dev --name "add_schemas"
cd ../services && npx prisma migrate dev --name "add_schemas"  
cd ../agendamento && npx prisma migrate dev --name "add_schemas"
```

### **🧪 FASE 4: TESTES E VALIDAÇÃO (3 horas)**

#### **4.1 Testes de Integridade Referencial**
```sql
-- Teste 1: Tentar criar appointment com customer_id inválido (DEVE FALHAR)
INSERT INTO nexus_agendamento.appointments (
  company_id, customer_id, professional_id, service_id, appointment_date, appointment_time, appointment_end_time
) VALUES (
  'valid-company-id', 'invalid-customer-id', 'valid-professional-id', 'valid-service-id', 
  '2025-12-01', '10:00:00', '11:00:00'
);
-- Resultado esperado: ERROR - foreign key constraint violation

-- Teste 2: Query cross-module (DEVE FUNCIONAR)  
SELECT 
  c.name as customer_name,
  s.name as service_name,
  p.name as professional_name,
  a.appointment_date
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
JOIN nexus_services.services s ON a.service_id = s.id  
JOIN nexus_services.professionals p ON a.professional_id = p.id
WHERE a.company_id = 'test-company-uuid'
LIMIT 5;
```

#### **4.2 Testes de Performance**
```sql
-- Verificar se queries cross-module estão rápidas (< 200ms)
EXPLAIN ANALYZE
SELECT c.name, s.name, COUNT(*) as total_appointments
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
JOIN nexus_services.services s ON a.service_id = s.id
WHERE a.company_id = 'company-uuid'
  AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.name, s.name;
```

#### **4.3 Testes Multi-Tenancy**
```sql
-- Garantir isolamento por empresa ainda funciona
SELECT COUNT(*) FROM nexus_agendamento.appointments WHERE company_id = 'company-a';
SELECT COUNT(*) FROM nexus_agendamento.appointments WHERE company_id = 'company-b';
-- Resultados devem ser diferentes (dados isolados por empresa)
```

### **🚀 FASE 5: DEPLOY E MONITORAMENTO (2 horas)**

#### **5.1 Deploy da Nova Configuração**
```bash
# 1. Parar containers
docker-compose down

# 2. Rebuild com nova configuração  
docker-compose build --no-cache

# 3. Subir containers
docker-compose up -d

# 4. Verificar health dos serviços
docker-compose ps
```

#### **5.2 Monitoramento Pós-Deploy**
```bash
# Logs de todos os módulos
docker-compose logs -f nexus-user-management
docker-compose logs -f nexus-crm  
docker-compose logs -f nexus-services
docker-compose logs -f nexus-agendamento

# Verificar conexões com banco
docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
WHERE schemaname IN ('nexus_auth', 'nexus_crm', 'nexus_services', 'nexus_agendamento');"
```

---

## ⚠️ **PONTOS CRÍTICOS DE ATENÇÃO**

### **1. BACKUP É OBRIGATÓRIO**
```bash
# SEMPRE fazer backup antes de QUALQUER alteração
pg_dump -h localhost -p 5433 -U nexus_user nexus_erp > backup_$(date +%Y%m%d_%H%M%S).sql
```

### **2. DADOS ÓRFÃOS DEVEM SER LIMPOS ANTES**
- Appointments com customer_id que não existe em customers
- Professionals com userId que não existe em users  
- Appointments_completed com customer_id inválido

### **3. FOREIGN KEYS PODEM FALHAR**
Se houver dados inconsistentes, as foreign keys não serão criadas. **Limpar dados órfãos é obrigatório**.

### **4. MULTI-TENANCY NÃO PODE SER QUEBRADO**
Toda query deve continuar filtrando por `company_id`:
```sql
-- ✅ CORRETO
SELECT * FROM nexus_crm.customers WHERE company_id = $1;

-- ❌ ERRADO - Mistura dados de empresas diferentes
SELECT * FROM nexus_crm.customers;  
```

### **5. ROLLBACK PLAN**
```bash
# Se algo der errado, restaurar backup:
dropdb -h localhost -p 5433 -U nexus_user nexus_erp
createdb -h localhost -p 5433 -U nexus_user nexus_erp  
pg_restore -h localhost -p 5433 -U nexus_user -d nexus_erp backup_pre_migration_*.sql
```

---

## ✅ **CRITÉRIOS DE SUCESSO**

### **TÉCNICOS:**
- [ ] ✅ Todos os 5 schemas criados (nexus_auth, nexus_crm, nexus_services, nexus_agendamento, nexus_shared)
- [ ] ✅ Minimum 12 foreign keys cross-module funcionando
- [ ] ✅ Query JOIN entre módulos executa sem erro (< 200ms)
- [ ] ✅ Tentativa de criar appointment com customer_id inválido **FALHA** (FK constraint)
- [ ] ✅ Multi-tenancy preservado (queries filtram por company_id)
- [ ] ✅ Zero data loss na migração

### **FUNCIONAIS:**  
- [ ] ✅ Frontend consegue criar appointment e listar customers
- [ ] ✅ APIs de integração entre módulos funcionam
- [ ] ✅ Relatórios cross-module exibem dados corretos
- [ ] ✅ Auditoria centralizada no nexus_shared captura alterações

### **OPERACIONAIS:**
- [ ] ✅ All containers healthy após deploy
- [ ] ✅ Performance mantida (queries < 2s)  
- [ ] ✅ Logs não mostram erros de foreign key violation em operações válidas
- [ ] ✅ Backup/restore funcionando

---

## 🕐 **CRONOGRAMA ESTIMADO**

| Fase | Duração | Responsável | Deliverables |
|:-----|:--------|:------------|:-------------|
| **Fase 1** - Análise | 2h | DBA | Backup + análise dados órfãos |
| **Fase 2** - Nova estrutura | 3h | DBA | Schemas + foreign keys |  
| **Fase 3** - Código | 4h | Dev | Prisma schemas atualizados |
| **Fase 4** - Testes | 3h | QA | Validação integridade + performance |
| **Fase 5** - Deploy | 2h | DevOps | Ambiente funcionando |

**TOTAL:** 14 horas (2 dias úteis)

---

## 📞 **ESCALAÇÃO EM CASO DE PROBLEMAS**

### **PROBLEMA:** Foreign keys falham ao serem criadas
**CAUSA:** Dados órfãos nos relacionamentos
**SOLUÇÃO:** Executar queries de limpeza na Fase 1

### **PROBLEMA:** Performance degradada pós-migração  
**CAUSA:** Índices ausentes em JOINs cross-schema
**SOLUÇÃO:** Criar índices compostos: `CREATE INDEX idx_appointments_customer_company ON nexus_agendamento.appointments(customer_id, company_id);`

### **PROBLEMA:** Multi-tenancy quebrado
**CAUSA:** Queries não filtram por company_id
**SOLUÇÃO:** Revisar todas as queries no código para incluir `WHERE company_id = $1`

---

**🎯 Esta migração é CRÍTICA para o funcionamento correto do sistema integrado!**