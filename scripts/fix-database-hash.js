#!/usr/bin/env node

/**
 * Fix Database Hash Script
 * Corrige o problema de escape de caracteres nos hashes bcrypt
 */

const { execSync } = require('child_process');

async function fixDatabaseHash() {
  console.log('🔧 Corrigindo hashes bcrypt no banco de dados...');

  try {
    // Gerar hash correto usando bcrypt do container user-management
    console.log('1. Gerando hash bcrypt válido...');
    const hashResult = execSync(`docker exec nexus-user-management node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('123456789', 12));"`, { encoding: 'utf8' }).trim();
    
    console.log('Hash gerado:', hashResult);

    // Preparar comando SQL com escape adequado
    const sqlCommand = `DELETE FROM nexus_auth.users WHERE email = 'manager@demo.com'; INSERT INTO nexus_auth.users (id, email, password, first_name, last_name, role, status, email_verified, company_id, created_at, updated_at) VALUES (gen_random_uuid(), 'manager@demo.com', E'${hashResult.replace(/\$/g, '\\$')}', 'Manager', 'Demo', 'MANAGER', 'ACTIVE', true, '0cbd0be3-ef67-4c66-a624-832253665f1b', NOW(), NOW());`;

    console.log('2. Recriando usuário com hash correto...');
    execSync(`docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "${sqlCommand}"`, {
      stdio: 'inherit'
    });

    // Verificar se funcionou
    console.log('3. Verificando hash no banco...');
    execSync(`docker exec nexus-postgres psql -U nexus_user -d nexus_erp -c "SELECT email, substring(password, 1, 20) as hash_prefix FROM nexus_auth.users WHERE email = 'manager@demo.com';"`, {
      stdio: 'inherit'
    });

    // Testar login
    console.log('4. Testando login...');
    const loginResult = execSync(`curl -X POST http://localhost:5001/api/auth/login -H "Content-Type: application/json" -d '{"email":"manager@demo.com","password":"123456789"}' -s`, { encoding: 'utf8' });
    
    const response = JSON.parse(loginResult);
    
    if (response.success) {
      console.log('✅ LOGIN FUNCIONANDO! Token:', response.data?.tokens?.accessToken?.substring(0, 20) + '...');
    } else {
      console.log('❌ Login ainda falhando:', response.error || response.message);
    }

  } catch (error) {
    console.error('❌ Erro ao corrigir hash:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  fixDatabaseHash().catch(console.error);
}

module.exports = fixDatabaseHash;