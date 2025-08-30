-- Script para cadastrar usuários de teste no ERP Nexus
-- Execute este SQL no seu banco PostgreSQL

-- 1. Cadastrar empresa demo
INSERT INTO nexus_auth.companies (
    id, name, email, cnpj, is_active, plan, max_users
) VALUES (
    'c2525b63-30f4-4176-bda6-b132389a63bb',
    'Empresa Demo',
    'empresa@demo.com', 
    '12345678901234',
    true,
    'premium',
    100
);

-- 2. Cadastrar usuários de teste
-- Admin: admin@demo.com / 123456789
INSERT INTO nexus_auth.users (
    id, email, password, first_name, last_name, role, status, 
    email_verified, company_id, created_at, updated_at
) VALUES (
    '728c1ef9-36fc-421e-94d7-4c4f25b6f92e',
    'admin@demo.com',
    '$2a$10$oLNQ2bLLKAIRSW0kC/g7wuS1qnAAapvETz/hBhiaqzo4s1bI93k3.',
    'Admin',
    'Sistema',
    'ADMIN',
    'ACTIVE',
    true,
    'c2525b63-30f4-4176-bda6-b132389a63bb',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Manager: manager@demo.com / 123456789
INSERT INTO nexus_auth.users (
    id, email, password, first_name, last_name, role, status, 
    email_verified, company_id, created_at, updated_at
) VALUES (
    'cd0f4030-d5a8-4e1a-9270-c736b88043d8',
    'manager@demo.com',
    '$2a$10$Bw2usC8IhPwYAxbVjXlKke3gbKqvyDb/v/DT66u6KRrKrXyqG7km',
    'Manager',
    'Sistema',
    'MANAGER',
    'ACTIVE',
    true,
    'c2525b63-30f4-4176-bda6-b132389a63bb',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- User: usuario1@demo.com / 123456789
INSERT INTO nexus_auth.users (
    id, email, password, first_name, last_name, role, status, 
    email_verified, company_id, created_at, updated_at
) VALUES (
    '6ca224a9-a249-45bb-a389-57d6e4ff323a',
    'usuario1@demo.com',
    '$2a$10$T32NBwVsp6/.0iluSoafwec71zDEhygzG9Zcs8wHoomRB2ZGg/b3u',
    'Usuario',
    'Teste',
    'USER',
    'ACTIVE',
    true,
    'c2525b63-30f4-4176-bda6-b132389a63bb',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Verificar se os usuários foram inseridos
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.status,
    c.name as company_name
FROM nexus_auth.users u
JOIN nexus_auth.companies c ON u.company_id = c.id
WHERE u.email IN ('admin@demo.com', 'manager@demo.com', 'usuario1@demo.com');