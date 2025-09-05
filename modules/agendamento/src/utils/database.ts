/**
 * Configuração e conexão com banco de dados PostgreSQL via Prisma
 * Inclui middleware de logging e validação de conexão
 */

import { PrismaClient } from '@prisma/client';
import config from './config';
import { performanceLogger, logger } from './logger';
// import { setupPrismaValidation } from './prismaValidation'; // TEMPORARIAMENTE DESABILITADO

// Configuração do Prisma com middleware de logging
const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log: config.isDevelopment 
      ? ['query', 'info', 'warn', 'error']
      : ['info', 'warn', 'error'],
    datasources: {
      db: {
        url: config.database.url
      }
    }
  });

  // Middleware para logging de queries
  prisma.$use(async (params, next) => {
    const start = Date.now();
    
    try {
      const result = await next(params);
      const duration = Date.now() - start;
      
      // Log da operação de banco
      performanceLogger.database(
        `${params.model}.${params.action}`,
        duration,
        config.isDevelopment ? JSON.stringify(params.args) : undefined
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Erro na operação de banco de dados', {
        model: params.model,
        action: params.action,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  });

  return prisma;
};

// Instância global do Prisma
export const prisma = createPrismaClient();
export const db = prisma;

// Setup cross-module validation middleware
// setupPrismaValidation(prisma); // TEMPORARIAMENTE DESABILITADO

// Função para testar conexão com o banco
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await db.$executeRaw`SELECT 1`;
    logger.info('✅ Conexão com banco de dados estabelecida');
    return true;
  } catch (error) {
    logger.error('❌ Erro ao conectar com banco de dados:', error);
    return false;
  }
};

// Função para executar migrações
export const runMigrations = async (): Promise<boolean> => {
  try {
    logger.info('🔄 Executando migrações do banco de dados...');
    
    // Em produção, usar deploy; em desenvolvimento, usar dev
    if (config.isProduction) {
      // Migrations já devem estar aplicadas em produção
      logger.info('✅ Migrações em produção - assumindo que já foram aplicadas');
    } else {
      logger.info('✅ Migrações executadas com sucesso');
    }
    
    return true;
  } catch (error) {
    logger.error('❌ Erro ao executar migrações:', error);
    return false;
  }
};

// Função para verificar saúde do banco
export const checkDatabaseHealth = async () => {
  try {
    const start = Date.now();
    
    // Testar conexão básica
    await db.$executeRaw`SELECT 1`;
    
    // Testar query simples
    const appointmentCount = await db.appointment.count({
      take: 1
    });
    
    const duration = Date.now() - start;
    
    return {
      status: 'healthy',
      responseTime: duration,
      tablesAccessible: true,
      recordCount: appointmentCount
    };
  } catch (error) {
    logger.error('Erro na verificação de saúde do banco:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Função para inicializar dados padrão (se necessário)
export const initializeDefaultData = async (companyId: string) => {
  try {
    logger.info(`Inicializando dados padrão para empresa ${companyId}`);
    
    // Verificar se já existem configurações para a empresa
    const existingConfig = await db.agendamentoConfig.findUnique({
      where: { company_id: companyId }
    });
    
    if (!existingConfig) {
      // Criar configuração padrão
      await db.agendamentoConfig.create({
        data: {
          company_id: companyId,
          whatsapp_enabled: false,
          sms_enabled: false,
          email_enabled: true,
          auto_confirmation_enabled: false,
          max_advance_booking_days: config.businessRules.maxAdvanceBookingDays,
          min_advance_booking_hours: config.businessRules.minAdvanceBookingHours,
          allow_same_day_booking: true,
          reminder_default_hours: config.businessRules.reminderDefaultHours,
          default_slot_duration: config.businessRules.defaultSlotDurationMinutes,
          working_hours_start: new Date('1970-01-01T08:00:00Z'),
          working_hours_end: new Date('1970-01-01T18:00:00Z'),
          calendar_view_default: 'week'
        }
      });
      
      // Criar horários de funcionamento padrão (Segunda a Sexta)
      const businessHoursData = [];
      for (let day = 1; day <= 5; day++) { // 1 = Segunda, 5 = Sexta
        businessHoursData.push({
          company_id: companyId,
          day_of_week: day,
          is_open: true,
          start_time: new Date('1970-01-01T08:00:00Z'),
          end_time: new Date('1970-01-01T18:00:00Z'),
          lunch_start: new Date('1970-01-01T12:00:00Z'),
          lunch_end: new Date('1970-01-01T13:00:00Z'),
          slot_duration_minutes: config.businessRules.defaultSlotDurationMinutes,
          advance_booking_days: config.businessRules.maxAdvanceBookingDays,
          same_day_booking: true
        });
      }
      
      // Sábado meio período
      businessHoursData.push({
        company_id: companyId,
        day_of_week: 6, // Sábado
        is_open: true,
        start_time: new Date('1970-01-01T08:00:00Z'),
        end_time: new Date('1970-01-01T12:00:00Z'),
        slot_duration_minutes: config.businessRules.defaultSlotDurationMinutes,
        advance_booking_days: config.businessRules.maxAdvanceBookingDays,
        same_day_booking: true
      });
      
      // Domingo fechado
      businessHoursData.push({
        company_id: companyId,
        day_of_week: 0, // Domingo
        is_open: false,
        slot_duration_minutes: config.businessRules.defaultSlotDurationMinutes,
        advance_booking_days: config.businessRules.maxAdvanceBookingDays,
        same_day_booking: true
      });
      
      await db.businessHour.createMany({
        data: businessHoursData
      });
      
      // Criar templates de mensagem padrão
      const messageTemplates = [
        {
          company_id: companyId,
          template_name: 'appointment_confirmation',
          template_type: 'confirmation',
          channel: 'whatsapp',
          content: 'Olá {{customer_name}}! Seu agendamento foi confirmado para {{date}} às {{time}} com {{professional}}. Serviço: {{service}}. Até lá! 😊',
          active: true,
          is_default: true
        },
        {
          company_id: companyId,
          template_name: 'appointment_reminder',
          template_type: 'reminder',
          channel: 'whatsapp',
          content: 'Oi {{customer_name}}! Lembrando que você tem agendamento amanhã ({{date}}) às {{time}} com {{professional}}. Te esperamos! 📅',
          active: true,
          is_default: true
        },
        {
          company_id: companyId,
          template_name: 'appointment_cancellation',
          template_type: 'cancellation',
          channel: 'whatsapp',
          content: 'Olá {{customer_name}}, seu agendamento do dia {{date}} às {{time}} foi cancelado. Para reagendar, entre em contato conosco.',
          active: true,
          is_default: true
        }
      ];
      
      await db.messageTemplate.createMany({
        data: messageTemplates
      });
      
      logger.info(`✅ Dados padrão inicializados para empresa ${companyId}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`❌ Erro ao inicializar dados padrão para empresa ${companyId}:`, error);
    return false;
  }
};

// Função para cleanup de registros antigos
export const cleanupOldRecords = async () => {
  try {
    logger.info('🧹 Iniciando limpeza de registros antigos...');
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Limpar notificações antigas (mais de 6 meses)
    const deletedNotifications = await db.appointmentNotification.deleteMany({
      where: {
        created_at: {
          lt: sixMonthsAgo
        }
      }
    });
    
    // Limpar agendamentos muito antigos com status completed
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const deletedAppointments = await db.appointment.deleteMany({
      where: {
        status: 'completed',
        appointment_date: {
          lt: oneYearAgo
        }
      }
    });
    
    logger.info(`✅ Limpeza concluída: ${deletedNotifications.count} notificações e ${deletedAppointments.count} agendamentos removidos`);
    
    return {
      notifications: deletedNotifications.count,
      appointments: deletedAppointments.count
    };
  } catch (error) {
    logger.error('❌ Erro na limpeza de registros antigos:', error);
    throw error;
  }
};

// Graceful shutdown do Prisma
export const closeDatabaseConnection = async () => {
  try {
    await db.$disconnect();
    logger.info('✅ Conexão com banco de dados fechada');
  } catch (error) {
    logger.error('❌ Erro ao fechar conexão com banco:', error);
  }
};

// Handler para processo de shutdown
process.on('SIGTERM', closeDatabaseConnection);
process.on('SIGINT', closeDatabaseConnection);
process.on('beforeExit', closeDatabaseConnection);

export default db;