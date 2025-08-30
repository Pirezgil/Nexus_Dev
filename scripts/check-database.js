const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function verificarBanco() {
  try {
    await prisma.$connect();
    console.log('🔌 Conectado ao banco com sucesso!\n');
    
    // 1. Verificar schemas
    console.log('📊 Verificando schemas...');
    const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'nexus_%'
      ORDER BY schema_name
    `;
    
    if (schemas.length === 0) {
      console.log('❌ ERRO: Nenhum schema nexus_ encontrado!');
      console.log('💡 Execute primeiro o script unified-schema.sql');
      return;
    }
    
    console.log('✅ Schemas encontrados:');
    schemas.forEach(s => console.log(`   - ${s.schema_name}`));
    
    // 2. Verificar tabelas
    console.log('\n📋 Verificando tabelas...');
    const tables = await prisma.$queryRaw`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'nexus_auth'
      ORDER BY table_name
    `;
    
    console.log('✅ Tabelas no schema nexus_auth:');
    tables.forEach(t => console.log(`   - ${t.table_name}`));
    
    // 3. Verificar dados
    if (tables.some(t => t.table_name === 'companies')) {
      console.log('\n🏢 Verificando empresas...');
      const companies = await prisma.$queryRaw`
        SELECT id, name, email FROM nexus_auth.companies
      `;
      console.table(companies);
    }
    
    if (tables.some(t => t.table_name === 'users')) {
      console.log('\n👥 Verificando usuários...');
      const users = await prisma.$queryRaw`
        SELECT 
          u.email,
          u.first_name,
          u.last_name,
          u.role,
          u.status
        FROM nexus_auth.users u
        ORDER BY u.role
      `;
      
      if (users.length > 0) {
        console.table(users);
        console.log(`\n✅ Total: ${users.length} usuários encontrados`);
      } else {
        console.log('❌ Nenhum usuário encontrado');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('💡 O banco ou schema não existe. Execute primeiro:');
      console.log('   1. O script unified-schema.sql');
      console.log('   2. O script insert-test-users.sql');
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

verificarBanco();