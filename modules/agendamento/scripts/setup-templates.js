#!/usr/bin/env node
/**
 * Script para criar templates padrão de notificação WhatsApp
 * Executa automaticamente ao iniciar o sistema
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = {
  whatsapp: {
    confirmation: {
      template_name: 'appointment_confirmation_whatsapp',
      content: `✅ *Agendamento Confirmado!*

Olá {{customer_name}}, seu agendamento foi confirmado:

📅 *Data:* {{date}}
⏰ *Horário:* {{time}}
👨‍⚕️ *Profissional:* {{professional}}
💼 *Serviço:* {{service}}

Em caso de dúvidas, entre em contato conosco.

Obrigado pela preferência! 😊`
    },
    reminder: {
      template_name: 'appointment_reminder_whatsapp',
      content: `⏰ *Lembrete de Agendamento*

Olá {{customer_name}}, lembrando que você tem um agendamento:

📅 *Data:* {{date}}
⏰ *Horário:* {{time}}
👨‍⚕️ *Profissional:* {{professional}}
💼 *Serviço:* {{service}}

Caso precise remarcar, entre em contato conosco com antecedência.

Te esperamos! 😊`
    },
    cancellation: {
      template_name: 'appointment_cancellation_whatsapp',
      content: `❌ *Agendamento Cancelado*

Olá {{customer_name}}, informamos que seu agendamento foi cancelado:

📅 *Data:* {{date}}
⏰ *Horário:* {{time}}
👨‍⚕️ *Profissional:* {{professional}}

Para reagendar, entre em contato conosco.

Obrigado pela compreensão! 🙏`
    },
    reschedule: {
      template_name: 'appointment_reschedule_whatsapp',
      content: `📅 *Agendamento Reagendado*

Olá {{customer_name}}, seu agendamento foi reagendado:

📅 *Nova Data:* {{date}}
⏰ *Novo Horário:* {{time}}
👨‍⚕️ *Profissional:* {{professional}}
💼 *Serviço:* {{service}}

Te esperamos! 😊`
    }
  }
};

async function createDefaultTemplates(companyId = 'default') {
  console.log(`🎨 Criando templates padrão para empresa: ${companyId}\n`);
  
  let createdCount = 0;
  let skippedCount = 0;

  for (const channel of Object.keys(DEFAULT_TEMPLATES)) {
    const channelTemplates = DEFAULT_TEMPLATES[channel];
    
    for (const type of Object.keys(channelTemplates)) {
      const template = channelTemplates[type];
      
      try {
        // Verificar se já existe
        const existing = await prisma.messageTemplate.findFirst({
          where: {
            company_id: companyId,
            template_name: template.template_name
          }
        });

        if (existing) {
          console.log(`⏭️  Template já existe: ${template.template_name}`);
          skippedCount++;
          continue;
        }

        // Criar template
        const created = await prisma.messageTemplate.create({
          data: {
            company_id: companyId,
            template_name: template.template_name,
            template_type: type,
            channel: channel,
            content: template.content,
            active: true,
            is_default: true,
            created_by: 'system-setup'
          }
        });

        console.log(`✅ Template criado: ${created.template_name} (${created.template_type})`);
        createdCount++;

      } catch (error) {
        console.error(`❌ Erro ao criar template ${template.template_name}:`, error.message);
      }
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   Templates criados: ${createdCount}`);
  console.log(`   Templates já existiam: ${skippedCount}`);
  console.log(`   Total de templates: ${createdCount + skippedCount}`);
}

async function listTemplates(companyId = 'default') {
  console.log(`\n📋 Templates existentes para empresa: ${companyId}`);
  
  const templates = await prisma.messageTemplate.findMany({
    where: { company_id: companyId },
    orderBy: [
      { template_type: 'asc' },
      { channel: 'asc' }
    ]
  });

  if (templates.length === 0) {
    console.log(`   Nenhum template encontrado.`);
    return;
  }

  templates.forEach((template, index) => {
    console.log(`   ${index + 1}. ${template.template_name}`);
    console.log(`      Tipo: ${template.template_type} | Canal: ${template.channel}`);
    console.log(`      Ativo: ${template.active ? '✅' : '❌'} | Padrão: ${template.is_default ? '✅' : '❌'}`);
    console.log(`      Criado: ${template.created_at.toLocaleDateString('pt-BR')}`);
    console.log('');
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';
  const companyId = args[1] || 'default';

  console.log('🎭 WhatsApp Templates Setup\n');

  try {
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados');

    switch (command) {
      case 'create':
        await createDefaultTemplates(companyId);
        await listTemplates(companyId);
        break;
        
      case 'list':
        await listTemplates(companyId);
        break;
        
      case 'clean':
        console.log(`🧹 Removendo todos os templates para empresa: ${companyId}`);
        const deleted = await prisma.messageTemplate.deleteMany({
          where: { company_id: companyId }
        });
        console.log(`   ${deleted.count} templates removidos`);
        break;
        
      default:
        console.log(`❌ Comando desconhecido: ${command}`);
        console.log('\n📖 Uso:');
        console.log('   node setup-templates.js create [company_id]  # Criar templates padrão');
        console.log('   node setup-templates.js list [company_id]    # Listar templates existentes');
        console.log('   node setup-templates.js clean [company_id]   # Remover todos os templates');
        process.exit(1);
    }

  } catch (error) {
    console.error('💥 Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Desconectado do banco de dados');
  }
}

main();