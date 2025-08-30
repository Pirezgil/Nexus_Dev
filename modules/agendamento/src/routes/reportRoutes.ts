/**
 * Rotas para relatórios e estatísticas
 * Endpoints para geração de relatórios de agendamentos
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, ApiResponse, ErrorCode } from '../types';
import { appointmentService } from '../services/appointmentService';
import { calendarService } from '../services/calendarService';
import { logger } from '../utils/logger';

const router = Router();

// Schema de validação para relatórios
const reportQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD'),
  professional_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional()
});

// GET /reports/monthly - Relatório mensal de agendamentos
router.get('/monthly', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = reportQuerySchema.parse(req.query);

    const stats = await calendarService.getCalendarStats(
      user.company_id,
      new Date(query.start_date),
      new Date(query.end_date)
    );

    const response: ApiResponse = {
      success: true,
      data: {
        period: stats.period,
        summary: stats.totals,
        by_status: stats.by_status,
        by_professional: stats.by_professional
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('Erro ao gerar relatório mensal:', error);

    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Dados inválidos',
          details: error.errors
        }
      };
      res.status(400).json(response);
      return;
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      }
    };
    res.status(500).json(response);
  }
});

// GET /reports/no-shows - Relatório de faltas
router.get('/no-shows', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = reportQuerySchema.parse(req.query);

    // Buscar agendamentos com no-show no período
    const noShowAppointments = await appointmentService.getAppointments({
      company_id: user.company_id,
      status: 'no_show',
      date_from: query.start_date,
      date_to: query.end_date,
      professional_id: query.professional_id,
      limit: 1000 // Limit alto para relatório
    });

    // Agrupar por cliente
    const byCustomer = noShowAppointments.appointments.reduce((acc: any, appointment: any) => {
      const customerId = appointment.customer.id;
      if (!acc[customerId]) {
        acc[customerId] = {
          customer_id: customerId,
          customer_name: appointment.customer.name,
          phone: appointment.customer.phone,
          no_shows: 0,
          last_no_show: null
        };
      }
      acc[customerId].no_shows++;
      if (!acc[customerId].last_no_show || appointment.appointment_date > acc[customerId].last_no_show) {
        acc[customerId].last_no_show = appointment.appointment_date;
      }
      return acc;
    }, {});

    const summary = {
      total_no_shows: noShowAppointments.summary.total_appointments,
      no_show_rate: noShowAppointments.summary.total_appointments > 0 
        ? Math.round((noShowAppointments.summary.by_status.no_show || 0) / noShowAppointments.summary.total_appointments * 100)
        : 0,
      revenue_lost: noShowAppointments.appointments
        .filter((apt: any) => apt.estimated_price)
        .reduce((sum: number, apt: any) => sum + apt.estimated_price, 0)
    };

    const response: ApiResponse = {
      success: true,
      data: {
        period: {
          start_date: query.start_date,
          end_date: query.end_date
        },
        summary,
        by_customer: Object.values(byCustomer)
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('Erro ao gerar relatório de faltas:', error);

    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Dados inválidos',
          details: error.errors
        }
      };
      res.status(400).json(response);
      return;
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      }
    };
    res.status(500).json(response);
  }
});

// GET /reports/occupancy - Relatório de taxa de ocupação
router.get('/occupancy', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = reportQuerySchema.parse(req.query);

    // TODO: Implementar cálculo de taxa de ocupação
    // Precisa considerar horários comerciais vs agendamentos realizados

    const response: ApiResponse = {
      success: true,
      data: {
        period: {
          start_date: query.start_date,
          end_date: query.end_date
        },
        occupancy_rate: 0, // Placeholder
        available_hours: 0, // Placeholder
        booked_hours: 0, // Placeholder
        by_professional: [], // Placeholder
        message: 'Relatório de ocupação em desenvolvimento'
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('Erro ao gerar relatório de ocupação:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      }
    };
    res.status(500).json(response);
  }
});

// GET /reports/revenue - Relatório de faturamento
router.get('/revenue', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const query = reportQuerySchema.parse(req.query);

    const appointments = await appointmentService.getAppointments({
      company_id: user.company_id,
      date_from: query.start_date,
      date_to: query.end_date,
      professional_id: query.professional_id,
      limit: 1000 // Limit alto para relatório
    });

    // Calcular faturamento apenas dos agendamentos concluídos
    const completedAppointments = appointments.appointments.filter(
      (apt: any) => apt.status === 'completed' && apt.estimated_price
    );

    const totalRevenue = completedAppointments.reduce(
      (sum: number, apt: any) => sum + apt.estimated_price, 0
    );

    // Agrupar por profissional
    const byProfessional = completedAppointments.reduce((acc: any, appointment: any) => {
      const profId = appointment.professional.id;
      if (!acc[profId]) {
        acc[profId] = {
          professional_id: profId,
          professional_name: appointment.professional.name,
          appointments: 0,
          revenue: 0
        };
      }
      acc[profId].appointments++;
      acc[profId].revenue += appointment.estimated_price;
      return acc;
    }, {});

    // Agrupar por serviço
    const byService = completedAppointments.reduce((acc: any, appointment: any) => {
      const serviceId = appointment.service.id;
      if (!acc[serviceId]) {
        acc[serviceId] = {
          service_id: serviceId,
          service_name: appointment.service.name,
          appointments: 0,
          revenue: 0
        };
      }
      acc[serviceId].appointments++;
      acc[serviceId].revenue += appointment.estimated_price;
      return acc;
    }, {});

    const response: ApiResponse = {
      success: true,
      data: {
        period: {
          start_date: query.start_date,
          end_date: query.end_date
        },
        summary: {
          total_appointments: completedAppointments.length,
          total_revenue: totalRevenue,
          average_ticket: completedAppointments.length > 0 
            ? Math.round(totalRevenue / completedAppointments.length * 100) / 100
            : 0
        },
        by_professional: Object.values(byProfessional),
        by_service: Object.values(byService)
      }
    };

    res.status(200).json(response);

  } catch (error) {
    logger.error('Erro ao gerar relatório de faturamento:', error);

    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Dados inválidos',
          details: error.errors
        }
      };
      res.status(400).json(response);
      return;
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
      }
    };
    res.status(500).json(response);
  }
});

export default router;