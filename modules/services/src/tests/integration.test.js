/**
 * Integration Tests for Services Module - Agendamento Integration
 * 
 * Tests the critical integration endpoints required for Agendamento module
 */

const axios = require('axios');

const BASE_URL = process.env.SERVICES_BASE_URL || 'http://localhost:5005';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token';
const COMPANY_ID = process.env.TEST_COMPANY_ID || 'test-company-uuid';

// Test data
const testData = {
  serviceId: 'service-uuid-test',
  professionalId: 'professional-uuid-test',
  customerId: 'customer-uuid-test',
  appointmentId: 'appointment-uuid-test',
};

/**
 * HTTP Client with authentication
 */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Test Suite: Services Integration APIs
 */
describe('Services Integration APIs', () => {
  
  /**
   * Test 1: Get Services List for Agendamento
   */
  describe('GET /api/integrations/services/list', () => {
    test('should return services list in correct format', async () => {
      console.log('🧪 Testing Services List API...');
      
      try {
        const response = await client.get('/api/integrations/services/list');
        
        // Validate response structure
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.source).toBe('services');
        expect(Array.isArray(response.data.data)).toBe(true);
        
        // Validate service object structure
        if (response.data.data.length > 0) {
          const service = response.data.data[0];
          expect(service).toHaveProperty('id');
          expect(service).toHaveProperty('name');
          expect(service).toHaveProperty('duration');
          expect(service).toHaveProperty('price');
          expect(typeof service.price).toBe('number');
          expect(typeof service.duration).toBe('number');
        }
        
        // Validate meta information
        expect(response.data.meta).toHaveProperty('count');
        expect(response.data.meta).toHaveProperty('companyId');
        expect(response.data.meta).toHaveProperty('retrievedAt');
        
        console.log('✅ Services List API test passed');
        console.log(`   Found ${response.data.data.length} services`);
        
      } catch (error) {
        console.error('❌ Services List API test failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  /**
   * Test 2: Get Professionals List for Agendamento
   */
  describe('GET /api/integrations/professionals/list', () => {
    test('should return professionals list in correct format', async () => {
      console.log('🧪 Testing Professionals List API...');
      
      try {
        const response = await client.get('/api/integrations/professionals/list');
        
        // Validate response structure
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.source).toBe('services');
        expect(Array.isArray(response.data.data)).toBe(true);
        
        // Validate professional object structure
        if (response.data.data.length > 0) {
          const professional = response.data.data[0];
          expect(professional).toHaveProperty('id');
          expect(professional).toHaveProperty('name');
          expect(professional).toHaveProperty('specialties');
          expect(professional).toHaveProperty('status');
          expect(Array.isArray(professional.specialties)).toBe(true);
        }
        
        // Validate meta information
        expect(response.data.meta).toHaveProperty('count');
        expect(response.data.meta).toHaveProperty('companyId');
        expect(response.data.meta).toHaveProperty('retrievedAt');
        
        console.log('✅ Professionals List API test passed');
        console.log(`   Found ${response.data.data.length} professionals`);
        
      } catch (error) {
        console.error('❌ Professionals List API test failed:', error.response?.data || error.message);
        throw error;
      }
    });

    test('should filter professionals by service_id', async () => {
      console.log('🧪 Testing Professionals List API with service filter...');
      
      try {
        const response = await client.get(`/api/integrations/professionals/list?service_id=${testData.serviceId}`);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.meta.serviceId).toBe(testData.serviceId);
        
        console.log('✅ Professionals List with filter test passed');
        
      } catch (error) {
        console.error('❌ Professionals List with filter test failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  /**
   * Test 3: Professional Availability Check
   */
  describe('GET /api/integrations/professionals/:id/availability', () => {
    test('should return availability with valid date and service_id', async () => {
      console.log('🧪 Testing Professional Availability API...');
      
      const testDate = '2024-08-28';
      
      try {
        const response = await client.get(
          `/api/integrations/professionals/${testData.professionalId}/availability?date=${testDate}&service_id=${testData.serviceId}`
        );
        
        // Validate response structure
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        
        // Validate availability data structure
        expect(response.data.data).toHaveProperty('availableSlots');
        expect(response.data.data).toHaveProperty('workingHours');
        expect(response.data.data).toHaveProperty('bookedSlots');
        
        expect(Array.isArray(response.data.data.availableSlots)).toBe(true);
        expect(Array.isArray(response.data.data.bookedSlots)).toBe(true);
        
        // Validate meta information
        expect(response.data.meta.professionalId).toBe(testData.professionalId);
        expect(response.data.meta.date).toBe(testDate);
        expect(response.data.meta.serviceId).toBe(testData.serviceId);
        
        console.log('✅ Professional Availability API test passed');
        console.log(`   Available slots: ${response.data.data.availableSlots.length}`);
        console.log(`   Booked slots: ${response.data.data.bookedSlots.length}`);
        
      } catch (error) {
        console.error('❌ Professional Availability API test failed:', error.response?.data || error.message);
        throw error;
      }
    });

    test('should return 400 for invalid date format', async () => {
      console.log('🧪 Testing Professional Availability API with invalid date...');
      
      try {
        const response = await client.get(
          `/api/integrations/professionals/${testData.professionalId}/availability?date=invalid-date&service_id=${testData.serviceId}`
        );
        
        // Should not reach here
        expect(true).toBe(false);
        
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
        
        console.log('✅ Professional Availability validation test passed');
      }
    });

    test('should return 400 for missing service_id', async () => {
      console.log('🧪 Testing Professional Availability API with missing service_id...');
      
      try {
        const response = await client.get(
          `/api/integrations/professionals/${testData.professionalId}/availability?date=2024-08-28`
        );
        
        // Should not reach here
        expect(true).toBe(false);
        
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
        
        console.log('✅ Professional Availability missing parameter test passed');
      }
    });
  });

  /**
   * Test 4: Complete Appointment Callback
   */
  describe('POST /api/integrations/appointments/:id/complete', () => {
    test('should complete appointment with valid data', async () => {
      console.log('🧪 Testing Complete Appointment API...');
      
      const appointmentData = {
        customer_id: testData.customerId,
        professional_id: testData.professionalId,
        service_id: testData.serviceId,
        completed_at: '2024-08-28T10:30:00Z',
        notes: 'Teste de integração - atendimento concluído com sucesso',
        payment_status: 'PAID',
        payment_amount: 150.00,
        payment_method: 'pix'
      };
      
      try {
        const response = await client.post(
          `/api/integrations/appointments/${testData.appointmentId}/complete`,
          appointmentData
        );
        
        // Validate response structure
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        expect(response.data.message).toContain('completed successfully');
        
        // Validate response data
        expect(response.data.data).toHaveProperty('completedAppointmentId');
        expect(response.data.data).toHaveProperty('appointmentId');
        expect(response.data.data).toHaveProperty('totalAmount');
        expect(response.data.data).toHaveProperty('paymentStatus');
        expect(response.data.data).toHaveProperty('completedAt');
        expect(response.data.data).toHaveProperty('createdAt');
        
        expect(response.data.data.appointmentId).toBe(testData.appointmentId);
        expect(response.data.data.customerId).toBe(testData.customerId);
        expect(response.data.data.professionalId).toBe(testData.professionalId);
        expect(response.data.data.serviceId).toBe(testData.serviceId);
        expect(response.data.data.totalAmount).toBe(appointmentData.payment_amount);
        
        console.log('✅ Complete Appointment API test passed');
        console.log(`   Completed appointment ID: ${response.data.data.completedAppointmentId}`);
        
      } catch (error) {
        console.error('❌ Complete Appointment API test failed:', error.response?.data || error.message);
        throw error;
      }
    });

    test('should return 400 for invalid request body', async () => {
      console.log('🧪 Testing Complete Appointment API with invalid data...');
      
      const invalidData = {
        customer_id: 'invalid-uuid',
        professional_id: testData.professionalId,
        service_id: testData.serviceId,
        completed_at: 'invalid-date',
        payment_amount: -100, // Invalid negative amount
      };
      
      try {
        const response = await client.post(
          `/api/integrations/appointments/${testData.appointmentId}/complete`,
          invalidData
        );
        
        // Should not reach here
        expect(true).toBe(false);
        
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
        
        console.log('✅ Complete Appointment validation test passed');
      }
    });

    test('should return 400 for missing required fields', async () => {
      console.log('🧪 Testing Complete Appointment API with missing fields...');
      
      const incompleteData = {
        customer_id: testData.customerId,
        // Missing professional_id, service_id, completed_at, payment_amount
      };
      
      try {
        const response = await client.post(
          `/api/integrations/appointments/${testData.appointmentId}/complete`,
          incompleteData
        );
        
        // Should not reach here
        expect(true).toBe(false);
        
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.code).toBe('VALIDATION_ERROR');
        
        console.log('✅ Complete Appointment missing fields test passed');
      }
    });
  });
});

/**
 * End-to-End Integration Flow Test
 */
describe('End-to-End Integration Flow', () => {
  test('should complete full booking workflow', async () => {
    console.log('🧪 Testing End-to-End Integration Flow...');
    
    try {
      // Step 1: Get available services
      console.log('   Step 1: Getting available services...');
      const servicesResponse = await client.get('/api/integrations/services/list');
      expect(servicesResponse.data.success).toBe(true);
      
      const service = servicesResponse.data.data[0];
      if (!service) {
        console.log('   ⚠️ No services available, skipping E2E test');
        return;
      }
      
      // Step 2: Get available professionals
      console.log('   Step 2: Getting available professionals...');
      const professionalsResponse = await client.get('/api/integrations/professionals/list');
      expect(professionalsResponse.data.success).toBe(true);
      
      const professional = professionalsResponse.data.data[0];
      if (!professional) {
        console.log('   ⚠️ No professionals available, skipping E2E test');
        return;
      }
      
      // Step 3: Check professional availability
      console.log('   Step 3: Checking professional availability...');
      const availabilityResponse = await client.get(
        `/api/integrations/professionals/${professional.id}/availability?date=2024-08-28&service_id=${service.id}`
      );
      expect(availabilityResponse.data.success).toBe(true);
      
      // Step 4: Complete appointment (simulate)
      console.log('   Step 4: Completing appointment...');
      const appointmentData = {
        customer_id: testData.customerId,
        professional_id: professional.id,
        service_id: service.id,
        completed_at: '2024-08-28T10:30:00Z',
        notes: 'Teste E2E - fluxo completo de integração',
        payment_status: 'PAID',
        payment_amount: service.price,
        payment_method: 'card'
      };
      
      const completionResponse = await client.post(
        `/api/integrations/appointments/e2e-test-appointment/complete`,
        appointmentData
      );
      expect(completionResponse.data.success).toBe(true);
      
      console.log('✅ End-to-End Integration Flow test passed');
      console.log(`   Service: ${service.name} (${service.price})`);
      console.log(`   Professional: ${professional.name}`);
      console.log(`   Available slots: ${availabilityResponse.data.data.availableSlots.length}`);
      console.log(`   Appointment completed: ${completionResponse.data.data.completedAppointmentId}`);
      
    } catch (error) {
      console.error('❌ End-to-End Integration Flow test failed:', error.response?.data || error.message);
      throw error;
    }
  });
});

/**
 * Performance Tests
 */
describe('Integration APIs Performance', () => {
  test('availability check should respond within 2 seconds', async () => {
    console.log('🧪 Testing Professional Availability API performance...');
    
    const startTime = Date.now();
    
    try {
      const response = await client.get(
        `/api/integrations/professionals/${testData.professionalId}/availability?date=2024-08-28&service_id=${testData.serviceId}`
      );
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
      
      console.log(`✅ Professional Availability performance test passed (${responseTime}ms)`);
      
    } catch (error) {
      console.error('❌ Professional Availability performance test failed:', error.response?.data || error.message);
      throw error;
    }
  });

  test('services list should respond within 1 second', async () => {
    console.log('🧪 Testing Services List API performance...');
    
    const startTime = Date.now();
    
    try {
      const response = await client.get('/api/integrations/services/list');
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      
      console.log(`✅ Services List performance test passed (${responseTime}ms)`);
      
    } catch (error) {
      console.error('❌ Services List performance test failed:', error.response?.data || error.message);
      throw error;
    }
  });
});

/**
 * Export test functions for manual execution
 */
module.exports = {
  testServicesIntegration: async () => {
    console.log('🚀 Running Services Integration Tests...\n');
    
    try {
      // Test each endpoint individually
      await testServicesListAPI();
      await testProfessionalsListAPI();
      await testProfessionalAvailabilityAPI();
      await testCompleteAppointmentAPI();
      
      console.log('\n✅ All Services Integration Tests passed!');
      
    } catch (error) {
      console.error('\n❌ Services Integration Tests failed:', error.message);
      process.exit(1);
    }
  }
};

// Individual test functions
async function testServicesListAPI() {
  const response = await client.get('/api/integrations/services/list');
  console.log(`✅ Services List: ${response.data.data.length} services found`);
}

async function testProfessionalsListAPI() {
  const response = await client.get('/api/integrations/professionals/list');
  console.log(`✅ Professionals List: ${response.data.data.length} professionals found`);
}

async function testProfessionalAvailabilityAPI() {
  const response = await client.get(
    `/api/integrations/professionals/${testData.professionalId}/availability?date=2024-08-28&service_id=${testData.serviceId}`
  );
  console.log(`✅ Professional Availability: ${response.data.data.availableSlots.length} slots available`);
}

async function testCompleteAppointmentAPI() {
  const appointmentData = {
    customer_id: testData.customerId,
    professional_id: testData.professionalId,
    service_id: testData.serviceId,
    completed_at: '2024-08-28T10:30:00Z',
    payment_status: 'PAID',
    payment_amount: 150.00,
  };
  
  const response = await client.post(
    `/api/integrations/appointments/${testData.appointmentId}/complete`,
    appointmentData
  );
  console.log(`✅ Complete Appointment: ${response.data.data.completedAppointmentId} created`);
}

// If running directly (node integration.test.js)
if (require.main === module) {
  module.exports.testServicesIntegration();
}