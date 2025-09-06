#!/usr/bin/env node

/**
 * ERP Nexus - Database Validation Script
 * Testa conectividade e operações CRUD para todos os módulos
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const DATABASE_URL = "postgresql://nexus_user:nexus_password@localhost:5433/nexus_erp";

// Cliente Prisma para testes
const prisma = new PrismaClient({ 
  datasources: { db: { url: DATABASE_URL } }
});

async function main() {
  try {
    console.log('🔍 Iniciando validação do banco de dados...\n');

    // 1. Testar conexão
    await testConnection();
    
    // 2. Validar estrutura
    await validateSchema();
    
    // 3. Testar operações CRUD
    await testUserManagementModule();
    await testCRMModule();
    await testServicesModule();
    await testAgendamentoModule();
    
    // 4. Validar integridade referencial
    await validateReferentialIntegrity();
    
    // 5. Testar performance básica
    await testBasicPerformance();

    console.log('\n✅ Validação completa! Banco de dados está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante a validação:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function testConnection() {
  console.log('🔌 Testando conexão com o banco...');
  
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('  ✓ Conexão estabelecida com sucesso');
  } catch (error) {
    throw new Error(`Falha na conexão: ${error.message}`);
  }
}

async function validateSchema() {
  console.log('\n📋 Validando estrutura dos schemas...');
  
  try {
    // Verificar se todos os schemas existem
    const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'nexus_%'
      ORDER BY schema_name
    `;
    
    const expectedSchemas = ['nexus_auth', 'nexus_crm', 'nexus_services', 'nexus_agendamento', 'nexus_shared'];
    const foundSchemas = schemas.map(s => s.schema_name);
    
    console.log(`  ✓ Schemas encontrados: ${foundSchemas.join(', ')}`);
    
    for (const expectedSchema of expectedSchemas) {
      if (foundSchemas.includes(expectedSchema)) {
        console.log(`  ✓ Schema ${expectedSchema} existe`);
      } else {
        throw new Error(`Schema ${expectedSchema} não encontrado`);
      }
    }
  } catch (error) {
    throw new Error(`Erro na validação do schema: ${error.message}`);
  }
}

async function testUserManagementModule() {
  console.log('\n👥 Testando módulo User Management...');
  
  try {
    // READ - Verificar empresa existente
    const company = await prisma.$queryRaw`
      SELECT id, name, email FROM nexus_auth.companies LIMIT 1
    `;
    
    if (company.length === 0) {
      throw new Error('Nenhuma empresa encontrada');
    }
    
    console.log(`  ✓ Empresa encontrada: ${company[0].name}`);
    
    // READ - Verificar usuários
    const users = await prisma.$queryRaw`
      SELECT id, first_name, last_name, email, role FROM nexus_auth.users LIMIT 3
    `;
    
    console.log(`  ✓ Usuários encontrados: ${users.length}`);
    
    // READ - Verificar sessões
    const sessions = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_auth.sessions
    `;
    
    console.log(`  ✓ Sessões ativas: ${sessions[0].total}`);
    
  } catch (error) {
    throw new Error(`Erro no módulo User Management: ${error.message}`);
  }
}

async function testCRMModule() {
  console.log('\n🤝 Testando módulo CRM...');
  
  try {
    // READ - Verificar clientes
    const customers = await prisma.$queryRaw`
      SELECT id, name, email, status FROM nexus_crm.customers LIMIT 5
    `;
    
    console.log(`  ✓ Clientes encontrados: ${customers.length}`);
    
    // READ - Verificar notas de clientes
    const notes = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_crm.customer_notes
    `;
    
    console.log(`  ✓ Notas de clientes: ${notes[0].total}`);
    
    // CREATE - Teste de criação de interação
    const testCustomer = customers[0];
    if (testCustomer) {
      const interaction = await prisma.$queryRaw`
        INSERT INTO nexus_crm.customer_interactions 
        (id, customer_id, company_id, type, title, description, created_by, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${testCustomer.id}::uuid,
          (SELECT company_id FROM nexus_crm.customers WHERE id = ${testCustomer.id}::uuid),
          'NOTE'::nexus_crm.interactiontype,
          'Teste de Validação',
          'Interação criada durante validação do sistema',
          'system',
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      
      console.log('  ✓ Interação de teste criada com sucesso');
      
      // DELETE - Limpar teste
      await prisma.$queryRaw`
        DELETE FROM nexus_crm.customer_interactions 
        WHERE description = 'Interação criada durante validação do sistema'
      `;
      
      console.log('  ✓ Limpeza de teste realizada');
    }
    
    // READ - Estatísticas
    const stats = await prisma.$queryRaw`
      SELECT * FROM nexus_crm.customer_stats LIMIT 1
    `;
    
    if (stats.length > 0) {
      console.log(`  ✓ Estatísticas: ${stats[0].total_customers} clientes total`);
    }
    
  } catch (error) {
    throw new Error(`Erro no módulo CRM: ${error.message}`);
  }
}

async function testServicesModule() {
  console.log('\n💼 Testando módulo Services...');
  
  try {
    // READ - Verificar serviços
    const services = await prisma.$queryRaw`
      SELECT id, name, price, category, status FROM nexus_services.services LIMIT 5
    `;
    
    console.log(`  ✓ Serviços encontrados: ${services.length}`);
    
    // READ - Verificar profissionais
    const professionals = await prisma.$queryRaw`
      SELECT id, name, email, specialties, status FROM nexus_services.professionals LIMIT 5
    `;
    
    console.log(`  ✓ Profissionais encontrados: ${professionals.length}`);
    
    // READ - Verificar agendamentos completados
    const completedAppointments = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_services.appointments_completed
    `;
    
    console.log(`  ✓ Agendamentos completados: ${completedAppointments[0].total}`);
    
    // READ - Estatísticas
    const stats = await prisma.$queryRaw`
      SELECT * FROM nexus_services.service_stats LIMIT 1
    `;
    
    if (stats.length > 0) {
      console.log(`  ✓ Estatísticas: ${stats[0].total_services} serviços, ${stats[0].total_professionals} profissionais`);
    }
    
  } catch (error) {
    throw new Error(`Erro no módulo Services: ${error.message}`);
  }
}

async function testAgendamentoModule() {
  console.log('\n📅 Testando módulo Agendamento...');
  
  try {
    // READ - Verificar agendamentos
    const appointments = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_agendamento.appointments
    `;
    
    console.log(`  ✓ Agendamentos encontrados: ${appointments[0].total}`);
    
    // READ - Verificar templates
    const templates = await prisma.$queryRaw`
      SELECT template_name, template_type, channel FROM nexus_agendamento.message_templates
    `;
    
    console.log(`  ✓ Templates de mensagem: ${templates.length}`);
    
    // READ - Verificar configurações
    const config = await prisma.$queryRaw`
      SELECT * FROM nexus_agendamento.agendamento_config LIMIT 1
    `;
    
    if (config.length > 0) {
      console.log(`  ✓ Configurações: Email ${config[0].email_enabled ? 'ativado' : 'desativado'}`);
    }
    
    // READ - Verificar horários de funcionamento
    const businessHours = await prisma.$queryRaw`
      SELECT day_of_week, is_open FROM nexus_agendamento.business_hours ORDER BY day_of_week
    `;
    
    const workingDays = businessHours.filter(h => h.is_open).length;
    console.log(`  ✓ Horários configurados: ${workingDays} dias úteis`);
    
  } catch (error) {
    throw new Error(`Erro no módulo Agendamento: ${error.message}`);
  }
}

async function validateReferentialIntegrity() {
  console.log('\n🔗 Validando integridade referencial...');
  
  try {
    // Verificar consistência usuário-empresa
    const userCompanyCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as inconsistencies
      FROM nexus_auth.users u
      LEFT JOIN nexus_auth.companies c ON u.company_id = c.id
      WHERE c.id IS NULL
    `;
    
    if (userCompanyCheck[0].inconsistencies > 0) {
      throw new Error(`${userCompanyCheck[0].inconsistencies} usuários sem empresa válida`);
    }
    console.log('  ✓ Relação usuário-empresa consistente');
    
    // Verificar consistência cliente-empresa
    const customerCompanyCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as inconsistencies
      FROM nexus_crm.customers c
      WHERE NOT EXISTS (
        SELECT 1 FROM nexus_auth.companies comp WHERE comp.id = c.company_id
      )
    `;
    
    if (customerCompanyCheck[0].inconsistencies > 0) {
      throw new Error(`${customerCompanyCheck[0].inconsistencies} clientes sem empresa válida`);
    }
    console.log('  ✓ Relação cliente-empresa consistente');
    
    // Verificar consistência profissional-usuário
    const professionalUserCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as inconsistencies
      FROM nexus_services.professionals p
      LEFT JOIN nexus_auth.users u ON p.user_id = u.id
      WHERE u.id IS NULL
    `;
    
    if (professionalUserCheck[0].inconsistencies > 0) {
      throw new Error(`${professionalUserCheck[0].inconsistencies} profissionais sem usuário válido`);
    }
    console.log('  ✓ Relação profissional-usuário consistente');
    
  } catch (error) {
    throw new Error(`Erro na integridade referencial: ${error.message}`);
  }
}

async function testBasicPerformance() {
  console.log('\n⚡ Testando performance básica...');
  
  try {
    const start = Date.now();
    
    // Query complexa juntando dados de múltiplos módulos
    const complexQuery = await prisma.$queryRaw`
      SELECT 
        c.name as customer_name,
        comp.name as company_name,
        COUNT(cn.id) as total_notes,
        COUNT(ci.id) as total_interactions
      FROM nexus_crm.customers c
      JOIN nexus_auth.companies comp ON c.company_id = comp.id
      LEFT JOIN nexus_crm.customer_notes cn ON c.id = cn.customer_id
      LEFT JOIN nexus_crm.customer_interactions ci ON c.id = ci.customer_id
      GROUP BY c.id, c.name, comp.name
      LIMIT 10
    `;
    
    const duration = Date.now() - start;
    
    console.log(`  ✓ Query complexa executada em ${duration}ms`);
    console.log(`  ✓ Retornados ${complexQuery.length} registros`);
    
    if (duration > 1000) {
      console.log('  ⚠️  Performance pode ser melhorada (>1s)');
    }
    
  } catch (error) {
    throw new Error(`Erro no teste de performance: ${error.message}`);
  }
}

// Executar validação
if (require.main === module) {
  main();
}

module.exports = { main };