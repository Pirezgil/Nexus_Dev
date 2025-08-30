import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

/**
 * HTTP Client for Agendamento Module Integration
 */
export class AgendamentoClient {
  private readonly baseURL: string;
  private readonly timeout: number = 10000; // 10 seconds
  private readonly serviceKey: string;

  constructor() {
    this.baseURL = config.agendamentoUrl;
    this.serviceKey = process.env.INTERNAL_SERVICE_KEY || '';
  }

  /**
   * Get scheduled appointments for a professional on a specific date
   */
  async getScheduledAppointments(professionalId: string, date: string): Promise<Array<{
    id: string;
    time: string;
    duration: number;
    status: string;
  }>> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: Array<{
          id: string;
          time: string;
          duration: number;
          status: string;
        }>;
      }> = await axios.get(`${this.baseURL}/api/appointments`, {
        params: {
          professional_id: professionalId,
          date: date,
        },
        timeout: this.timeout,
        headers: {
          'X-Service-Key': this.serviceKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success && response.data.data) {
        logger.debug('Scheduled appointments retrieved from Agendamento', {
          professionalId,
          date,
          count: response.data.data.length,
        });
        
        return response.data.data;
      }

      return [];
    } catch (error: any) {
      logger.warn('Failed to get scheduled appointments from Agendamento', {
        professionalId,
        date,
        error: error.message,
        status: error.response?.status,
      });

      // Return empty array to allow graceful degradation
      return [];
    }
  }

  /**
   * Get all appointments for a professional within a date range
   */
  async getAppointmentsByDateRange(
    professionalId: string, 
    startDate: string, 
    endDate: string
  ): Promise<Array<{
    id: string;
    date: string;
    time: string;
    duration: number;
    status: string;
    serviceId: string;
    customerId: string;
  }>> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: Array<{
          id: string;
          date: string;
          time: string;
          duration: number;
          status: string;
          serviceId: string;
          customerId: string;
        }>;
      }> = await axios.get(`${this.baseURL}/api/appointments/range`, {
        params: {
          professional_id: professionalId,
          start_date: startDate,
          end_date: endDate,
        },
        timeout: this.timeout,
        headers: {
          'X-Service-Key': this.serviceKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success && response.data.data) {
        logger.debug('Appointments by date range retrieved from Agendamento', {
          professionalId,
          startDate,
          endDate,
          count: response.data.data.length,
        });
        
        return response.data.data;
      }

      return [];
    } catch (error: any) {
      logger.warn('Failed to get appointments by date range from Agendamento', {
        professionalId,
        startDate,
        endDate,
        error: error.message,
        status: error.response?.status,
      });

      return [];
    }
  }

  /**
   * Mark appointment as completed in Agendamento module
   */
  async markAppointmentAsCompleted(appointmentId: string): Promise<boolean> {
    try {
      const response: AxiosResponse<{
        success: boolean;
      }> = await axios.put(
        `${this.baseURL}/api/appointments/${appointmentId}/status`,
        { status: 'COMPLETED' },
        {
          timeout: this.timeout,
          headers: {
            'X-Service-Key': this.serviceKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        logger.info('Appointment marked as completed in Agendamento', {
          appointmentId,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to mark appointment as completed in Agendamento', {
        appointmentId,
        error: error.message,
        status: error.response?.status,
      });

      return false;
    }
  }

  /**
   * Get appointment details from Agendamento
   */
  async getAppointmentDetails(appointmentId: string): Promise<{
    id: string;
    customerId: string;
    professionalId: string;
    serviceId: string;
    date: string;
    time: string;
    duration: number;
    status: string;
    notes?: string;
  } | null> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          id: string;
          customerId: string;
          professionalId: string;
          serviceId: string;
          date: string;
          time: string;
          duration: number;
          status: string;
          notes?: string;
        };
      }> = await axios.get(`${this.baseURL}/api/appointments/${appointmentId}`, {
        timeout: this.timeout,
        headers: {
          'X-Service-Key': this.serviceKey,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success && response.data.data) {
        logger.debug('Appointment details retrieved from Agendamento', {
          appointmentId,
        });
        
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      logger.warn('Failed to get appointment details from Agendamento', {
        appointmentId,
        error: error.message,
        status: error.response?.status,
      });

      return null;
    }
  }

  /**
   * Test connectivity with Agendamento module
   */
  async testConnectivity(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
        headers: {
          'X-Service-Key': this.serviceKey,
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        logger.debug('Agendamento connectivity test successful', { responseTime });
        
        return {
          status: 'healthy',
          responseTime,
        };
      }

      return {
        status: 'unhealthy',
        error: `Unexpected status code: ${response.status}`,
      };
    } catch (error: any) {
      logger.warn('Agendamento connectivity test failed', {
        error: error.message,
      });

      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Create notification for appointment changes
   */
  async notifyAppointmentChange(appointmentId: string, changeType: 'completed' | 'cancelled' | 'rescheduled', details: any): Promise<boolean> {
    try {
      const response: AxiosResponse<{
        success: boolean;
      }> = await axios.post(
        `${this.baseURL}/api/appointments/${appointmentId}/notify`,
        {
          changeType,
          details,
          source: 'services',
        },
        {
          timeout: this.timeout,
          headers: {
            'X-Service-Key': this.serviceKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        logger.info('Appointment change notification sent to Agendamento', {
          appointmentId,
          changeType,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.warn('Failed to send appointment change notification to Agendamento', {
        appointmentId,
        changeType,
        error: error.message,
        status: error.response?.status,
      });

      return false;
    }
  }
}

export const agendamentoClient = new AgendamentoClient();