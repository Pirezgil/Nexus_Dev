/**
 * Seed script para o módulo Agendamento
 * Popula banco com dados iniciais para desenvolvimento e testes
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Iniciando seed do módulo Agendamento...');

  // Company ID exemplo (deve existir no User Management)
  const COMPANY_ID = '550e8400-e29b-41d4-a716-446655440001';

  try {
    // 1. Configurações da empresa
    logger.info('Criando configurações da empresa...');
    await prisma.agendamentoConfig.upsert({
      where: { company_id: COMPANY_ID },
      update: {},
      create: {
        company_id: COMPANY_ID,
        whatsapp_enabled: false,
        sms_enabled: false,
        email_enabled: true,
        auto_confirmation_enabled: false,
        max_advance_booking_days: 60,
        min_advance_booking_hours: 2,
        allow_same_day_booking: true,
        reminder_default_hours: 24,
        default_slot_duration: 30,
        working_hours_start: new Date('1970-01-01T08:00:00Z'),
        working_hours_end: new Date('1970-01-01T18:00:00Z'),
        calendar_view_default: 'week'
      }
    });

    // 2. Horários comerciais (Segunda a Sexta: 8h às 18h, Sábado: 8h às 12h)
    logger.info('Criando horários comerciais...');
    const businessHoursData = [
      // Segunda a Sexta
      ...Array.from({ length: 5 }, (_, i) => ({
        company_id: COMPANY_ID,
        day_of_week: i + 1, // 1 = segunda, 5 = sexta
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T18:00:00Z'),
        lunch_start: new Date('1970-01-01T12:00:00Z'),
        lunch_end: new Date('1970-01-01T13:00:00Z'),
        slot_duration_minutes: 30,
        advance_booking_days: 60,
        same_day_booking: true
      })),
      // Sábado (meio período)
      {
        company_id: COMPANY_ID,
        day_of_week: 6,
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T12:00:00Z'),
        slot_duration_minutes: 30,
        advance_booking_days: 60,
        same_day_booking: true
      },
      // Domingo (fechado)
      {
        company_id: COMPANY_ID,
        day_of_week: 0,
        is_open: false,
        slot_duration_minutes: 30,
        advance_booking_days: 60,
        same_day_booking: true
      }
    ];

    for (const businessHour of businessHoursData) {
      await prisma.businessHour.upsert({
        where: {
          company_id_day_of_week: {
            company_id: COMPANY_ID,
            day_of_week: businessHour.day_of_week
          }
        },
        update: businessHour,
        create: businessHour
      });
    }

    // 3. Templates de mensagem padrão
    logger.info('Criando templates de mensagem...');
    const messageTemplates = [
      // WhatsApp Templates
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_confirmation',
        template_type: 'confirmation',
        channel: 'whatsapp',
        content: 'Olá {{customer_name}}! 👋\\n\\nSeu agendamento foi confirmado:\\n📅 Data: {{date}}\\n🕒 Horário: {{time}}\\n👨‍⚕️ Profissional: {{professional}}\\n🔧 Serviço: {{service}}\\n\\nNos vemos em breve! ✨',
        active: true,
        is_default: true
      },
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_reminder',
        template_type: 'reminder',
        channel: 'whatsapp',
        content: 'Oi {{customer_name}}! 📱\\n\\nLembrando que você tem agendamento:\\n📅 Amanhã ({{date}})\\n🕒 Às {{time}}\\n👨‍⚕️ Com {{professional}}\\n\\nTe esperamos! Até lá 🤗',
        active: true,
        is_default: true
      },
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_cancellation',
        template_type: 'cancellation',
        channel: 'whatsapp',
        content: 'Olá {{customer_name}},\\n\\nSeu agendamento do dia {{date}} às {{time}} foi cancelado.\\n\\nPara reagendar, entre em contato conosco! 📞',
        active: true,
        is_default: true
      },
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_reschedule',
        template_type: 'reschedule',
        channel: 'whatsapp',
        content: 'Oi {{customer_name}}! 🔄\\n\\nSeu agendamento foi reagendado:\\n\\n📅 Nova data: {{date}}\\n🕒 Novo horário: {{time}}\\n👨‍⚕️ Profissional: {{professional}}\\n\\nObrigado pela compreensão! ❤️',
        active: true,
        is_default: true
      },
      // Email Templates
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_confirmation',
        template_type: 'confirmation',
        channel: 'email',
        subject: 'Agendamento Confirmado - {{date}} às {{time}}',
        content: 'Olá {{customer_name}},\\n\\nSeu agendamento foi confirmado com sucesso:\\n\\nData: {{date}}\\nHorário: {{time}}\\nProfissional: {{professional}}\\nServiço: {{service}}\\n\\nObservações: {{notes}}\\n\\nAguardamos você!\\n\\nAtenciosamente,\\n{{company_name}}',
        active: true,
        is_default: true
      },
      {
        company_id: COMPANY_ID,
        template_name: 'appointment_reminder',
        template_type: 'reminder',
        channel: 'email',
        subject: 'Lembrete: Agendamento Amanhã - {{date}} às {{time}}',
        content: 'Olá {{customer_name}},\\n\\nEste é um lembrete sobre seu agendamento:\\n\\nData: {{date}}\\nHorário: {{time}}\\nProfissional: {{professional}}\\nServiço: {{service}}\\n\\nNos vemos em breve!\\n\\nAtenciosamente,\\n{{company_name}}',
        active: true,
        is_default: true
      }
    ];

    for (const template of messageTemplates) {
      await prisma.messageTemplate.upsert({
        where: {
          company_id_template_name_channel: {
            company_id: template.company_id,
            template_name: template.template_name,
            channel: template.channel
          }
        },
        update: template,
        create: template
      });
    }

    // 4. Bloqueios de exemplo (feriados nacionais)
    logger.info('Criando bloqueios de feriados...');
    const currentYear = new Date().getFullYear();
    const holidays = [
      { date: `${currentYear}-01-01`, title: 'Confraternização Universal' },
      { date: `${currentYear}-04-21`, title: 'Tiradentes' },
      { date: `${currentYear}-09-07`, title: 'Independência do Brasil' },
      { date: `${currentYear}-10-12`, title: 'Nossa Senhora Aparecida' },
      { date: `${currentYear}-11-02`, title: 'Finados' },
      { date: `${currentYear}-11-15`, title: 'Proclamação da República' },
      { date: `${currentYear}-12-25`, title: 'Natal' }
    ];

    for (const holiday of holidays) {
      const holidayDate = new Date(holiday.date);
      
      await prisma.scheduleBlock.upsert({
        where: {
          id: `holiday-${holiday.date}-${COMPANY_ID}`
        },
        update: {},
        create: {
          id: `holiday-${holiday.date}-${COMPANY_ID}`,
          company_id: COMPANY_ID,
          professional_id: null, // Bloqueia para todos
          start_date: holidayDate,
          end_date: holidayDate,
          start_time: null, // Dia todo
          end_time: null,
          block_type: 'holiday',
          title: holiday.title,
          description: 'Feriado nacional - Empresa fechada',
          is_recurring: false,
          active: true
        }
      });
    }

    // 5. Agendamentos de exemplo (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Criando agendamentos de exemplo...');
      
      // IDs de exemplo (devem existir nos outros módulos)
      const CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440002';
      const PROFESSIONAL_ID = '550e8400-e29b-41d4-a716-446655440003';
      const SERVICE_ID = '550e8400-e29b-41d4-a716-446655440004';
      const USER_ID = '550e8400-e29b-41d4-a716-446655440005';

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const sampleAppointments = [
        {
          company_id: COMPANY_ID,
          customer_id: CUSTOMER_ID,
          professional_id: PROFESSIONAL_ID,
          service_id: SERVICE_ID,
          appointment_date: tomorrow,
          appointment_time: new Date('1970-01-01T09:00:00Z'),
          appointment_end_time: new Date('1970-01-01T10:00:00Z'),
          timezone: 'America/Sao_Paulo',
          status: 'scheduled',
          notes: 'Cliente novo - primeira consulta',
          estimated_price: 150.00,
          send_confirmation: true,
          send_reminder: true,
          reminder_hours_before: 24,
          created_by: USER_ID
        },
        {
          company_id: COMPANY_ID,
          customer_id: CUSTOMER_ID,
          professional_id: PROFESSIONAL_ID,
          service_id: SERVICE_ID,
          appointment_date: tomorrow,
          appointment_time: new Date('1970-01-01T14:30:00Z'),
          appointment_end_time: new Date('1970-01-01T15:30:00Z'),
          timezone: 'America/Sao_Paulo',
          status: 'confirmed',
          notes: 'Retorno - revisão do tratamento',
          estimated_price: 120.00,
          send_confirmation: true,
          send_reminder: true,
          reminder_hours_before: 24,
          confirmed_at: new Date(),
          confirmed_by: 'customer',
          created_by: USER_ID
        }
      ];

      for (const appointment of sampleAppointments) {
        try {
          await prisma.appointment.create({
            data: appointment
          });
        } catch (error) {
          logger.warn('Erro ao criar agendamento de exemplo (pode ser devido a IDs não existentes nos outros módulos)');
        }
      }
    }

    logger.info('✅ Seed do módulo Agendamento concluído com sucesso!');

  } catch (error) {
    logger.error('❌ Erro durante o seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });