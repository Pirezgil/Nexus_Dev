-- ERP Nexus - Database Seeds
-- Script SQL para popular o banco com dados de exemplo

-- Verificar se a empresa existe
\echo 'Verificando empresa existente...'
SELECT id, name FROM nexus_auth.companies LIMIT 1;

-- Definir variável da empresa (usar o ID da empresa existente)
\set company_id '1b08f658-7197-4441-a11d-5c9c888d92db'

\echo 'Inserindo dados de exemplo...'

-- ============================================================================
-- CRM - CLIENTES DE EXEMPLO
-- ============================================================================

\echo 'Criando clientes de exemplo...'

INSERT INTO nexus_crm.customers (id, company_id, name, email, phone, cpf_cnpj, address_street, address_number, address_neighborhood, address_city, address_state, address_zipcode, status, source, created_at, updated_at) 
VALUES 
(gen_random_uuid(), :'company_id', 'Ana Silva Santos', 'ana.silva@email.com', '11999887766', '123.456.789-00', 'Rua das Flores', '123', 'Centro', 'São Paulo', 'SP', '01000-000', 'ACTIVE', 'website', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Bruno Costa Oliveira', 'bruno.costa@email.com', '11888776655', '987.654.321-00', 'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP', '01310-000', 'ACTIVE', 'referral', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Carla Pereira Lima', 'carla.pereira@email.com', '11777665544', '456.789.123-00', 'Rua Augusta', '500', 'Consolação', 'São Paulo', 'SP', '01305-000', 'PROSPECT', 'marketing', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Diana Rodrigues Santos', 'diana.rodrigues@email.com', '11666554433', '789.123.456-00', 'Av. Faria Lima', '2000', 'Pinheiros', 'São Paulo', 'SP', '05426-000', 'ACTIVE', 'walk-in', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Eduardo Martins Silva', 'eduardo.martins@email.com', '11555443322', '321.654.987-00', 'Rua Oscar Freire', '300', 'Jardins', 'São Paulo', 'SP', '01426-000', 'ACTIVE', 'website', NOW(), NOW())
ON CONFLICT (company_id, email) DO NOTHING;

-- Adicionar notas para os clientes
\echo 'Adicionando notas aos clientes...'

INSERT INTO nexus_crm.customer_notes (id, customer_id, company_id, content, type, created_by, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    c.id,
    c.company_id,
    'Cliente ' || c.name || ' cadastrado com sucesso. Primeiro contato via ' || c.source || '.',
    'GENERAL',
    'system',
    NOW(),
    NOW()
FROM nexus_crm.customers c 
WHERE c.company_id = :'company_id'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SERVICES - SERVIÇOS E PROFISSIONAIS
-- ============================================================================

\echo 'Criando serviços de exemplo...'

INSERT INTO nexus_services.services (id, company_id, name, description, duration, price, category, status, created_at, updated_at) 
VALUES 
(gen_random_uuid(), :'company_id', 'Limpeza de Pele Básica', 'Limpeza de pele profunda com extração e hidratação', 60, 80.00, 'Estética Facial', 'ACTIVE', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Massagem Relaxante', 'Massagem corporal para alívio do stress e tensões musculares', 90, 120.00, 'Massoterapia', 'ACTIVE', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Tratamento Anti-idade', 'Procedimento completo para redução de rugas e linhas de expressão', 120, 200.00, 'Estética Facial', 'ACTIVE', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Drenagem Linfática', 'Técnica de massagem para redução de inchaços e toxinas', 75, 90.00, 'Massoterapia', 'ACTIVE', NOW(), NOW()),
(gen_random_uuid(), :'company_id', 'Peeling Químico', 'Renovação da pele através de ácidos específicos', 45, 150.00, 'Estética Facial', 'ACTIVE', NOW(), NOW())
ON CONFLICT DO NOTHING;

\echo 'Criando profissionais de exemplo...'

-- Buscar usuários para associar aos profissionais
INSERT INTO nexus_services.professionals (id, company_id, user_id, name, email, phone, specialties, status, hourly_rate, commission, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u.company_id,
    u.id,
    u.first_name || ' ' || u.last_name,
    u.email,
    CASE 
        WHEN u.role = 'MANAGER' THEN '11999001122'
        WHEN u.role = 'USER' THEN '11888002233'
        ELSE '11777003344'
    END,
    CASE 
        WHEN u.role = 'MANAGER' THEN ARRAY['Estética Facial', 'Limpeza de Pele', 'Massoterapia']
        ELSE ARRAY['Massoterapia', 'Drenagem Linfática']
    END,
    'ACTIVE',
    CASE 
        WHEN u.role = 'MANAGER' THEN 100.00
        ELSE 80.00
    END,
    CASE 
        WHEN u.role = 'MANAGER' THEN 40.00
        ELSE 30.00
    END,
    NOW(),
    NOW()
FROM nexus_auth.users u 
WHERE u.company_id = :'company_id' 
AND u.role IN ('MANAGER', 'USER') 
LIMIT 2
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- AGENDAMENTO - TEMPLATES E CONFIGURAÇÕES
-- ============================================================================

\echo 'Criando templates de mensagem...'

INSERT INTO nexus_agendamento.message_templates (id, company_id, template_name, template_type, channel, subject, content, active, is_default, created_at, updated_at) 
VALUES 
(gen_random_uuid(), :'company_id', 'appointment_confirmation', 'confirmation', 'whatsapp', NULL, 'Olá {{customer_name}}! 🌟

Seu agendamento foi confirmado:
📅 Data: {{date}}
🕐 Horário: {{time}}
💼 Serviço: {{service_name}}
👩‍⚕️ Profissional: {{professional_name}}

Estamos ansiosos para atendê-lo(a)!
Qualquer dúvida, entre em contato.', true, true, NOW(), NOW()),

(gen_random_uuid(), :'company_id', 'appointment_reminder', 'reminder', 'whatsapp', NULL, 'Oi {{customer_name}}! 😊

Lembrando do seu agendamento:
📅 Amanhã às {{time}}
💼 {{service_name}}

Nos vemos em breve!
Para cancelar ou reagendar, entre em contato.', true, true, NOW(), NOW()),

(gen_random_uuid(), :'company_id', 'appointment_cancellation', 'cancellation', 'whatsapp', NULL, 'Olá {{customer_name}},

Seu agendamento do dia {{date}} às {{time}} foi cancelado conforme solicitado.

Para reagendar, entre em contato conosco.
Obrigado pela compreensão! 💙', true, true, NOW(), NOW())

ON CONFLICT (company_id, template_name, channel) DO NOTHING;

\echo 'Criando configurações de agendamento...'

INSERT INTO nexus_agendamento.agendamento_config (id, company_id, whatsapp_enabled, sms_enabled, email_enabled, auto_confirmation_enabled, max_advance_booking_days, min_advance_booking_hours, allow_same_day_booking, reminder_default_hours, default_slot_duration, working_hours_start, working_hours_end, calendar_view_default, created_at, updated_at) 
VALUES 
(gen_random_uuid(), :'company_id', false, false, true, false, 60, 2, true, 24, 30, '08:00:00', '18:00:00', 'week', NOW(), NOW())
ON CONFLICT (company_id) DO NOTHING;

\echo 'Criando horários de funcionamento...'

INSERT INTO nexus_agendamento.business_hours (id, company_id, day_of_week, is_open, start_time, end_time, lunch_start, lunch_end, slot_duration_minutes, advance_booking_days, same_day_booking, created_at, updated_at) 
VALUES 
(gen_random_uuid(), :'company_id', 1, true, '08:00:00', '18:00:00', '12:00:00', '13:00:00', 30, 60, true, NOW(), NOW()), -- Segunda
(gen_random_uuid(), :'company_id', 2, true, '08:00:00', '18:00:00', '12:00:00', '13:00:00', 30, 60, true, NOW(), NOW()), -- Terça
(gen_random_uuid(), :'company_id', 3, true, '08:00:00', '18:00:00', '12:00:00', '13:00:00', 30, 60, true, NOW(), NOW()), -- Quarta
(gen_random_uuid(), :'company_id', 4, true, '08:00:00', '18:00:00', '12:00:00', '13:00:00', 30, 60, true, NOW(), NOW()), -- Quinta
(gen_random_uuid(), :'company_id', 5, true, '08:00:00', '17:00:00', '12:00:00', '13:00:00', 30, 60, true, NOW(), NOW()), -- Sexta
(gen_random_uuid(), :'company_id', 6, false, NULL, NULL, NULL, NULL, 30, 60, true, NOW(), NOW()), -- Sábado
(gen_random_uuid(), :'company_id', 0, false, NULL, NULL, NULL, NULL, 30, 60, true, NOW(), NOW())  -- Domingo
ON CONFLICT (company_id, day_of_week) DO NOTHING;

-- ============================================================================
-- AGENDAMENTOS DE EXEMPLO
-- ============================================================================

\echo 'Criando agendamentos de exemplo...'

-- Criar alguns agendamentos para os próximos dias
INSERT INTO nexus_agendamento.appointments (
    id, company_id, customer_id, professional_id, service_id, 
    appointment_date, appointment_time, appointment_end_time, 
    status, estimated_price, created_at, updated_at
)
SELECT 
    gen_random_uuid(),
    :'company_id',
    c.id,
    p.id,
    s.id,
    CURRENT_DATE + INTERVAL '1 day', -- Amanhã
    '09:00:00',
    '10:00:00',
    'scheduled',
    s.price,
    NOW(),
    NOW()
FROM nexus_crm.customers c
CROSS JOIN nexus_services.professionals p
CROSS JOIN nexus_services.services s
WHERE c.company_id = :'company_id' 
AND p.company_id = :'company_id' 
AND s.company_id = :'company_id'
AND c.status = 'ACTIVE'
AND p.status = 'ACTIVE'
AND s.status = 'ACTIVE'
LIMIT 1;

-- ============================================================================
-- ESTATÍSTICAS E RELATÓRIOS
-- ============================================================================

\echo 'Atualizando estatísticas...'

-- Atualizar estatísticas do CRM
INSERT INTO nexus_crm.customer_stats (id, company_id, total_customers, active_customers, prospect_customers, total_interactions, total_notes, average_interactions, last_calculated_at)
SELECT 
    gen_random_uuid(),
    :'company_id',
    (SELECT COUNT(*) FROM nexus_crm.customers WHERE company_id = :'company_id'),
    (SELECT COUNT(*) FROM nexus_crm.customers WHERE company_id = :'company_id' AND status = 'ACTIVE'),
    (SELECT COUNT(*) FROM nexus_crm.customers WHERE company_id = :'company_id' AND status = 'PROSPECT'),
    0,
    (SELECT COUNT(*) FROM nexus_crm.customer_notes WHERE company_id = :'company_id'),
    0.0,
    NOW()
ON CONFLICT (company_id) DO UPDATE SET
    total_customers = EXCLUDED.total_customers,
    active_customers = EXCLUDED.active_customers,
    prospect_customers = EXCLUDED.prospect_customers,
    total_notes = EXCLUDED.total_notes,
    last_calculated_at = NOW();

-- Atualizar estatísticas dos serviços
INSERT INTO nexus_services.service_stats (id, company_id, total_services, active_services, total_professionals, active_professionals, total_appointments, completed_appointments, total_revenue, average_ticket, last_calculated_at)
SELECT 
    gen_random_uuid(),
    :'company_id',
    (SELECT COUNT(*) FROM nexus_services.services WHERE company_id = :'company_id'),
    (SELECT COUNT(*) FROM nexus_services.services WHERE company_id = :'company_id' AND status = 'ACTIVE'),
    (SELECT COUNT(*) FROM nexus_services.professionals WHERE company_id = :'company_id'),
    (SELECT COUNT(*) FROM nexus_services.professionals WHERE company_id = :'company_id' AND status = 'ACTIVE'),
    (SELECT COUNT(*) FROM nexus_agendamento.appointments WHERE company_id = :'company_id'),
    0,
    0.00,
    0.00,
    NOW()
ON CONFLICT (company_id) DO UPDATE SET
    total_services = EXCLUDED.total_services,
    active_services = EXCLUDED.active_services,
    total_professionals = EXCLUDED.total_professionals,
    active_professionals = EXCLUDED.active_professionals,
    total_appointments = EXCLUDED.total_appointments,
    last_calculated_at = NOW();

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

\echo 'Verificando dados inseridos...'

\echo '=== RESUMO DOS DADOS INSERIDOS ==='
\echo 'Clientes:'
SELECT COUNT(*) as total_clientes FROM nexus_crm.customers WHERE company_id = :'company_id';

\echo 'Serviços:'
SELECT COUNT(*) as total_servicos FROM nexus_services.services WHERE company_id = :'company_id';

\echo 'Profissionais:'
SELECT COUNT(*) as total_profissionais FROM nexus_services.professionals WHERE company_id = :'company_id';

\echo 'Agendamentos:'
SELECT COUNT(*) as total_agendamentos FROM nexus_agendamento.appointments WHERE company_id = :'company_id';

\echo 'Templates de mensagem:'
SELECT COUNT(*) as total_templates FROM nexus_agendamento.message_templates WHERE company_id = :'company_id';

\echo ''
\echo '🎉 Dados de exemplo inseridos com sucesso!'
\echo 'O banco de dados está pronto para uso!'