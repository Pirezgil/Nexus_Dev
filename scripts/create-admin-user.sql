-- Criar usuário administrador para testes
-- Hash da senha "123456": $2a$12$...

-- Criar empresa de teste
INSERT INTO "Company" (id, name, "createdAt", "updatedAt") 
VALUES ('test-company-1', 'Empresa Teste', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Criar usuário administrador
INSERT INTO "User" (
  id, 
  email, 
  password, 
  "firstName", 
  "lastName", 
  role, 
  "isActive", 
  "companyId", 
  "createdAt", 
  "updatedAt"
) VALUES (
  'admin-user-1',
  'admin@teste.com',
  '$2a$12$LQv3c1yqBw2CgwQcGKOhg.Nfm3wFMOuq1xj8P0F2vwXaAs6YZR4qG', -- password: 123456
  'Admin',
  'Sistema',
  'ADMIN',
  true,
  'test-company-1',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET 
  password = '$2a$12$LQv3c1yqBw2CgwQcGKOhg.Nfm3wFMOuq1xj8P0F2vwXaAs6YZR4qG',
  role = 'ADMIN',
  "isActive" = true;