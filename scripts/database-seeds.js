#!/usr/bin/env node

/**
 * ERP Nexus - Database Seeds
 * Script para popular o banco com dados de exemplo
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// URLs de conexão para cada módulo
const DATABASE_URL = "postgresql://nexus_user:nexus_password@localhost:5433/nexus_erp";

// Cliente Prisma unificado 
const prisma = new PrismaClient({ 
  datasources: { db: { url: DATABASE_URL } }
});

async function main() {
  try {
    console.log('🚀 Iniciando inserção de dados de exemplo...\n');

    // 1. Obter empresa existente
    const company = await prisma.company.findFirst();
    if (!company) {
      throw new Error('Nenhuma empresa encontrada. Execute as migrações primeiro.');
    }
    
    console.log(`✅ Empresa encontrada: ${company.name} (${company.id})\n`);

    // 2. Criar clientes de exemplo
    await seedCustomers(company.id);
    
    // 3. Criar serviços de exemplo
    await seedServices(company.id);
    
    // 4. Criar profissionais de exemplo
    await seedProfessionals(company.id);
    
    // 5. Criar templates de mensagem
    await seedMessageTemplates(company.id);
    
    // 6. Criar configurações de negócio
    await seedBusinessConfig(company.id);
    
    // 7. Criar alguns agendamentos de exemplo
    await seedAppointments(company.id);

    console.log('\n🎉 Todos os dados de exemplo foram inseridos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a inserção dos dados:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedCustomers(companyId) {
  console.log('👥 Criando clientes de exemplo...');
  
  const customers = [
    {
      name: 'Ana Silva',
      email: 'ana.silva@email.com',
      phone: '11999887766',
      cpfCnpj: '123.456.789-00',
      addressStreet: 'Rua das Flores',
      addressNumber: '123',
      addressNeighborhood: 'Centro',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZipcode: '01000-000',
      status: 'ACTIVE',
      source: 'website'
    },
    {
      name: 'Bruno Santos',
      email: 'bruno.santos@email.com',
      phone: '11888776655',
      cpfCnpj: '987.654.321-00',
      addressStreet: 'Av. Paulista',
      addressNumber: '1000',
      addressNeighborhood: 'Bela Vista',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZipcode: '01310-000',
      status: 'ACTIVE',
      source: 'referral'
    },
    {
      name: 'Carla Oliveira',
      email: 'carla.oliveira@email.com',
      phone: '11777665544',
      cpfCnpj: '456.789.123-00',
      status: 'PROSPECT',
      source: 'marketing'
    },
    {
      name: 'Diana Costa',
      email: 'diana.costa@email.com',
      phone: '11666554433',
      cpfCnpj: '789.123.456-00',
      status: 'ACTIVE',
      source: 'walk-in',
      tags: ['VIP', 'Fidelizada']
    },
    {
      name: 'Eduardo Lima',
      email: 'eduardo.lima@email.com',
      phone: '11555443322',
      status: 'ACTIVE',
      source: 'website'
    }
  ];

  for (const customerData of customers) {
    try {
      const customer = await prisma.customer.create({
        data: {
          ...customerData,
          companyId
        }
      });
      
      // Adicionar algumas notas
      await prisma.customerNote.create({
        data: {
          customerId: customer.id,
          companyId,
          content: `Cliente ${customer.name} cadastrado com sucesso. Primeiro contato via ${customer.source}.`,
          type: 'GENERAL',
          createdBy: 'system'
        }
      });
      
      console.log(`  ✓ Cliente criado: ${customer.name}`);
    } catch (error) {
      console.log(`  ⚠️  Cliente ${customerData.name} pode já existir, ignorando...`);
    }
  }
}

async function seedServices(companyId) {
  console.log('\n💼 Criando serviços de exemplo...');
  
  const services = [
    {
      name: 'Limpeza de Pele Básica',
      description: 'Limpeza de pele profunda com extração e hidratação',
      duration: 60,
      price: 80.00,
      category: 'Estética Facial',
      status: 'ACTIVE'
    },
    {
      name: 'Massagem Relaxante',
      description: 'Massagem corporal para alívio do stress e tensões musculares',
      duration: 90,
      price: 120.00,
      category: 'Massoterapia',
      status: 'ACTIVE'
    },
    {
      name: 'Tratamento Anti-idade',
      description: 'Procedimento completo para redução de rugas e linhas de expressão',
      duration: 120,
      price: 200.00,
      category: 'Estética Facial',
      status: 'ACTIVE'
    },
    {
      name: 'Drenagem Linfática',
      description: 'Técnica de massagem para redução de inchaços e toxinas',
      duration: 75,
      price: 90.00,
      category: 'Massoterapia',
      status: 'ACTIVE'
    },
    {
      name: 'Peeling Químico',
      description: 'Renovação da pele através de ácidos específicos',
      duration: 45,
      price: 150.00,
      category: 'Estética Facial',
      status: 'ACTIVE'
    }
  ];

  for (const serviceData of services) {
    try {
      const service = await prisma.service.create({
        data: {
          ...serviceData,
          companyId
        }
      });
      
      console.log(`  ✓ Serviço criado: ${service.name} - R$ ${service.price}`);
    } catch (error) {
      console.log(`  ⚠️  Serviço ${serviceData.name} pode já existir, ignorando...`);
    }
  }
}

async function seedProfessionals(companyId) {
  console.log('\n👩‍⚕️ Criando profissionais de exemplo...');
  
  // Obter usuários existentes para associar
  const users = await prisma.user.findMany({
    where: { companyId },
    take: 3
  });
  
  if (users.length === 0) {
    console.log('  ⚠️  Nenhum usuário encontrado para associar aos profissionais');
    return;
  }

  const professionals = [
    {
      userId: users[0].id,
      name: users[0].firstName + ' ' + users[0].lastName,
      email: users[0].email,
      phone: '11999001122',
      specialties: ['Estética Facial', 'Limpeza de Pele'],
      status: 'ACTIVE',
      hourlyRate: 80.00,
      commission: 30.00
    }
  ];

  if (users.length > 1) {
    professionals.push({
      userId: users[1].id,
      name: users[1].firstName + ' ' + users[1].lastName,
      email: users[1].email,
      phone: '11888001133',
      specialties: ['Massoterapia', 'Drenagem Linfática'],
      status: 'ACTIVE',
      hourlyRate: 90.00,
      commission: 35.00
    });
  }

  for (const professionalData of professionals) {
    try {
      const professional = await prisma.professional.create({
        data: {
          ...professionalData,
          companyId
        }
      });
      
      console.log(`  ✓ Profissional criado: ${professional.name}`);
    } catch (error) {
      console.log(`  ⚠️  Profissional pode já existir, ignorando...`);
    }
  }
}

async function seedMessageTemplates(companyId) {
  console.log('\n📱 Criando templates de mensagem...');
  
  const templates = [
    {
      templateName: 'appointment_confirmation',
      templateType: 'confirmation',
      channel: 'whatsapp',
      subject: null,
      content: `Olá {{customer_name}}! 🌟

Seu agendamento foi confirmado:
📅 Data: {{date}}
🕐 Horário: {{time}}
💼 Serviço: {{service_name}}
👩‍⚕️ Profissional: {{professional_name}}

Estamos ansiosos para atendê-lo(a)!
Qualquer dúvida, entre em contato.`,
      active: true,
      isDefault: true
    },
    {
      templateName: 'appointment_reminder',
      templateType: 'reminder',
      channel: 'whatsapp',
      subject: null,
      content: `Oi {{customer_name}}! 😊

Lembrando do seu agendamento:
📅 Amanhã às {{time}}
💼 {{service_name}}

Nos vemos em breve!
Para cancelar ou reagendar, entre em contato.`,
      active: true,
      isDefault: true
    },
    {
      templateName: 'appointment_cancellation',
      templateType: 'cancellation',
      channel: 'whatsapp',
      subject: null,
      content: `Olá {{customer_name}},

Seu agendamento do dia {{date}} às {{time}} foi cancelado conforme solicitado.

Para reagendar, entre em contato conosco.
Obrigado pela compreensão! 💙`,
      active: true,
      isDefault: true
    }
  ];

  for (const templateData of templates) {
    try {
      const template = await prisma.messageTemplate.create({
        data: {
          ...templateData,
          companyId
        }
      });
      
      console.log(`  ✓ Template criado: ${template.templateName}`);
    } catch (error) {
      console.log(`  ⚠️  Template ${templateData.templateName} pode já existir, ignorando...`);
    }
  }
}

async function seedBusinessConfig(companyId) {
  console.log('\n⚙️  Criando configurações de negócio...');
  
  try {
    // Configuração geral do agendamento
    const config = await prisma.agendamentoConfig.create({
      data: {
        companyId,
        whatsappEnabled: false,
        smsEnabled: false,
        emailEnabled: true,
        autoConfirmationEnabled: false,
        maxAdvanceBookingDays: 60,
        minAdvanceBookingHours: 2,
        allowSameDayBooking: true,
        reminderDefaultHours: 24,
        defaultSlotDuration: 30,
        calendarViewDefault: 'week'
      }
    });
    
    console.log(`  ✓ Configuração do agendamento criada`);
    
    // Horários de funcionamento (Segunda a Sexta)
    const businessHours = [
      { dayOfWeek: 1, startTime: '08:00:00', endTime: '18:00:00', lunchStart: '12:00:00', lunchEnd: '13:00:00' }, // Segunda
      { dayOfWeek: 2, startTime: '08:00:00', endTime: '18:00:00', lunchStart: '12:00:00', lunchEnd: '13:00:00' }, // Terça
      { dayOfWeek: 3, startTime: '08:00:00', endTime: '18:00:00', lunchStart: '12:00:00', lunchEnd: '13:00:00' }, // Quarta
      { dayOfWeek: 4, startTime: '08:00:00', endTime: '18:00:00', lunchStart: '12:00:00', lunchEnd: '13:00:00' }, // Quinta
      { dayOfWeek: 5, startTime: '08:00:00', endTime: '17:00:00', lunchStart: '12:00:00', lunchEnd: '13:00:00' }, // Sexta
      { dayOfWeek: 6, isOpen: false }, // Sábado fechado
      { dayOfWeek: 0, isOpen: false }  // Domingo fechado
    ];

    for (const hour of businessHours) {
      await prisma.businessHour.create({
        data: {
          companyId,
          ...hour
        }
      });
    }
    
    console.log(`  ✓ Horários de funcionamento configurados`);
    
  } catch (error) {
    console.log(`  ⚠️  Configurações podem já existir, ignorando...`);
  }
}

async function seedAppointments(companyId) {
  console.log('\n📅 Criando agendamentos de exemplo...');
  
  try {
    // Buscar dados necessários
    const customers = await prisma.customer.findMany({ where: { companyId }, take: 3 });
    const services = await prisma.service.findMany({ where: { companyId }, take: 2 });
    const professionals = await prisma.professional.findMany({ where: { companyId }, take: 1 });
    
    if (customers.length === 0 || services.length === 0 || professionals.length === 0) {
      console.log('  ⚠️  Dados insuficientes para criar agendamentos');
      return;
    }

    // Criar alguns agendamentos para a próxima semana
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointments = [
      {
        customerId: customers[0].id,
        professionalId: professionals[0].id,
        serviceId: services[0].id,
        appointmentDate: tomorrow,
        appointmentTime: '09:00:00',
        appointmentEndTime: '10:00:00',
        status: 'scheduled',
        estimatedPrice: services[0].price
      }
    ];

    if (customers.length > 1 && services.length > 1) {
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      appointments.push({
        customerId: customers[1].id,
        professionalId: professionals[0].id,
        serviceId: services[1].id,
        appointmentDate: dayAfterTomorrow,
        appointmentTime: '14:00:00',
        appointmentEndTime: '15:30:00',
        status: 'scheduled',
        estimatedPrice: services[1].price
      });
    }

    for (const appointmentData of appointments) {
      const appointment = await prisma.appointment.create({
        data: {
          ...appointmentData,
          companyId
        }
      });
      
      console.log(`  ✓ Agendamento criado para ${appointmentData.appointmentDate.toLocaleDateString()}`);
    }
    
  } catch (error) {
    console.log(`  ⚠️  Erro ao criar agendamentos: ${error.message}`);
  }
}

// Executar o script
if (require.main === module) {
  main();
}

module.exports = { main };