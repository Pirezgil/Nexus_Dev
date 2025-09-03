#!/usr/bin/env node

/**
 * Database Seeding Script
 * Creates necessary test users and company data
 */

const { execSync } = require('child_process');

async function seedDatabase() {
  console.log('🌱 Iniciando seed do banco de dados...');

  try {
    // SQL para criar empresa de teste
    const createCompanySql = `
      INSERT INTO nexus_auth.companies (id, name, plan, is_active, created_at, updated_at)
      VALUES ('test-company-1', 'Demo Company', 'PROFESSIONAL', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `;

    // SQL para criar usuários de teste
    const createUsersSql = `
      INSERT INTO nexus_auth.users (
        id, email, password, first_name, last_name, role, status, 
        email_verified, company_id, created_at, updated_at
      ) VALUES 
      (
        gen_random_uuid(),
        'admin@demo.com',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwtJkFhxgWF7.Y8YO',
        'Admin',
        'Demo',
        'ADMIN',
        'ACTIVE',
        true,
        '0cbd0be3-ef67-4c66-a624-832253665f1b',
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'manager@demo.com',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwtJkFhxgWF7.Y8YO',
        'Manager',
        'Demo',
        'MANAGER',
        'ACTIVE',
        true,
        '0cbd0be3-ef67-4c66-a624-832253665f1b',
        NOW(),
        NOW()
      ),
      (
        gen_random_uuid(),
        'usuario1@demo.com',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwtJkFhxgWF7.Y8YO',
        'Usuario',
        'Demo',
        'USER',
        'ACTIVE',
        true,
        '0cbd0be3-ef67-4c66-a624-832253665f1b',
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW();
    `;

    console.log('📝 Criando empresa de demonstração...');
    execSync(`docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "${createCompanySql}"`, {
      stdio: 'inherit'
    });

    console.log('👥 Criando usuários de demonstração...');
    execSync(`docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "${createUsersSql}"`, {
      stdio: 'inherit'
    });

    console.log('✅ Seed concluído com sucesso!');
    console.log('\n🔑 Credenciais criadas:');
    console.log('- admin@demo.com / 123456789 (ADMIN)');
    console.log('- manager@demo.com / 123456789 (MANAGER)');
    console.log('- usuario1@demo.com / 123456789 (USER)');

    // Verificar se os usuários foram criados
    console.log('\n🔍 Verificando usuários criados...');
    execSync(`docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "SELECT email, first_name, role, status FROM nexus_auth.users WHERE email IN ('admin@demo.com', 'manager@demo.com', 'usuario1@demo.com');"`, {
      stdio: 'inherit'
    });

  } catch (error) {
    console.error('❌ Erro durante o seed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}

module.exports = seedDatabase;