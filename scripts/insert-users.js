const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Inicializar Prisma
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function insertTestUsers() {
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await prisma.$connect();
    
    // Ler o arquivo SQL
    const sqlFile = path.join(__dirname, 'insert-test-users.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📝 Executando script SQL...');
    
    // Dividir o SQL em comandos individuais
    const sqlCommands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    for (const command of sqlCommands) {
      if (command.toUpperCase().startsWith('SELECT')) {
        // Para SELECTs, usar $queryRaw e mostrar resultados
        console.log('🔍 Executando consulta de verificação...');
        const results = await prisma.$queryRawUnsafe(command);
        console.log('✅ Usuários inseridos com sucesso:');
        console.table(results);
      } else if (command.toUpperCase().includes('INSERT')) {
        // Para INSERTs, usar $executeRaw
        await prisma.$executeRawUnsafe(command);
        console.log('✅ Comando INSERT executado com sucesso');
      }
    }
    
    console.log('🎉 Script executado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    
    if (error.code === 'P2002') {
      console.log('⚠️  Usuários já existem no banco. Erro de duplicação.');
    } else if (error.code === 'P2003') {
      console.log('⚠️  Problema com foreign key. Verifique se o schema existe.');
    } else {
      console.log('💡 Dica: Verifique se o banco PostgreSQL está rodando e acessível');
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Desconectado do banco de dados');
  }
}

// Executar o script
insertTestUsers();