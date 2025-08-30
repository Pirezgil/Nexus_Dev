-- ============================================================================
-- TESTES DE VALIDAÇÃO - FOREIGN KEYS CROSS-MODULE
-- ============================================================================
-- Este script valida se as foreign keys estão funcionando corretamente
-- Deve ser executado APÓS a migração para verificar integridade
-- ============================================================================

-- ============================================================================
-- TESTE 1: VERIFICAR SE TODAS AS FOREIGN KEYS FORAM CRIADAS
-- ============================================================================

SELECT 
    'FOREIGN KEYS CRIADAS' as test_name,
    tc.table_schema, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
WHERE 
    tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema IN ('nexus_auth', 'nexus_crm', 'nexus_services', 'nexus_agendamento', 'nexus_shared')
ORDER BY 
    tc.table_schema, tc.table_name, kcu.column_name;

-- Resultado esperado: Minimum 25 foreign keys (12 cross-module + 13 multi-tenancy)

-- ============================================================================
-- TESTE 2: VALIDAÇÃO DE INTEGRIDADE REFERENCIAL
-- ============================================================================

-- 2.1: Testar criação de appointment com customer_id VÁLIDO (deve FUNCIONAR)
BEGIN;

INSERT INTO nexus_agendamento.appointments (
    id, company_id, customer_id, professional_id, service_id,
    appointment_date, appointment_time, appointment_end_time,
    status, created_at, updated_at
)
SELECT 
    uuid_generate_v4(),
    c.company_id,
    c.id,
    p.id,
    s.id,
    CURRENT_DATE + 1,
    '10:00:00',
    '11:00:00',
    'scheduled',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM nexus_crm.customers c
JOIN nexus_services.professionals p ON c.company_id = p.company_id
JOIN nexus_services.services s ON c.company_id = s.company_id
LIMIT 1;

-- Se chegou até aqui, o teste PASSOU
SELECT 'TESTE 2.1 - Appointment com FKs válidas' as test_name, 'PASSOU' as status;

ROLLBACK; -- Desfaz o insert de teste

-- 2.2: Testar criação de appointment com customer_id INVÁLIDO (deve FALHAR)
BEGIN;

DO $$
BEGIN
    BEGIN
        INSERT INTO nexus_agendamento.appointments (
            id, company_id, customer_id, professional_id, service_id,
            appointment_date, appointment_time, appointment_end_time,
            status, created_at, updated_at
        )
        SELECT 
            uuid_generate_v4(),
            company_id,
            uuid_generate_v4(), -- ❌ customer_id INVÁLIDO
            id as professional_id,
            uuid_generate_v4(), -- ❌ service_id INVÁLIDO  
            CURRENT_DATE + 1,
            '10:00:00',
            '11:00:00',
            'scheduled',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM nexus_services.professionals
        LIMIT 1;
        
        -- Se chegou até aqui, o teste FALHOU
        RAISE NOTICE 'TESTE 2.2 - FALHOU: Foreign key permitiu dados inválidos';
        
    EXCEPTION WHEN foreign_key_violation THEN
        -- Se caiu aqui, o teste PASSOU
        RAISE NOTICE 'TESTE 2.2 - PASSOU: Foreign key bloqueou dados inválidos';
    END;
END $$;

ROLLBACK;

-- ============================================================================
-- TESTE 3: QUERIES CROSS-MODULE (devem funcionar sem erro)
-- ============================================================================

-- 3.1: JOIN simples entre appointments e customers
SELECT 
    'TESTE 3.1 - JOIN appointments-customers' as test_name,
    COUNT(*) as total_records
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
WHERE a.company_id = c.company_id; -- Multi-tenancy preservado

-- 3.2: JOIN complexo com todos os módulos
SELECT 
    'TESTE 3.2 - JOIN complexo multi-módulo' as test_name,
    COUNT(*) as total_records,
    AVG(CASE WHEN c.id IS NOT NULL AND s.id IS NOT NULL AND p.id IS NOT NULL THEN 1 ELSE 0 END) as integrity_ratio
FROM nexus_agendamento.appointments a
LEFT JOIN nexus_crm.customers c ON a.customer_id = c.id
LEFT JOIN nexus_services.services s ON a.service_id = s.id
LEFT JOIN nexus_services.professionals p ON a.professional_id = p.id
WHERE a.company_id = c.company_id
  AND a.company_id = s.company_id
  AND a.company_id = p.company_id;

-- integrity_ratio deve ser 1.0 (100% dos relacionamentos válidos)

-- 3.3: Teste da view appointments_full
SELECT 
    'TESTE 3.3 - View appointments_full' as test_name,
    COUNT(*) as total_records
FROM nexus_shared.appointments_full
LIMIT 5;

-- ============================================================================
-- TESTE 4: MULTI-TENANCY (isolamento por empresa)
-- ============================================================================

-- 4.1: Verificar se dados estão isolados por company_id
SELECT 
    'TESTE 4.1 - Multi-tenancy isolamento' as test_name,
    company_id,
    COUNT(*) as total_appointments
FROM nexus_agendamento.appointments
GROUP BY company_id
ORDER BY company_id;

-- 4.2: Verificar consistência de company_id entre relacionamentos
SELECT 
    'TESTE 4.2 - Consistência company_id cross-module' as test_name,
    COUNT(*) as inconsistent_records
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
WHERE a.company_id != c.company_id; -- ⚠️ Deve ser 0

-- inconsistent_records DEVE ser 0

-- ============================================================================
-- TESTE 5: PERFORMANCE DE QUERIES CROSS-MODULE
-- ============================================================================

-- 5.1: Query complexa com EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    c.name as customer_name,
    s.name as service_name, 
    p.name as professional_name,
    a.appointment_date,
    a.appointment_time
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
JOIN nexus_services.services s ON a.service_id = s.id
JOIN nexus_services.professionals p ON a.professional_id = p.id
WHERE a.company_id = (SELECT id FROM nexus_auth.companies LIMIT 1)
  AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY a.appointment_date, a.appointment_time
LIMIT 20;

-- Execution Time deve ser < 200ms para datasets pequenos/médios

-- ============================================================================
-- TESTE 6: AUDITORIA AUTOMÁTICA  
-- ============================================================================

-- 6.1: Inserir um customer e verificar se auditoria foi criada
BEGIN;

INSERT INTO nexus_crm.customers (
    id, company_id, name, email, status, created_at, updated_at
)
SELECT 
    uuid_generate_v4(),
    id,
    'Cliente Teste Auditoria',
    'teste.auditoria@exemplo.com',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM nexus_auth.companies
LIMIT 1;

-- Verificar se log de auditoria foi criado
SELECT 
    'TESTE 6.1 - Auditoria automática' as test_name,
    COUNT(*) as audit_records_created
FROM nexus_shared.audit_logs
WHERE entity_type = 'customers'
  AND action = 'INSERT'
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute';

-- audit_records_created deve ser >= 1

ROLLBACK;

-- ============================================================================
-- TESTE 7: ÍNDICES CRÍTICOS PARA PERFORMANCE
-- ============================================================================

-- 7.1: Verificar se índices críticos foram criados
SELECT 
    'TESTE 7.1 - Índices críticos' as test_name,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname IN ('nexus_auth', 'nexus_crm', 'nexus_services', 'nexus_agendamento')
  AND indexname LIKE 'idx_%'
ORDER BY schemaname, tablename, indexname;

-- Deve retornar pelo menos 15 índices customizados

-- ============================================================================
-- TESTE 8: CASCADES E RESTRICTIONS
-- ============================================================================

-- 8.1: Testar CASCADE delete (company → users)
BEGIN;

-- Criar company temporária
INSERT INTO nexus_auth.companies (id, name, email, created_at, updated_at)
VALUES (uuid_generate_v4(), 'Empresa Teste DELETE', 'teste.delete@exemplo.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Criar user na empresa
INSERT INTO nexus_auth.users (
    id, email, password, first_name, last_name, company_id, created_at, updated_at
)
SELECT 
    uuid_generate_v4(),
    'user.teste.delete@exemplo.com',
    'senha_hash',
    'Usuario',
    'Teste',
    id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM nexus_auth.companies 
WHERE name = 'Empresa Teste DELETE';

-- Deletar company (deve CASCADE deletar user)
DELETE FROM nexus_auth.companies WHERE name = 'Empresa Teste DELETE';

-- Verificar se user foi deletado via CASCADE
SELECT 
    'TESTE 8.1 - CASCADE delete' as test_name,
    COUNT(*) as remaining_users
FROM nexus_auth.users
WHERE email = 'user.teste.delete@exemplo.com';

-- remaining_users deve ser 0

ROLLBACK;

-- 8.2: Testar RESTRICT delete (customer com appointments)
BEGIN;

-- Criar customer com appointment
INSERT INTO nexus_crm.customers (id, company_id, name, email, status, created_at, updated_at)
SELECT uuid_generate_v4(), id, 'Cliente RESTRICT Teste', 'restrict@teste.com', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM nexus_auth.companies LIMIT 1;

INSERT INTO nexus_agendamento.appointments (
    id, company_id, customer_id, professional_id, service_id,
    appointment_date, appointment_time, appointment_end_time, status, created_at, updated_at
)
SELECT 
    uuid_generate_v4(),
    c.company_id,
    c.id,
    p.id,
    s.id,
    CURRENT_DATE + 1,
    '14:00:00',
    '15:00:00',
    'scheduled',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM nexus_crm.customers c
JOIN nexus_services.professionals p ON c.company_id = p.company_id  
JOIN nexus_services.services s ON c.company_id = s.company_id
WHERE c.name = 'Cliente RESTRICT Teste'
LIMIT 1;

-- Tentar deletar customer (deve FALHAR por RESTRICT)
DO $$
BEGIN
    BEGIN
        DELETE FROM nexus_crm.customers WHERE name = 'Cliente RESTRICT Teste';
        RAISE NOTICE 'TESTE 8.2 - FALHOU: RESTRICT não bloqueou delete';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TESTE 8.2 - PASSOU: RESTRICT bloqueou delete corretamente';
    END;
END $$;

ROLLBACK;

-- ============================================================================
-- RESUMO DOS RESULTADOS
-- ============================================================================

SELECT 
    '🎯 RESUMO DOS TESTES DE VALIDAÇÃO' as titulo,
    'Executar todos os testes acima e verificar:' as instrucoes;

SELECT '✅ CRITÉRIOS DE SUCESSO:' as criterios UNION ALL
SELECT '• Minimum 25 foreign keys criadas' UNION ALL  
SELECT '• Appointment com FK válida: FUNCIONA' UNION ALL
SELECT '• Appointment com FK inválida: FALHA (foreign_key_violation)' UNION ALL
SELECT '• JOINs cross-module: FUNCIONAM sem erro' UNION ALL
SELECT '• Multi-tenancy: Dados isolados por company_id' UNION ALL
SELECT '• Performance: Queries < 200ms' UNION ALL
SELECT '• Auditoria: Triggers funcionando' UNION ALL
SELECT '• Índices: Minimum 15 índices customizados' UNION ALL
SELECT '• CASCADE delete: Funciona em relacionamentos apropriados' UNION ALL
SELECT '• RESTRICT delete: Bloqueia em relacionamentos críticos';

-- ============================================================================
-- COMANDOS PARA EXECUTAR OS TESTES
-- ============================================================================

/*
# Para executar este arquivo de testes:
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -f database/tests/validate-foreign-keys.sql

# Para executar apenas um teste específico:
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "SELECT teste_especifico_aqui;"

# Para monitorar performance:
psql -h localhost -p 5433 -U nexus_user -d nexus_erp -c "\timing on" -f database/tests/validate-foreign-keys.sql
*/