const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function adicionarUsuariosDemo() {
  try {
    await prisma.$connect();
    console.log('🔌 Conectado ao banco de dados\n');
    
    // Buscar uma empresa existente
    const empresa = await prisma.$queryRaw`
      SELECT id, name FROM nexus_auth.companies LIMIT 1
    `;
    
    if (empresa.length === 0) {
      console.log('❌ Nenhuma empresa encontrada');
      return;
    }
    
    const companyId = empresa[0].id;
    console.log(`🏢 Usando empresa: ${empresa[0].name} (${companyId})\n`);
    
    // Usuários para adicionar
    const novosUsuarios = [
      {
        email: 'admin@demo.com',
        password: '123456789',
        firstName: 'Admin',
        lastName: 'Demo',
        role: 'ADMIN'
      },
      {
        email: 'manager@demo.com', 
        password: '123456789',
        firstName: 'Manager',
        lastName: 'Demo',
        role: 'MANAGER'
      },
      {
        email: 'usuario1@demo.com',
        password: '123456789',
        firstName: 'Usuario',
        lastName: 'Demo',
        role: 'USER'
      }
    ];
    
    console.log('👥 Adicionando usuários de teste...\n');
    
    for (const usuario of novosUsuarios) {
      try {
        // Verificar se o usuário já existe
        const usuarioExistente = await prisma.$queryRaw`
          SELECT email FROM nexus_auth.users WHERE email = ${usuario.email}
        `;
        
        if (usuarioExistente.length > 0) {
          console.log(`⚠️  ${usuario.email} - já existe, pulando...`);
          continue;
        }
        
        // Criar hash da senha
        const hashedPassword = bcrypt.hashSync(usuario.password, 10);
        const userId = uuidv4();
        
        // Inserir usuário com cast correto
        await prisma.$executeRaw`
          INSERT INTO nexus_auth.users (
            id, email, password, first_name, last_name, role, 
            status, email_verified, company_id, created_at, updated_at
          ) VALUES (
            ${userId}, ${usuario.email}, ${hashedPassword}, 
            ${usuario.firstName}, ${usuario.lastName}, ${usuario.role}::nexus_auth."UserRole",
            'ACTIVE'::nexus_auth."UserStatus", true, ${companyId}, 
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        
        console.log(`✅ ${usuario.email} - criado com sucesso (${usuario.role})`);
        
      } catch (erro) {
        if (erro.code === 'P2002') {
          console.log(`⚠️  ${usuario.email} - já existe (constraint violation)`);
        } else {
          console.log(`❌ ${usuario.email} - erro: ${erro.message}`);
        }
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificando usuários demo criados:');
    const usuariosDemo = await prisma.$queryRaw`
      SELECT email, first_name, last_name, role, status
      FROM nexus_auth.users 
      WHERE email IN ('admin@demo.com', 'manager@demo.com', 'usuario1@demo.com')
      ORDER BY role
    `;
    
    if (usuariosDemo.length > 0) {
      console.table(usuariosDemo);
      console.log(`\n🎉 Processo concluído! ${usuariosDemo.length} usuários demo disponíveis.`);
      
      console.log('\n💡 Credenciais de acesso:');
      usuariosDemo.forEach(u => {
        console.log(`   ${u.email} / 123456789 (${u.role})`);
      });
    } else {
      console.log('❌ Nenhum usuário demo foi criado');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Desconectado do banco de dados');
  }
}

adicionarUsuariosDemo();