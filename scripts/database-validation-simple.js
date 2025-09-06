#!/usr/bin/env node

/**
 * ERP Nexus - Database Simple Validation Script
 * Valida conectividade e dados básicos de cada módulo
 */

const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = "postgresql://nexus_user:nexus_password@localhost:5433/nexus_erp";

const prisma = new PrismaClient({ 
  datasources: { db: { url: DATABASE_URL } }
});

async function main() {
  try {
    console.log('🔍 Validação Simples do Banco de Dados ERP Nexus\n');
    console.log('='.repeat(60));

    // 1. Testar conexão
    await testConnection();
    
    // 2. Validar cada módulo
    await validateUserManagement();
    await validateCRM();
    await validateServices();  
    await validateAgendamento();
    
    // 3. Resumo final
    await finalSummary();

    console.log('\n✅ Validação concluída com sucesso!');
    console.log('🎉 O banco de dados está pronto para uso!');
    
  } catch (error) {
    console.error('\n❌ Erro durante a validação:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function testConnection() {
  console.log('🔌 Testando Conectividade...');
  
  try {
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    console.log(`  ✓ Conectado ao banco: ${result[0].current_database}`);
    console.log(`  ✓ Usuário: ${result[0].current_user}`);
    console.log(`  ✓ Versão PostgreSQL: ${result[0].version.split(' ')[1]}`);
  } catch (error) {
    throw new Error(`Falha na conexão: ${error.message}`);
  }
}

async function validateUserManagement() {
  console.log('\n👥 Módulo USER MANAGEMENT');
  console.log('-'.repeat(30));
  
  try {
    // Empresas
    const companies = await prisma.$queryRaw`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active
      FROM nexus_auth.companies
    `;
    console.log(`  📊 Empresas: ${companies[0].total} total (${companies[0].active} ativas)`);
    
    // Usuários
    const users = await prisma.$queryRaw`
      SELECT role, COUNT(*) as total
      FROM nexus_auth.users 
      GROUP BY role
      ORDER BY role
    `;
    console.log('  👤 Usuários por role:');
    users.forEach(u => console.log(`     - ${u.role}: ${u.total}`));
    
    // Sessões
    const sessions = await prisma.$queryRaw`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_revoked THEN 1 ELSE 0 END) as revoked
      FROM nexus_auth.sessions
    `;
    console.log(`  🔐 Sessões: ${sessions[0].total} total (${sessions[0].revoked} revogadas)`);
    
    console.log('  ✅ Módulo User Management: FUNCIONANDO');
    
  } catch (error) {
    throw new Error(`User Management: ${error.message}`);
  }
}

async function validateCRM() {
  console.log('\n🤝 Módulo CRM');
  console.log('-'.repeat(15));
  
  try {
    // Clientes
    const customers = await prisma.$queryRaw`
      SELECT status, COUNT(*) as total
      FROM nexus_crm.customers
      GROUP BY status
      ORDER BY status
    `;
    console.log('  📋 Clientes por status:');
    customers.forEach(c => console.log(`     - ${c.status}: ${c.total}`));
    
    // Notas
    const notes = await prisma.$queryRaw`
      SELECT type, COUNT(*) as total
      FROM nexus_crm.customer_notes
      GROUP BY type
      ORDER BY type
    `;
    console.log('  📝 Notas por tipo:');
    notes.forEach(n => console.log(`     - ${n.type}: ${n.total}`));
    
    // Interações
    const interactions = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_crm.customer_interactions
    `;
    console.log(`  💬 Interações: ${interactions[0].total}`);
    
    // Campos customizados
    const customFields = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM nexus_crm.custom_fields
    `;
    console.log(`  🏷️  Campos customizados: ${customFields[0].total}`);
    
    console.log('  ✅ Módulo CRM: FUNCIONANDO');
    
  } catch (error) {
    throw new Error(`CRM: ${error.message}`);
  }
}

async function validateServices() {
  console.log('\n💼 Módulo SERVICES');
  console.log('-'.repeat(20));
  
  try {
    // Serviços
    const services = await prisma.$queryRaw`
      SELECT status, COUNT(*) as total, 
             AVG(price) as avg_price,
             MIN(price) as min_price,
             MAX(price) as max_price
      FROM nexus_services.services
      GROUP BY status
      ORDER BY status
    `;
    console.log('  🛎️  Serviços:');
    services.forEach(s => {
      console.log(`     - ${s.status}: ${s.total} serviços`);
      console.log(`       Preços: R$ ${parseFloat(s.min_price).toFixed(2)} - R$ ${parseFloat(s.max_price).toFixed(2)} (média: R$ ${parseFloat(s.avg_price).toFixed(2)})`);
    });
    
    // Profissionais
    const professionals = await prisma.$queryRaw`
      SELECT status, COUNT(*) as total
      FROM nexus_services.professionals
      GROUP BY status
      ORDER BY status
    `;
    console.log('  👩‍⚕️ Profissionais:');
    professionals.forEach(p => console.log(`     - ${p.status}: ${p.total}`));
    
    // Agendamentos completados
    const completed = await prisma.$queryRaw`
      SELECT COUNT(*) as total, 
             SUM(total_amount) as revenue
      FROM nexus_services.appointments_completed
    `;
    console.log(`  📅 Agendamentos completados: ${completed[0].total}`);
    if (completed[0].revenue) {
      console.log(`  💰 Receita total: R$ ${parseFloat(completed[0].revenue).toFixed(2)}`);
    }
    
    console.log('  ✅ Módulo Services: FUNCIONANDO');
    
  } catch (error) {
    throw new Error(`Services: ${error.message}`);
  }
}

async function validateAgendamento() {
  console.log('\n📅 Módulo AGENDAMENTO');
  console.log('-'.repeat(25));
  
  try {
    // Agendamentos
    const appointments = await prisma.$queryRaw`
      SELECT status, COUNT(*) as total
      FROM nexus_agendamento.appointments
      GROUP BY status
      ORDER BY status
    `;
    
    if (appointments.length > 0) {
      console.log('  📋 Agendamentos:');
      appointments.forEach(a => console.log(`     - ${a.status}: ${a.total}`));
    } else {
      console.log('  📋 Agendamentos: Nenhum agendamento encontrado');
    }
    
    // Templates de mensagem
    const templates = await prisma.$queryRaw`
      SELECT template_type, channel, COUNT(*) as total
      FROM nexus_agendamento.message_templates
      WHERE active = true
      GROUP BY template_type, channel
      ORDER BY template_type, channel
    `;
    console.log('  📱 Templates ativos:');
    templates.forEach(t => console.log(`     - ${t.template_type} (${t.channel}): ${t.total}`));
    
    // Horários de funcionamento
    const businessHours = await prisma.$queryRaw`
      SELECT SUM(CASE WHEN is_open THEN 1 ELSE 0 END) as working_days,
             COUNT(*) as total_days
      FROM nexus_agendamento.business_hours
    `;
    console.log(`  🕐 Horários: ${businessHours[0].working_days}/${businessHours[0].total_days} dias úteis`);
    
    // Configurações
    const config = await prisma.$queryRaw`
      SELECT whatsapp_enabled, sms_enabled, email_enabled, 
             auto_confirmation_enabled
      FROM nexus_agendamento.agendamento_config
      LIMIT 1
    `;
    
    if (config.length > 0) {
      console.log('  ⚙️  Configurações:');
      console.log(`     - WhatsApp: ${config[0].whatsapp_enabled ? 'Ativado' : 'Desativado'}`);
      console.log(`     - SMS: ${config[0].sms_enabled ? 'Ativado' : 'Desativado'}`);
      console.log(`     - Email: ${config[0].email_enabled ? 'Ativado' : 'Desativado'}`);
      console.log(`     - Auto-confirmação: ${config[0].auto_confirmation_enabled ? 'Ativada' : 'Desativada'}`);
    }
    
    console.log('  ✅ Módulo Agendamento: FUNCIONANDO');
    
  } catch (error) {
    throw new Error(`Agendamento: ${error.message}`);
  }
}

async function finalSummary() {
  console.log('\n📊 RESUMO FINAL');
  console.log('='.repeat(60));
  
  try {
    const summary = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM nexus_auth.companies WHERE is_active = true) as active_companies,
        (SELECT COUNT(*) FROM nexus_auth.users) as total_users,
        (SELECT COUNT(*) FROM nexus_crm.customers) as total_customers,
        (SELECT COUNT(*) FROM nexus_crm.customers WHERE status = 'ACTIVE') as active_customers,
        (SELECT COUNT(*) FROM nexus_services.services WHERE status = 'ACTIVE') as active_services,
        (SELECT COUNT(*) FROM nexus_services.professionals WHERE status = 'ACTIVE') as active_professionals,
        (SELECT COUNT(*) FROM nexus_agendamento.appointments) as total_appointments,
        (SELECT COUNT(*) FROM nexus_agendamento.message_templates WHERE active = true) as active_templates
    `;
    
    const data = summary[0];
    
    console.log(`🏢 Empresas ativas: ${data.active_companies}`);
    console.log(`👥 Usuários totais: ${data.total_users}`);
    console.log(`🤝 Clientes totais: ${data.total_customers} (${data.active_customers} ativos)`);
    console.log(`💼 Serviços ativos: ${data.active_services}`);  
    console.log(`👩‍⚕️ Profissionais ativos: ${data.active_professionals}`);
    console.log(`📅 Agendamentos: ${data.total_appointments}`);
    console.log(`📱 Templates de mensagem: ${data.active_templates}`);
    
    // Status dos schemas
    const schemas = await prisma.$queryRaw`
      SELECT 
        t.schemaname,
        COUNT(*) as table_count
      FROM pg_tables t 
      WHERE t.schemaname LIKE 'nexus_%'
      GROUP BY t.schemaname
      ORDER BY t.schemaname
    `;
    
    console.log('\n📋 Schemas e tabelas:');
    schemas.forEach(s => console.log(`  ${s.schemaname}: ${s.table_count} tabelas`));
    
  } catch (error) {
    throw new Error(`Resumo: ${error.message}`);
  }
}

// Executar validação
if (require.main === module) {
  main();
}

module.exports = { main };