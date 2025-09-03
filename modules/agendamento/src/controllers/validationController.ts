/**
 * Validation Controller for Agendamento module
 * Provides endpoints for cross-module validation of Agendamento entities
 */

import { Request, Response } from 'express';
import { appointmentService } from '../services/appointmentService';
import { Logger } from '../utils/logger';
import { HTTP_HEADERS, getHeaderKey } from '../../../../../shared/constants/headers';

const logger = new Logger('ValidationController');

export class ValidationController {
  
  /**
   * Validate if an appointment exists
   * GET /api/appointments/:id/validate
   */
  static async validateAppointment(req: Request, res: Response) {
    try {
      const { id: appointmentId } = req.params;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          exists: false,
          error: 'Company ID is required in headers'
        });
      }

      logger.info(`Validating appointment ${appointmentId} for company ${companyId}`);

      const appointment = await appointmentService.getById(appointmentId, companyId);

      if (!appointment) {
        return res.status(404).json({
          exists: false,
          message: 'Appointment not found'
        });
      }

      res.json({
        exists: true,
        appointment: {
          id: appointment.id,
          company_id: appointment.company_id,
          customer_id: appointment.customer_id,
          professional_id: appointment.professional_id,
          service_id: appointment.service_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          appointment_end_time: appointment.appointment_end_time,
          status: appointment.status,
          notes: appointment.notes,
          estimated_price: appointment.estimated_price,
          created_at: appointment.created_at
        }
      });

    } catch (error: any) {
      logger.error(`Error validating appointment ${req.params.id}:`, error);
      res.status(500).json({
        exists: false,
        error: 'Internal server error during validation'
      });
    }
  }

  /**
   * Validate if an appointment exists and is in a specific status
   * GET /api/appointments/:id/validate-status?status=scheduled|confirmed|completed
   */
  static async validateAppointmentByStatus(req: Request, res: Response) {
    try {
      const { id: appointmentId } = req.params;
      const { status } = req.query;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          exists: false,
          error: 'Company ID is required in headers'
        });
      }

      if (!status) {
        return res.status(400).json({
          exists: false,
          error: 'Status query parameter is required'
        });
      }

      const appointment = await appointmentService.getById(appointmentId, companyId);

      if (!appointment) {
        return res.status(404).json({
          exists: false,
          message: 'Appointment not found'
        });
      }

      if (appointment.status !== status) {
        return res.json({
          exists: true,
          statusMatch: false,
          currentStatus: appointment.status,
          requestedStatus: status,
          message: `Appointment exists but status is ${appointment.status}, not ${status}`
        });
      }

      res.json({
        exists: true,
        statusMatch: true,
        appointment: {
          id: appointment.id,
          company_id: appointment.company_id,
          customer_id: appointment.customer_id,
          professional_id: appointment.professional_id,
          service_id: appointment.service_id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          status: appointment.status,
          estimated_price: appointment.estimated_price
        }
      });

    } catch (error: any) {
      logger.error(`Error validating appointment status ${req.params.id}:`, error);
      res.status(500).json({
        exists: false,
        error: 'Internal server error during validation'
      });
    }
  }

  /**
   * Validate if appointments exist for a customer
   * GET /api/appointments/customer/:customerId/validate
   */
  static async validateAppointmentsByCustomer(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          exists: false,
          error: 'Company ID is required in headers'
        });
      }

      logger.info(`Validating appointments for customer ${customerId} in company ${companyId}`);

      const appointments = await appointmentService.getByCustomer(customerId, companyId);

      res.json({
        exists: appointments.length > 0,
        count: appointments.length,
        appointments: appointments.map(apt => ({
          id: apt.id,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          status: apt.status,
          professional_id: apt.professional_id,
          service_id: apt.service_id
        }))
      });

    } catch (error: any) {
      logger.error(`Error validating appointments for customer ${req.params.customerId}:`, error);
      res.status(500).json({
        exists: false,
        error: 'Internal server error during validation'
      });
    }
  }

  /**
   * Validate if appointments exist for a professional
   * GET /api/appointments/professional/:professionalId/validate
   */
  static async validateAppointmentsByProfessional(req: Request, res: Response) {
    try {
      const { professionalId } = req.params;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          exists: false,
          error: 'Company ID is required in headers'
        });
      }

      logger.info(`Validating appointments for professional ${professionalId} in company ${companyId}`);

      const appointments = await appointmentService.getByProfessional(professionalId, companyId);

      res.json({
        exists: appointments.length > 0,
        count: appointments.length,
        appointments: appointments.map(apt => ({
          id: apt.id,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          status: apt.status,
          customer_id: apt.customer_id,
          service_id: apt.service_id
        }))
      });

    } catch (error: any) {
      logger.error(`Error validating appointments for professional ${req.params.professionalId}:`, error);
      res.status(500).json({
        exists: false,
        error: 'Internal server error during validation'
      });
    }
  }

  /**
   * Batch validate multiple appointments
   * POST /api/appointments/validate-batch
   * Body: { appointmentIds: string[] }
   */
  static async validateAppointmentsBatch(req: Request, res: Response) {
    try {
      const { appointmentIds } = req.body;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          error: 'Company ID is required in headers'
        });
      }

      if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({
          error: 'appointmentIds array is required and must not be empty'
        });
      }

      logger.info(`Batch validating ${appointmentIds.length} appointments for company ${companyId}`);

      const results: { [appointmentId: string]: any } = {};

      // Validate all appointments in parallel
      const promises = appointmentIds.map(async (appointmentId: string) => {
        try {
          const appointment = await appointmentService.getById(appointmentId, companyId);
          results[appointmentId] = {
            exists: !!appointment,
            appointment: appointment ? {
              id: appointment.id,
              customer_id: appointment.customer_id,
              professional_id: appointment.professional_id,
              service_id: appointment.service_id,
              appointment_date: appointment.appointment_date,
              appointment_time: appointment.appointment_time,
              status: appointment.status,
              company_id: appointment.company_id
            } : null
          };
        } catch (error) {
          results[appointmentId] = {
            exists: false,
            error: 'Validation failed'
          };
        }
      });

      await Promise.all(promises);

      res.json({
        success: true,
        results
      });

    } catch (error: any) {
      logger.error(`Error in batch appointment validation:`, error);
      res.status(500).json({
        error: 'Internal server error during batch validation'
      });
    }
  }

  /**
   * Check for appointment conflicts (time slot availability)
   * POST /api/appointments/validate-timeslot
   * Body: { professionalId, date, time, endTime, excludeId? }
   */
  static async validateTimeSlot(req: Request, res: Response) {
    try {
      const { professionalId, date, time, endTime, excludeId } = req.body;
      const companyId = req.headers[getHeaderKey(HTTP_HEADERS.COMPANY_ID)] as string;

      if (!companyId) {
        return res.status(400).json({
          available: false,
          error: 'Company ID is required in headers'
        });
      }

      if (!professionalId || !date || !time || !endTime) {
        return res.status(400).json({
          available: false,
          error: 'professionalId, date, time, and endTime are required'
        });
      }

      logger.info(`Validating time slot for professional ${professionalId} on ${date} from ${time} to ${endTime}`);

      const hasConflict = await appointmentService.hasTimeSlotConflict(
        professionalId,
        companyId,
        new Date(date),
        time,
        endTime,
        excludeId
      );

      res.json({
        available: !hasConflict,
        conflict: hasConflict,
        timeslot: {
          professionalId,
          date,
          time,
          endTime
        }
      });

    } catch (error: any) {
      logger.error(`Error validating time slot:`, error);
      res.status(500).json({
        available: false,
        error: 'Internal server error during time slot validation'
      });
    }
  }

  /**
   * Health check for validation endpoints
   * GET /api/validation/health
   */
  static async healthCheck(req: Request, res: Response) {
    res.json({
      module: 'agendamento',
      service: 'validation',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /api/appointments/:id/validate',
        'GET /api/appointments/:id/validate-status?status=xxx',
        'GET /api/appointments/customer/:customerId/validate',
        'GET /api/appointments/professional/:professionalId/validate',
        'POST /api/appointments/validate-batch',
        'POST /api/appointments/validate-timeslot'
      ]
    });
  }
}

export default ValidationController;