-- ============================================================================
-- FOREIGN KEYS CROSS-MODULE - ERP NEXUS
-- ============================================================================
-- Este script contém todas as foreign keys críticas entre módulos
-- Deve ser executado APÓS a criação das tabelas base
-- ============================================================================

-- ============================================================================
-- 1. FOREIGN KEYS DO MÓDULO AGENDAMENTO (nexus_agendamento)
-- ============================================================================

-- Appointments -> CRM Customers
ALTER TABLE nexus_agendamento.appointments 
ADD CONSTRAINT fk_appointments_customer 
FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE RESTRICT;

-- Appointments -> Services Professionals
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_professional  
FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id) ON DELETE RESTRICT;

-- Appointments -> Services Services
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_service
FOREIGN KEY (service_id) REFERENCES nexus_services.services(id) ON DELETE RESTRICT;

-- Appointments -> Auth Users (created_by)
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_creator
FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id);

-- Appointments -> Auth Users (updated_by) 
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_updater
FOREIGN KEY (updated_by) REFERENCES nexus_auth.users(id);

-- Appointments -> Services Appointments Completed (when completed)
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_completed
FOREIGN KEY (completed_appointment_id) REFERENCES nexus_services.appointments_completed(id);

-- ============================================================================
-- 2. FOREIGN KEYS DO MÓDULO SERVICES (nexus_services) 
-- ============================================================================

-- Professionals -> Auth Users
ALTER TABLE nexus_services.professionals
ADD CONSTRAINT fk_professionals_user
FOREIGN KEY (user_id) REFERENCES nexus_auth.users(id) ON DELETE CASCADE;

-- Appointments Completed -> CRM Customers
ALTER TABLE nexus_services.appointments_completed
ADD CONSTRAINT fk_appointments_completed_customer
FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE RESTRICT;

-- ============================================================================
-- 3. FOREIGN KEYS DO MÓDULO CRM (nexus_crm)
-- ============================================================================

-- Customer Notes -> Auth Users (created_by)
ALTER TABLE nexus_crm.customer_notes
ADD CONSTRAINT fk_customer_notes_creator
FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id);

-- Customer Interactions -> Auth Users (created_by)
ALTER TABLE nexus_crm.customer_interactions  
ADD CONSTRAINT fk_customer_interactions_creator
FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id);

-- ============================================================================
-- 4. FOREIGN KEYS WAITING LIST (nexus_agendamento)
-- ============================================================================

-- Waiting List -> CRM Customers
ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_customer
FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE CASCADE;

-- Waiting List -> Services Services  
ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_service
FOREIGN KEY (service_id) REFERENCES nexus_services.services(id);

-- Waiting List -> Services Professionals (optional)
ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_professional  
FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id);

-- Waiting List -> Auth Users (contacted_by)
ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_contacted_by
FOREIGN KEY (contacted_by) REFERENCES nexus_auth.users(id);

-- Waiting List -> Appointments (when scheduled)
ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_appointment
FOREIGN KEY (appointment_id) REFERENCES nexus_agendamento.appointments(id);

-- ============================================================================
-- 5. FOREIGN KEYS SCHEDULE BLOCKS (nexus_agendamento)
-- ============================================================================

-- Schedule Blocks -> Services Professionals (optional - can be null for general blocks)
ALTER TABLE nexus_agendamento.schedule_blocks
ADD CONSTRAINT fk_schedule_blocks_professional
FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id);

-- Schedule Blocks -> Auth Users (created_by)
ALTER TABLE nexus_agendamento.schedule_blocks
ADD CONSTRAINT fk_schedule_blocks_creator
FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id);

-- ============================================================================
-- 6. FOREIGN KEYS MESSAGE TEMPLATES (nexus_agendamento)  
-- ============================================================================

-- Message Templates -> Auth Users (created_by)
ALTER TABLE nexus_agendamento.message_templates
ADD CONSTRAINT fk_message_templates_creator
FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id);

-- ============================================================================
-- 7. FOREIGN KEYS MULTI-TENANCY (company_id em TODAS as tabelas)
-- ============================================================================

-- Auth tables
ALTER TABLE nexus_auth.users
ADD CONSTRAINT fk_users_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_auth.sessions
ADD CONSTRAINT fk_sessions_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

-- CRM tables
ALTER TABLE nexus_crm.customers
ADD CONSTRAINT fk_customers_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_crm.customer_notes
ADD CONSTRAINT fk_customer_notes_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_crm.customer_interactions
ADD CONSTRAINT fk_customer_interactions_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_crm.customer_stats
ADD CONSTRAINT fk_customer_stats_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

-- Services tables
ALTER TABLE nexus_services.services
ADD CONSTRAINT fk_services_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_services.professionals
ADD CONSTRAINT fk_professionals_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_services.appointments_completed
ADD CONSTRAINT fk_appointments_completed_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_services.service_photos
ADD CONSTRAINT fk_service_photos_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_services.service_stats
ADD CONSTRAINT fk_service_stats_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

-- Agendamento tables
ALTER TABLE nexus_agendamento.appointments
ADD CONSTRAINT fk_appointments_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_agendamento.schedule_blocks
ADD CONSTRAINT fk_schedule_blocks_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_agendamento.waiting_list
ADD CONSTRAINT fk_waiting_list_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_agendamento.message_templates
ADD CONSTRAINT fk_message_templates_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_agendamento.business_hours
ADD CONSTRAINT fk_business_hours_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_agendamento.agendamento_config
ADD CONSTRAINT fk_agendamento_config_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

-- Shared tables
ALTER TABLE nexus_shared.audit_logs
ADD CONSTRAINT fk_audit_logs_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

ALTER TABLE nexus_shared.audit_logs
ADD CONSTRAINT fk_audit_logs_user
FOREIGN KEY (user_id) REFERENCES nexus_auth.users(id);

ALTER TABLE nexus_shared.integration_logs
ADD CONSTRAINT fk_integration_logs_company
FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE;

-- ============================================================================
-- VALIDAÇÃO DAS FOREIGN KEYS CRIADAS
-- ============================================================================

-- Query para verificar todas as foreign keys criadas
SELECT 
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

-- ============================================================================
-- COMENTÁRIOS E JUSTIFICATIVAS
-- ============================================================================

/*
FOREIGN KEYS CROSS-MODULE IMPLEMENTADAS:

1. AGENDAMENTO → CRM:
   - appointments.customer_id → customers.id (CRÍTICO)

2. AGENDAMENTO → SERVICES:  
   - appointments.professional_id → professionals.id (CRÍTICO)
   - appointments.service_id → services.id (CRÍTICO)

3. SERVICES → CRM:
   - appointments_completed.customer_id → customers.id (CRÍTICO)

4. SERVICES → AUTH:
   - professionals.user_id → users.id (CRÍTICO)

5. MULTI-TENANCY:
   - TODAS as tabelas.company_id → companies.id (FUNDAMENTAL)

6. AUDITORIA:
   - Todas as tabelas com created_by/updated_by → users.id

BENEFÍCIOS OBTIDOS:
✅ Integridade referencial real (PostgreSQL garante)
✅ JOINs cross-module funcionando  
✅ Impossível criar appointments com customer_id inválido
✅ Cascade deletes corretos (quando apropriado)
✅ Restrict deletes em dados críticos (evita perda de dados)

VALIDAÇÃO:
- Este script deve ser executado após criação das tabelas
- Todas as foreign keys são testadas automaticamente pelo PostgreSQL
- Views e queries cross-module já funcionarão imediatamente
*/