-- Nexus ERP Database Initialization Script
-- This script creates the schemas and initial structure for all modules

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for modular architecture
CREATE SCHEMA IF NOT EXISTS nexus_auth;      -- User Management Module
CREATE SCHEMA IF NOT EXISTS nexus_crm;       -- CRM Module  
CREATE SCHEMA IF NOT EXISTS nexus_services;  -- Services Module
CREATE SCHEMA IF NOT EXISTS nexus_agendamento; -- Agendamento Module
CREATE SCHEMA IF NOT EXISTS nexus_shared;    -- Shared utilities, logs, audit

-- Set proper permissions (nexus_user should have access to all schemas)
GRANT ALL PRIVILEGES ON SCHEMA nexus_auth TO nexus_user;
GRANT ALL PRIVILEGES ON SCHEMA nexus_crm TO nexus_user;
GRANT ALL PRIVILEGES ON SCHEMA nexus_services TO nexus_user;
GRANT ALL PRIVILEGES ON SCHEMA nexus_agendamento TO nexus_user;
GRANT ALL PRIVILEGES ON SCHEMA nexus_shared TO nexus_user;

-- Grant usage and create permissions
GRANT USAGE, CREATE ON SCHEMA nexus_auth TO nexus_user;
GRANT USAGE, CREATE ON SCHEMA nexus_crm TO nexus_user;
GRANT USAGE, CREATE ON SCHEMA nexus_services TO nexus_user;
GRANT USAGE, CREATE ON SCHEMA nexus_agendamento TO nexus_user;
GRANT USAGE, CREATE ON SCHEMA nexus_shared TO nexus_user;

-- Shared Tables (nexus_shared schema)
-- Companies table - Master table for multi-tenancy
CREATE TABLE IF NOT EXISTS nexus_shared.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    plan VARCHAR(50) DEFAULT 'basic',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_slug ON nexus_shared.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON nexus_shared.companies(status);

-- Audit log table for cross-module events
CREATE TABLE IF NOT EXISTS nexus_shared.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES nexus_shared.companies(id),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    user_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON nexus_shared.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON nexus_shared.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON nexus_shared.audit_logs(created_at);

-- Insert default company for development
INSERT INTO nexus_shared.companies (name, slug, email, plan, status)
VALUES ('Empresa Demo', 'demo', 'admin@demo.com', 'premium', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION nexus_shared.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON DATABASE nexus_erp IS 'Nexus ERP - Sistema ERP Modular Multi-tenant';
COMMENT ON SCHEMA nexus_auth IS 'Authentication and User Management Module';
COMMENT ON SCHEMA nexus_crm IS 'Customer Relationship Management Module';
COMMENT ON SCHEMA nexus_services IS 'Services, Professionals and Appointments Module';
COMMENT ON SCHEMA nexus_agendamento IS 'Scheduling and Calendar Module';
COMMENT ON SCHEMA nexus_shared IS 'Shared resources, audit logs and utilities';