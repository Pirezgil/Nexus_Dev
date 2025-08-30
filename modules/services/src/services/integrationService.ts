import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { cacheService } from '../utils/redis';
import { config } from '../utils/config';
import { CRMCustomer, CRMNote, UserProfile, ServiceError } from '../types';

export class IntegrationService {
  private readonly cacheTTL = 300; // 5 minutes
  private readonly requestTimeout = 10000; // 10 seconds

  /**
   * Get customer from CRM module
   */
  async getCustomerFromCRM(customerId: string): Promise<CRMCustomer | null> {
    try {
      const cacheKey = `crm_customer:${customerId}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<CRMCustomer>(cacheKey);
      if (cached) {
        logger.debug('Customer retrieved from cache', { customerId });
        return cached;
      }

      // Make request to CRM service
      const response: AxiosResponse<{ success: boolean; data: CRMCustomer }> = await axios.get(
        `${config.crmUrl}/api/customers/${customerId}`,
        {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
          },
        }
      );

      if (response.data.success && response.data.data) {
        const customer = response.data.data;
        
        // Cache the result
        await cacheService.setJSON(cacheKey, customer, this.cacheTTL);
        
        logger.debug('Customer retrieved from CRM', { 
          customerId,
          customerName: customer.name,
        });
        
        return customer;
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get customer from CRM', {
        customerId,
        error: error.message,
        status: error.response?.status,
      });

      // Return null on error to allow graceful degradation
      return null;
    }
  }

  /**
   * Search customers in CRM module
   */
  async searchCustomersInCRM(
    query: string,
    limit: number = 10
  ): Promise<CRMCustomer[]> {
    try {
      const cacheKey = `crm_search:${query}:${limit}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<CRMCustomer[]>(cacheKey);
      if (cached) {
        logger.debug('Customer search results retrieved from cache', { query, limit });
        return cached;
      }

      // Make request to CRM service
      const response: AxiosResponse<{ success: boolean; data: CRMCustomer[] }> = await axios.get(
        `${config.crmUrl}/api/customers/search`,
        {
          params: { q: query, limit },
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
          },
        }
      );

      if (response.data.success && response.data.data) {
        const customers = response.data.data;
        
        // Cache the result for shorter time (search results change frequently)
        await cacheService.setJSON(cacheKey, customers, 60); // 1 minute cache
        
        logger.debug('Customer search completed', { 
          query,
          limit,
          resultCount: customers.length,
        });
        
        return customers;
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to search customers in CRM', {
        query,
        limit,
        error: error.message,
        status: error.response?.status,
      });

      // Return empty array on error
      return [];
    }
  }

  /**
   * Create note in CRM module
   */
  async createNoteInCRM(customerId: string, note: CRMNote): Promise<boolean> {
    try {
      // Make request to CRM service
      const response: AxiosResponse<{ success: boolean }> = await axios.post(
        `${config.crmUrl}/api/customers/${customerId}/notes`,
        note,
        {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
          },
        }
      );

      if (response.data.success) {
        // Clear customer cache to ensure fresh data on next fetch
        await cacheService.clearCachePattern(`crm_customer:${customerId}`);
        
        logger.info('Note created in CRM successfully', {
          customerId,
          noteType: note.type,
        });
        
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to create note in CRM', {
        customerId,
        note,
        error: error.message,
        status: error.response?.status,
      });

      return false;
    }
  }

  /**
   * Validate user with User Management module
   */
  async validateUser(token: string): Promise<UserProfile | null> {
    try {
      const cacheKey = `user_validation:${token}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<UserProfile>(cacheKey);
      if (cached) {
        logger.debug('User validation retrieved from cache');
        return cached;
      }

      // Make request to User Management service
      const response: AxiosResponse<{ success: boolean; data: UserProfile }> = await axios.get(
        `${config.userManagementUrl}/api/auth/validate`,
        {
          timeout: this.requestTimeout,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.data) {
        const user = response.data.data;
        
        // Cache the result for shorter time (user data can change)
        await cacheService.setJSON(cacheKey, user, 600); // 10 minutes cache
        
        logger.debug('User validated successfully', { 
          userId: user.id,
          email: user.email,
        });
        
        return user;
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to validate user', {
        error: error.message,
        status: error.response?.status,
      });

      return null;
    }
  }

  /**
   * Get user profile from User Management module
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const cacheKey = `user_profile:${userId}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<UserProfile>(cacheKey);
      if (cached) {
        logger.debug('User profile retrieved from cache', { userId });
        return cached;
      }

      // Make request to User Management service
      const response: AxiosResponse<{ success: boolean; data: UserProfile }> = await axios.get(
        `${config.userManagementUrl}/api/users/${userId}`,
        {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
          },
        }
      );

      if (response.data.success && response.data.data) {
        const user = response.data.data;
        
        // Cache the result
        await cacheService.setJSON(cacheKey, user, this.cacheTTL);
        
        logger.debug('User profile retrieved successfully', { 
          userId,
          email: user.email,
        });
        
        return user;
      }

      return null;
    } catch (error: any) {
      logger.error('Failed to get user profile', {
        userId,
        error: error.message,
        status: error.response?.status,
      });

      return null;
    }
  }

  /**
   * Notify CRM about service completion
   */
  async notifyCRMServiceCompleted(
    customerId: string,
    appointmentData: {
      appointmentId: string;
      serviceName: string;
      professionalName: string;
      completionDate: Date;
      totalAmount: number;
      notes?: string;
    }
  ): Promise<boolean> {
    try {
      const note: CRMNote = {
        customerId,
        content: `Service completed: ${appointmentData.serviceName} with ${appointmentData.professionalName}. Amount: $${appointmentData.totalAmount}. ${appointmentData.notes ? `Notes: ${appointmentData.notes}` : ''}`,
        type: 'service',
        metadata: {
          appointmentId: appointmentData.appointmentId,
          serviceName: appointmentData.serviceName,
          professionalName: appointmentData.professionalName,
          completionDate: appointmentData.completionDate.toISOString(),
          totalAmount: appointmentData.totalAmount,
        },
      };

      const result = await this.createNoteInCRM(customerId, note);
      
      logger.info('CRM notification sent for service completion', {
        customerId,
        appointmentId: appointmentData.appointmentId,
        success: result,
      });

      return result;
    } catch (error) {
      logger.error('Failed to notify CRM about service completion', {
        customerId,
        appointmentData,
        error,
      });

      return false;
    }
  }

  /**
   * Sync professional data with User Management
   */
  async syncProfessionalWithUserManagement(
    professionalId: string,
    userId: string,
    professionalData: {
      name: string;
      email: string;
      phone?: string;
      specialties: string[];
    }
  ): Promise<boolean> {
    try {
      // This would update the user profile in User Management with professional-specific data
      const response: AxiosResponse<{ success: boolean }> = await axios.put(
        `${config.userManagementUrl}/api/users/${userId}/professional-profile`,
        {
          professionalId,
          specialties: professionalData.specialties,
          phone: professionalData.phone,
        },
        {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
          },
        }
      );

      if (response.data.success) {
        // Clear user cache
        await cacheService.clearCachePattern(`user_profile:${userId}`);
        
        logger.info('Professional data synced with User Management', {
          professionalId,
          userId,
        });
        
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to sync professional with User Management', {
        professionalId,
        userId,
        error: error.message,
        status: error.response?.status,
      });

      // Non-critical error - return true to not block the main operation
      return true;
    }
  }

  /**
   * Get service health status from other modules
   */
  async getModuleHealthStatus(): Promise<{
    userManagement: { status: 'healthy' | 'unhealthy'; responseTime?: number };
    crm: { status: 'healthy' | 'unhealthy'; responseTime?: number };
  }> {
    const results = {
      userManagement: { status: 'unhealthy' as const, responseTime: undefined as number | undefined },
      crm: { status: 'unhealthy' as const, responseTime: undefined as number | undefined },
    };

    // Test User Management
    try {
      const startTime = Date.now();
      const response = await axios.get(`${config.userManagementUrl}/health`, {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        results.userManagement = {
          status: 'healthy',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.warn('User Management health check failed', { error });
    }

    // Test CRM
    try {
      const startTime = Date.now();
      const response = await axios.get(`${config.crmUrl}/health`, {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        results.crm = {
          status: 'healthy',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.warn('CRM health check failed', { error });
    }

    return results;
  }

  /**
   * Batch update customer data in CRM
   */
  async batchUpdateCustomerData(
    updates: Array<{
      customerId: string;
      appointmentData: {
        appointmentId: string;
        serviceName: string;
        professionalName: string;
        totalAmount: number;
        completionDate: Date;
      };
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        const result = await this.notifyCRMServiceCompleted(
          update.customerId,
          update.appointmentData
        );
        
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        logger.warn('Batch update failed for customer', {
          customerId: update.customerId,
          appointmentId: update.appointmentData.appointmentId,
          error,
        });
      }
    }

    logger.info('Batch customer data update completed', {
      total: updates.length,
      success,
      failed,
    });

    return { success, failed };
  }

  /**
   * Clear integration caches
   */
  async clearIntegrationCaches(pattern?: string): Promise<number> {
    try {
      const patterns = pattern ? [pattern] : [
        'crm_customer:*',
        'crm_search:*',
        'user_profile:*',
        'user_validation:*',
      ];

      let totalCleared = 0;
      for (const p of patterns) {
        const cleared = await cacheService.clearCachePattern(p);
        totalCleared += cleared;
      }

      logger.info('Integration caches cleared', {
        patterns,
        totalCleared,
      });

      return totalCleared;
    } catch (error) {
      logger.error('Failed to clear integration caches', { error });
      return 0;
    }
  }

  // ========================================
  // CRITICAL INTEGRATION METHODS FOR AGENDAMENTO
  // ========================================

  /**
   * Get services list formatted for Agendamento module
   */
  async getServicesForAgendamento(companyId: string): Promise<Array<{
    id: string;
    name: string;
    duration: number;
    price: number;
    category: string | null;
  }>> {
    try {
      const cacheKey = `agendamento_services:${companyId}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<any[]>(cacheKey);
      if (cached) {
        logger.debug('Services for Agendamento retrieved from cache', { companyId });
        return cached;
      }

      // Import serviceService dynamically to avoid circular dependency
      const { serviceService } = await import('./serviceService');

      // Get active services with pagination
      const result = await serviceService.getServices(
        { companyId, status: 'ACTIVE' },
        { page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }
      );

      const services = result.data?.map(service => ({
        id: service.id,
        name: service.name,
        duration: service.duration,
        price: parseFloat(service.price.toString()),
        category: service.category,
      })) || [];

      // Cache for 5 minutes
      await cacheService.setJSON(cacheKey, services, 300);

      logger.debug('Services formatted for Agendamento', { 
        companyId,
        count: services.length,
      });

      return services;
    } catch (error: any) {
      logger.error('Failed to get services for Agendamento', {
        companyId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get professionals list formatted for Agendamento module
   */
  async getProfessionalsForAgendamento(
    companyId: string,
    serviceId?: string
  ): Promise<Array<{
    id: string;
    name: string;
    specialties: string[];
    status: string;
  }>> {
    try {
      const cacheKey = `agendamento_professionals:${companyId}:${serviceId || 'all'}`;
      
      // Try cache first
      const cached = await cacheService.getJSON<any[]>(cacheKey);
      if (cached) {
        logger.debug('Professionals for Agendamento retrieved from cache', { 
          companyId, 
          serviceId,
        });
        return cached;
      }

      // Import professionalService dynamically to avoid circular dependency
      const { professionalService } = await import('./professionalService');

      // Get active professionals
      const result = await professionalService.getProfessionals(
        { companyId, status: 'ACTIVE' },
        { page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }
      );

      let professionals = result.data?.map(professional => ({
        id: professional.id,
        name: professional.name,
        specialties: professional.specialties,
        status: professional.status,
      })) || [];

      // If serviceId is provided, filter professionals who can perform this service
      // This would require a professional_services junction table in a full implementation
      // For now, we'll return all active professionals

      // Cache for 5 minutes
      await cacheService.setJSON(cacheKey, professionals, 300);

      logger.debug('Professionals formatted for Agendamento', { 
        companyId,
        serviceId,
        count: professionals.length,
      });

      return professionals;
    } catch (error: any) {
      logger.error('Failed to get professionals for Agendamento', {
        companyId,
        serviceId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get professional availability for a specific date and service
   */
  async getProfessionalAvailability(
    professionalId: string,
    companyId: string,
    date: string,
    serviceId: string
  ): Promise<{
    availableSlots: string[];
    workingHours: { start: string; end: string } | null;
    bookedSlots: string[];
  }> {
    try {
      const cacheKey = `professional_availability:${professionalId}:${date}:${serviceId}`;
      
      // Try cache first (short cache for availability)
      const cached = await cacheService.getJSON<any>(cacheKey);
      if (cached) {
        logger.debug('Professional availability retrieved from cache', {
          professionalId,
          date,
          serviceId,
        });
        return cached;
      }

      // Import services dynamically
      const { professionalService } = await import('./professionalService');
      const { serviceService } = await import('./serviceService');

      // Get professional data
      const professional = await professionalService.getProfessionalById(professionalId, companyId);
      if (!professional) {
        throw new Error('Professional not found');
      }

      // Get service data
      const service = await serviceService.getServiceById(serviceId, companyId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Parse the date
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.toLocaleDateString('en', { weekday: 'lowercase' });

      // Extract working hours from workSchedule
      let workingHours: { start: string; end: string } | null = null;
      
      if (professional.workSchedule && typeof professional.workSchedule === 'object') {
        const schedule = professional.workSchedule as any;
        if (schedule[dayOfWeek] && !schedule[dayOfWeek].disabled) {
          workingHours = {
            start: schedule[dayOfWeek].start || '09:00',
            end: schedule[dayOfWeek].end || '17:00',
          };
        }
      }

      // If no working hours for this day, return empty availability
      if (!workingHours) {
        const result = {
          availableSlots: [],
          workingHours: null,
          bookedSlots: [],
        };
        
        // Cache for 1 hour
        await cacheService.setJSON(cacheKey, result, 3600);
        return result;
      }

      // Generate time slots based on service duration and working hours
      const availableSlots = this.generateTimeSlots(
        workingHours.start,
        workingHours.end,
        service.duration
      );

      // Get booked slots from appointments (this would integrate with Agendamento module in a full implementation)
      const bookedSlots = await this.getBookedSlots(professionalId, date);

      // Remove booked slots from available slots
      const finalAvailableSlots = availableSlots.filter(slot => !bookedSlots.includes(slot));

      const result = {
        availableSlots: finalAvailableSlots,
        workingHours,
        bookedSlots,
      };

      // Cache for 30 minutes (availability changes frequently)
      await cacheService.setJSON(cacheKey, result, 1800);

      logger.debug('Professional availability calculated', {
        professionalId,
        date,
        serviceId,
        workingHours,
        totalSlots: availableSlots.length,
        bookedSlots: bookedSlots.length,
        availableSlots: finalAvailableSlots.length,
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to get professional availability', {
        professionalId,
        companyId,
        date,
        serviceId,
        error: error.message,
      });

      // Return empty availability on error
      return {
        availableSlots: [],
        workingHours: null,
        bookedSlots: [],
      };
    }
  }

  /**
   * Complete appointment from Agendamento module callback
   */
  async completeAppointmentFromAgendamento(appointmentData: {
    appointmentId: string;
    companyId: string;
    customerId: string;
    professionalId: string;
    serviceId: string;
    completedAt: Date;
    notes?: string;
    photos?: string[];
    paymentStatus: string;
    paymentAmount: number;
    paymentMethod?: string;
    completedByUserId: string;
  }): Promise<{
    id: string;
    serviceName: string;
    professionalName: string;
    totalAmount: number;
    paymentStatus: string;
    completedAt: Date;
    createdAt: Date;
  }> {
    try {
      // Import appointmentService dynamically
      const { appointmentService } = await import('./appointmentService');
      const { serviceService } = await import('./serviceService');
      const { professionalService } = await import('./professionalService');

      // Get service and professional names for the record
      const [service, professional] = await Promise.all([
        serviceService.getServiceById(appointmentData.serviceId, appointmentData.companyId),
        professionalService.getProfessionalById(appointmentData.professionalId, appointmentData.companyId),
      ]);

      if (!service || !professional) {
        throw new Error('Service or professional not found');
      }

      // Get customer info from CRM (for customerName)
      const customer = await this.getCustomerFromCRM(appointmentData.customerId);

      // Create the completed appointment record
      const completedAppointmentData = {
        companyId: appointmentData.companyId,
        appointmentId: appointmentData.appointmentId, // Link to original appointment
        serviceId: appointmentData.serviceId,
        professionalId: appointmentData.professionalId,
        customerId: appointmentData.customerId,
        customerName: customer?.name || 'Unknown Customer',
        customerPhone: customer?.phone || null,
        startTime: appointmentData.completedAt,
        endTime: new Date(appointmentData.completedAt.getTime() + service.duration * 60000),
        actualDuration: service.duration,
        status: 'COMPLETED' as const,
        servicePrice: parseFloat(service.price.toString()),
        discount: 0,
        totalAmount: appointmentData.paymentAmount,
        paymentStatus: appointmentData.paymentStatus as any,
        paymentMethod: appointmentData.paymentMethod || null,
        notes: appointmentData.notes || null,
        customerNotes: null,
        internalNotes: null,
        metadata: {
          completedViaAgendamento: true,
          originalAppointmentId: appointmentData.appointmentId,
          completedByUserId: appointmentData.completedByUserId,
        },
      };

      const completedAppointment = await appointmentService.createAppointmentCompleted(
        completedAppointmentData,
        appointmentData.completedByUserId
      );

      // Notify Agendamento module about completion
      try {
        const { agendamentoClient } = await import('../integrations/agendamentoClient');
        await agendamentoClient.markAppointmentAsCompleted(appointmentData.appointmentId);
        await agendamentoClient.notifyAppointmentChange(
          appointmentData.appointmentId, 
          'completed',
          {
            completedAt: appointmentData.completedAt,
            totalAmount: appointmentData.paymentAmount,
            paymentStatus: appointmentData.paymentStatus,
            notes: appointmentData.notes,
          }
        );
      } catch (notificationError) {
        logger.warn('Failed to notify Agendamento about appointment completion', {
          appointmentId: appointmentData.appointmentId,
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        });
      }

      logger.info('Appointment completed from Agendamento module', {
        appointmentId: appointmentData.appointmentId,
        completedAppointmentId: completedAppointment.id,
        customerId: appointmentData.customerId,
        professionalId: appointmentData.professionalId,
        serviceId: appointmentData.serviceId,
        amount: appointmentData.paymentAmount,
      });

      return {
        id: completedAppointment.id,
        serviceName: service.name,
        professionalName: professional.name,
        totalAmount: parseFloat(completedAppointment.totalAmount.toString()),
        paymentStatus: completedAppointment.paymentStatus,
        completedAt: completedAppointment.completedAt,
        createdAt: completedAppointment.createdAt,
      };
    } catch (error: any) {
      logger.error('Failed to complete appointment from Agendamento', {
        appointmentId: appointmentData.appointmentId,
        error: error.message,
      });
      throw error;
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Generate time slots based on working hours and service duration
   */
  private generateTimeSlots(startTime: string, endTime: string, serviceDuration: number): string[] {
    const slots: string[] = [];
    
    try {
      // Parse start and end times
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      
      // Generate slots every 30 minutes (or service duration if shorter)
      const slotInterval = Math.min(30, serviceDuration);
      
      for (let minutes = startMinutes; minutes + serviceDuration <= endMinutes; minutes += slotInterval) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeSlot);
      }
    } catch (error) {
      logger.error('Failed to generate time slots', {
        startTime,
        endTime,
        serviceDuration,
        error,
      });
    }
    
    return slots;
  }

  /**
   * Get booked slots for a professional on a specific date
   * This would integrate with the Agendamento module in a full implementation
   */
  private async getBookedSlots(professionalId: string, date: string): Promise<string[]> {
    try {
      // This is a placeholder implementation
      // In a real implementation, this would call the Agendamento module API
      // For now, we'll just check our own appointments_completed table

      const { appointmentService } = await import('./appointmentService');
      
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get completed appointments for this professional on this date
      const completedAppointments = await appointmentService.getAppointmentsCompleted(
        { 
          professionalId,
          startDate: startOfDay,
          endDate: endOfDay,
        },
        { page: 1, limit: 100, sortBy: 'startTime', sortOrder: 'asc' }
      );

      const bookedSlots: string[] = [];
      
      if (completedAppointments.data) {
        for (const appointment of completedAppointments.data) {
          const appointmentTime = new Date(appointment.startTime);
          const timeSlot = `${appointmentTime.getHours().toString().padStart(2, '0')}:${appointmentTime.getMinutes().toString().padStart(2, '0')}`;
          bookedSlots.push(timeSlot);
        }
      }

      // Call Agendamento module to get scheduled appointments
      const { agendamentoClient } = await import('../integrations/agendamentoClient');
      const scheduledAppointments = await agendamentoClient.getScheduledAppointments(professionalId, date);
      
      for (const appointment of scheduledAppointments) {
        if (appointment.time && appointment.status !== 'CANCELLED') {
          bookedSlots.push(appointment.time);
        }
      }

      return bookedSlots;
    } catch (error: any) {
      logger.error('Failed to get booked slots', {
        professionalId,
        date,
        error: error.message,
      });
      return [];
    }
  }
}

export const integrationService = new IntegrationService();