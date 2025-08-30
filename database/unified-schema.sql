-- ============================================================================
-- SCHEMA UNIFICADO ERP NEXUS - DATABASE UNIFICADO COM FOREIGN KEYS CROSS-MODULE
-- ============================================================================
-- Data: 28/08/2025
-- Versão: 1.0
-- Objetivo: Corrigir isolamento total entre módulos implementando foreign keys reais
-- ============================================================================

-- Drop existing schemas if they exist (for clean setup)
DROP SCHEMA IF EXISTS nexus_auth CASCADE;
DROP SCHEMA IF EXISTS nexus_crm CASCADE;
DROP SCHEMA IF EXISTS nexus_services CASCADE;
DROP SCHEMA IF EXISTS nexus_agendamento CASCADE;
DROP SCHEMA IF EXISTS nexus_shared CASCADE;

-- Create all schemas
CREATE SCHEMA nexus_auth;
CREATE SCHEMA nexus_crm;
CREATE SCHEMA nexus_services;
CREATE SCHEMA nexus_agendamento;
CREATE SCHEMA nexus_shared;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SCHEMA: nexus_auth (BASE - Referenciado por todos)
-- ============================================================================

-- Companies table (base for multi-tenancy)
CREATE TABLE nexus_auth.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    cnpj VARCHAR(18) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    plan VARCHAR(20) DEFAULT 'basic', -- basic, premium, enterprise
    max_users INTEGER DEFAULT 5,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles enum
CREATE TYPE nexus_auth.user_role AS ENUM ('ADMIN', 'USER', 'MANAGER', 'VIEWER');
CREATE TYPE nexus_auth.user_status AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');

-- Users table
CREATE TABLE nexus_auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar VARCHAR(500),
    role nexus_auth.user_role DEFAULT 'USER',
    status nexus_auth.user_status DEFAULT 'ACTIVE',
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    email_verification_token VARCHAR(255),
    preferences JSONB,
    company_id UUID NOT NULL,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id)
);

-- Sessions table
CREATE TABLE nexus_auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    access_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    device_info VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    is_revoked BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- Password reset requests
CREATE TABLE nexus_auth.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email verifications
CREATE TABLE nexus_auth.email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT false,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SCHEMA: nexus_crm (Referencia nexus_auth.companies)
-- ============================================================================

-- Customer status enum
CREATE TYPE nexus_crm.customer_status AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT', 'BLOCKED');
CREATE TYPE nexus_crm.interaction_type AS ENUM ('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'SMS', 'NOTE', 'TASK', 'VISIT');
CREATE TYPE nexus_crm.note_type AS ENUM ('GENERAL', 'IMPORTANT', 'REMINDER', 'FOLLOW_UP', 'COMPLAINT', 'COMPLIMENT');

-- Customers table
CREATE TABLE nexus_crm.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    document VARCHAR(50), -- CPF/CNPJ
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    status nexus_crm.customer_status DEFAULT 'PROSPECT',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- Customer notes
CREATE TABLE nexus_crm.customer_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    company_id UUID NOT NULL,
    content TEXT NOT NULL,
    type nexus_crm.note_type DEFAULT 'GENERAL',
    is_private BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_customer_notes_customer FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_notes_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_notes_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id)
);

-- Customer interactions
CREATE TABLE nexus_crm.customer_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    company_id UUID NOT NULL,
    type nexus_crm.interaction_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB,
    is_completed BOOLEAN DEFAULT true,
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_customer_interactions_customer FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_interactions_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_interactions_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id)
);

-- Customer statistics (for analytics)
CREATE TABLE nexus_crm.customer_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID UNIQUE NOT NULL,
    total_customers INTEGER DEFAULT 0,
    active_customers INTEGER DEFAULT 0,
    prospect_customers INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    total_notes INTEGER DEFAULT 0,
    average_interactions DECIMAL(10,2) DEFAULT 0,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_customer_stats_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- ============================================================================
-- SCHEMA: nexus_services (Referencia nexus_auth e nexus_crm)
-- ============================================================================

-- Service and appointment enums
CREATE TYPE nexus_services.service_status AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
CREATE TYPE nexus_services.professional_status AS ENUM ('ACTIVE', 'INACTIVE', 'VACATION', 'SICK_LEAVE');
CREATE TYPE nexus_services.appointment_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE nexus_services.payment_status AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'CANCELLED', 'REFUNDED');
CREATE TYPE nexus_services.photo_type AS ENUM ('BEFORE', 'AFTER', 'DURING', 'DOCUMENTATION');

-- Services table
CREATE TABLE nexus_services.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- Duration in minutes
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    status nexus_services.service_status DEFAULT 'ACTIVE',
    requirements TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_services_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- Professionals table
CREATE TABLE nexus_services.professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    user_id UUID UNIQUE NOT NULL, -- Reference to User Management
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    specialties TEXT[] DEFAULT '{}',
    status nexus_services.professional_status DEFAULT 'ACTIVE',
    hourly_rate DECIMAL(10,2),
    commission DECIMAL(5,2), -- Commission percentage
    work_schedule JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_professionals_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_professionals_user FOREIGN KEY (user_id) REFERENCES nexus_auth.users(id) ON DELETE CASCADE
);

-- Completed appointments table
CREATE TABLE nexus_services.appointments_completed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    service_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    customer_id UUID NOT NULL, -- ⭐ FOREIGN KEY para nexus_crm.customers
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    
    -- Appointment details
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    actual_duration INTEGER NOT NULL,
    status nexus_services.appointment_status DEFAULT 'COMPLETED',
    
    -- Financial
    service_price DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status nexus_services.payment_status DEFAULT 'PENDING',
    payment_method VARCHAR(50),
    
    -- Notes
    notes TEXT,
    customer_notes TEXT,
    internal_notes TEXT,
    metadata JSONB,
    
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_appointments_completed_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_appointments_completed_service FOREIGN KEY (service_id) REFERENCES nexus_services.services(id),
    CONSTRAINT fk_appointments_completed_professional FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id),
    CONSTRAINT fk_appointments_completed_customer FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) -- ⭐ CROSS-SCHEMA FK
);

-- Service photos table
CREATE TABLE nexus_services.service_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    company_id UUID NOT NULL,
    type nexus_services.photo_type NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    filesize INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    width INTEGER,
    height INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_service_photos_appointment FOREIGN KEY (appointment_id) REFERENCES nexus_services.appointments_completed(id) ON DELETE CASCADE,
    CONSTRAINT fk_service_photos_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- Service statistics
CREATE TABLE nexus_services.service_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID UNIQUE NOT NULL,
    total_services INTEGER DEFAULT 0,
    active_services INTEGER DEFAULT 0,
    total_professionals INTEGER DEFAULT 0,
    active_professionals INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,
    completed_appointments INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    average_ticket DECIMAL(10,2) DEFAULT 0,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_service_stats_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- ============================================================================
-- SCHEMA: nexus_agendamento (Referencia TODOS os outros schemas)
-- ============================================================================

-- Appointments table with REAL foreign keys
CREATE TABLE nexus_agendamento.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    
    -- ⭐ FOREIGN KEYS PARA OUTROS MÓDULOS (REAL REFERENCES)
    customer_id UUID NOT NULL,      -- -> nexus_crm.customers(id)
    professional_id UUID NOT NULL, -- -> nexus_services.professionals(id)  
    service_id UUID NOT NULL,       -- -> nexus_services.services(id)
    
    -- Temporal data
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_end_time TIME NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    
    -- Appointment status
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show, rescheduled
    
    -- Appointment data
    notes TEXT,
    internal_notes TEXT,
    estimated_price DECIMAL(10,2),
    
    -- Notification settings
    send_confirmation BOOLEAN DEFAULT true,
    send_reminder BOOLEAN DEFAULT true,
    reminder_hours_before INTEGER DEFAULT 24,
    
    -- Confirmation data
    confirmed_at TIMESTAMP,
    confirmed_by VARCHAR(50), -- customer, staff, auto
    
    -- Rescheduling data
    original_appointment_id UUID,
    rescheduled_from_date DATE,
    rescheduled_from_time TIME,
    reschedule_reason VARCHAR(255),
    
    -- Completion data (integration with Services)
    completed_at TIMESTAMP,
    completed_appointment_id UUID, -- -> nexus_services.appointments_completed(id)
    
    -- Audit
    created_by UUID, -- -> nexus_auth.users(id)
    updated_by UUID, -- -> nexus_auth.users(id)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ⭐ TODAS AS FOREIGN KEYS CROSS-MODULE
    CONSTRAINT fk_appointments_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_appointments_customer FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointments_professional FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointments_service FOREIGN KEY (service_id) REFERENCES nexus_services.services(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointments_original FOREIGN KEY (original_appointment_id) REFERENCES nexus_agendamento.appointments(id),
    CONSTRAINT fk_appointments_completed FOREIGN KEY (completed_appointment_id) REFERENCES nexus_services.appointments_completed(id),
    CONSTRAINT fk_appointments_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id),
    CONSTRAINT fk_appointments_updater FOREIGN KEY (updated_by) REFERENCES nexus_auth.users(id)
);

-- Schedule blocks table
CREATE TABLE nexus_agendamento.schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    professional_id UUID, -- NULL = block for all professionals
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    block_type VARCHAR(50) NOT NULL, -- holiday, vacation, maintenance, personal
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule JSONB,
    active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_schedule_blocks_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_blocks_professional FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id),
    CONSTRAINT fk_schedule_blocks_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id)
);

-- Waiting list table
CREATE TABLE nexus_agendamento.waiting_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,         -- -> nexus_crm.customers(id)
    service_id UUID NOT NULL,          -- -> nexus_services.services(id)
    professional_id UUID,              -- -> nexus_services.professionals(id) (optional)
    
    preferred_date DATE,
    preferred_time_start TIME,
    preferred_time_end TIME,
    flexible_date BOOLEAN DEFAULT true,
    flexible_time BOOLEAN DEFAULT true,
    
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, contacted, scheduled, expired
    priority INTEGER DEFAULT 0,
    
    notify_phone BOOLEAN DEFAULT true,
    notify_whatsapp BOOLEAN DEFAULT true,
    notify_email BOOLEAN DEFAULT false,
    
    expires_at TIMESTAMP,
    contacted_at TIMESTAMP,
    contacted_by UUID, -- -> nexus_auth.users(id)
    appointment_id UUID, -- -> nexus_agendamento.appointments(id) when scheduled
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_waiting_list_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_waiting_list_customer FOREIGN KEY (customer_id) REFERENCES nexus_crm.customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_waiting_list_service FOREIGN KEY (service_id) REFERENCES nexus_services.services(id),
    CONSTRAINT fk_waiting_list_professional FOREIGN KEY (professional_id) REFERENCES nexus_services.professionals(id),
    CONSTRAINT fk_waiting_list_contacted_by FOREIGN KEY (contacted_by) REFERENCES nexus_auth.users(id),
    CONSTRAINT fk_waiting_list_appointment FOREIGN KEY (appointment_id) REFERENCES nexus_agendamento.appointments(id),
    CONSTRAINT fk_waiting_list_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id)
);

-- Appointment notifications table
CREATE TABLE nexus_agendamento.appointment_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- confirmation, reminder, cancellation, reschedule
    channel VARCHAR(20) NOT NULL, -- whatsapp, sms, email
    recipient_phone VARCHAR(20),
    recipient_email VARCHAR(255),
    message_template VARCHAR(100),
    message_content TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, read
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    failure_reason TEXT,
    external_message_id VARCHAR(255),
    provider_response JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_appointment_notifications_appointment FOREIGN KEY (appointment_id) REFERENCES nexus_agendamento.appointments(id) ON DELETE CASCADE
);

-- Message templates table
CREATE TABLE nexus_agendamento.message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- confirmation, reminder, cancellation
    channel VARCHAR(20) NOT NULL, -- whatsapp, sms, email
    subject VARCHAR(255),
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_message_templates_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_templates_creator FOREIGN KEY (created_by) REFERENCES nexus_auth.users(id),
    
    UNIQUE(company_id, template_name, channel)
);

-- Business hours table
CREATE TABLE nexus_agendamento.business_hours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    is_open BOOLEAN DEFAULT true,
    start_time TIME,
    end_time TIME,
    lunch_start TIME,
    lunch_end TIME,
    slot_duration_minutes INTEGER DEFAULT 30,
    advance_booking_days INTEGER DEFAULT 60,
    same_day_booking BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_business_hours_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    
    UNIQUE(company_id, day_of_week)
);

-- Agendamento configuration table
CREATE TABLE nexus_agendamento.agendamento_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID UNIQUE NOT NULL,
    
    -- WhatsApp settings
    whatsapp_enabled BOOLEAN DEFAULT false,
    whatsapp_phone VARCHAR(20),
    whatsapp_api_token VARCHAR(500), -- Should be encrypted
    whatsapp_webhook_url VARCHAR(255),
    
    -- SMS settings  
    sms_enabled BOOLEAN DEFAULT false,
    sms_provider VARCHAR(50),
    sms_api_key VARCHAR(255), -- Should be encrypted
    sms_sender VARCHAR(20),
    
    -- Email settings
    email_enabled BOOLEAN DEFAULT true,
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255), -- Should be encrypted
    email_from VARCHAR(255),
    
    -- Booking settings
    auto_confirmation_enabled BOOLEAN DEFAULT false,
    max_advance_booking_days INTEGER DEFAULT 60,
    min_advance_booking_hours INTEGER DEFAULT 2,
    allow_same_day_booking BOOLEAN DEFAULT true,
    reminder_default_hours INTEGER DEFAULT 24,
    
    -- Calendar settings
    default_slot_duration INTEGER DEFAULT 30,
    working_hours_start TIME DEFAULT '08:00:00',
    working_hours_end TIME DEFAULT '18:00:00',
    calendar_view_default VARCHAR(10) DEFAULT 'week',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_agendamento_config_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- ============================================================================
-- SCHEMA: nexus_shared (Logs centralizados e auditoria)
-- ============================================================================

-- Central audit log table
CREATE TABLE nexus_shared.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    user_id UUID,
    module VARCHAR(50) NOT NULL, -- auth, crm, services, agendamento
    action VARCHAR(100) NOT NULL, -- CREATE_CUSTOMER, UPDATE_APPOINTMENT, etc.
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_audit_logs_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES nexus_auth.users(id)
);

-- System logs table
CREATE TABLE nexus_shared.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL, -- DEBUG, INFO, WARN, ERROR, FATAL
    module VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    context JSONB,
    error_stack TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration logs (for API calls between modules)
CREATE TABLE nexus_shared.integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID,
    source_module VARCHAR(50) NOT NULL,
    target_module VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_body JSONB,
    response_body JSONB,
    status_code INTEGER,
    response_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_integration_logs_company FOREIGN KEY (company_id) REFERENCES nexus_auth.companies(id) ON DELETE CASCADE
);

-- ============================================================================
-- ÍNDICES OTIMIZADOS PARA QUERIES CROSS-MODULE
-- ============================================================================

-- Auth schema indexes
CREATE INDEX idx_users_company_id ON nexus_auth.users(company_id);
CREATE INDEX idx_users_email ON nexus_auth.users(email);
CREATE INDEX idx_sessions_user_id ON nexus_auth.sessions(user_id);
CREATE INDEX idx_sessions_company_id ON nexus_auth.sessions(company_id);

-- CRM schema indexes
CREATE INDEX idx_customers_company_id ON nexus_crm.customers(company_id);
CREATE INDEX idx_customers_email ON nexus_crm.customers(email);
CREATE INDEX idx_customers_phone ON nexus_crm.customers(phone);
CREATE INDEX idx_customers_status ON nexus_crm.customers(status);
CREATE INDEX idx_customer_notes_customer_id ON nexus_crm.customer_notes(customer_id);
CREATE INDEX idx_customer_notes_company_id ON nexus_crm.customer_notes(company_id);

-- Services schema indexes  
CREATE INDEX idx_services_company_id ON nexus_services.services(company_id);
CREATE INDEX idx_services_status ON nexus_services.services(status);
CREATE INDEX idx_professionals_company_id ON nexus_services.professionals(company_id);
CREATE INDEX idx_professionals_user_id ON nexus_services.professionals(user_id);
CREATE INDEX idx_appointments_completed_customer_id ON nexus_services.appointments_completed(customer_id);
CREATE INDEX idx_appointments_completed_professional_id ON nexus_services.appointments_completed(professional_id);

-- Agendamento schema indexes (CRITICAL for performance)
CREATE INDEX idx_appointments_company_customer ON nexus_agendamento.appointments(company_id, customer_id);
CREATE INDEX idx_appointments_professional_date ON nexus_agendamento.appointments(professional_id, appointment_date, appointment_time);
CREATE INDEX idx_appointments_date_range ON nexus_agendamento.appointments(appointment_date, appointment_time);
CREATE INDEX idx_waiting_list_service_date ON nexus_agendamento.waiting_list(service_id, preferred_date);

-- Shared schema indexes
CREATE INDEX idx_audit_logs_company_module ON nexus_shared.audit_logs(company_id, module);
CREATE INDEX idx_audit_logs_entity ON nexus_shared.audit_logs(entity_type, entity_id);
CREATE INDEX idx_system_logs_level_module ON nexus_shared.system_logs(level, module);

-- ============================================================================
-- VIEWS PARA QUERIES CROSS-MODULE FREQUENTES
-- ============================================================================

-- View: Appointments com todos os dados relacionados
CREATE VIEW nexus_shared.appointments_full AS
SELECT 
    a.id,
    a.company_id,
    a.appointment_date,
    a.appointment_time,
    a.status,
    
    -- Customer data
    c.name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    
    -- Professional data  
    p.name as professional_name,
    p.email as professional_email,
    
    -- Service data
    s.name as service_name,
    s.duration as service_duration,
    s.price as service_price,
    
    -- Company data
    comp.name as company_name
    
FROM nexus_agendamento.appointments a
JOIN nexus_crm.customers c ON a.customer_id = c.id
JOIN nexus_services.professionals p ON a.professional_id = p.id
JOIN nexus_services.services s ON a.service_id = s.id
JOIN nexus_auth.companies comp ON a.company_id = comp.id;

-- View: Dashboard statistics
CREATE VIEW nexus_shared.dashboard_stats AS
SELECT 
    comp.id as company_id,
    comp.name as company_name,
    
    -- Customer stats
    COALESCE(cs.total_customers, 0) as total_customers,
    COALESCE(cs.active_customers, 0) as active_customers,
    
    -- Service stats
    COALESCE(ss.total_services, 0) as total_services,
    COALESCE(ss.total_professionals, 0) as total_professionals,
    COALESCE(ss.total_revenue, 0) as total_revenue,
    
    -- Appointment stats (calculated)
    (SELECT COUNT(*) FROM nexus_agendamento.appointments WHERE company_id = comp.id) as total_appointments,
    (SELECT COUNT(*) FROM nexus_agendamento.appointments WHERE company_id = comp.id AND status = 'scheduled') as scheduled_appointments
    
FROM nexus_auth.companies comp
LEFT JOIN nexus_crm.customer_stats cs ON comp.id = cs.company_id
LEFT JOIN nexus_services.service_stats ss ON comp.id = ss.company_id;

-- ============================================================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================================================

-- Function for automatic audit logging
CREATE OR REPLACE FUNCTION nexus_shared.audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO nexus_shared.audit_logs (
        company_id,
        module,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        COALESCE(NEW.company_id, OLD.company_id),
        TG_ARGV[0], -- module name
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Audit triggers for all critical tables
CREATE TRIGGER audit_customers 
    AFTER INSERT OR UPDATE OR DELETE ON nexus_crm.customers
    FOR EACH ROW EXECUTE FUNCTION nexus_shared.audit_trigger_function('crm');

CREATE TRIGGER audit_appointments
    AFTER INSERT OR UPDATE OR DELETE ON nexus_agendamento.appointments  
    FOR EACH ROW EXECUTE FUNCTION nexus_shared.audit_trigger_function('agendamento');

CREATE TRIGGER audit_services
    AFTER INSERT OR UPDATE OR DELETE ON nexus_services.services
    FOR EACH ROW EXECUTE FUNCTION nexus_shared.audit_trigger_function('services');

CREATE TRIGGER audit_professionals
    AFTER INSERT OR UPDATE OR DELETE ON nexus_services.professionals
    FOR EACH ROW EXECUTE FUNCTION nexus_shared.audit_trigger_function('services');

-- ============================================================================
-- COMENTÁRIOS FINAIS
-- ============================================================================

-- Este schema resolve os problemas críticos identificados:
-- ✅ Foreign keys REAIS entre módulos (não mais strings soltas)
-- ✅ Integridade referencial garantida pelo PostgreSQL  
-- ✅ JOINs cross-module funcionando
-- ✅ Multi-tenancy preservado via company_id
-- ✅ Auditoria centralizada no nexus_shared
-- ✅ Índices otimizados para performance
-- ✅ Views para queries complexas frequentes
-- ✅ Triggers automáticos para auditoria

COMMENT ON SCHEMA nexus_auth IS 'Schema base: usuários, empresas e autenticação';
COMMENT ON SCHEMA nexus_crm IS 'Schema CRM: clientes, notas e interações';
COMMENT ON SCHEMA nexus_services IS 'Schema Services: serviços, profissionais e atendimentos';
COMMENT ON SCHEMA nexus_agendamento IS 'Schema Agendamento: agenda, notificações e lista de espera';
COMMENT ON SCHEMA nexus_shared IS 'Schema compartilhado: logs, auditoria e relatórios';