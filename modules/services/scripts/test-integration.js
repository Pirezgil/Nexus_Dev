#!/usr/bin/env node

/**
 * Integration Test Runner for Services Module
 * 
 * This script tests all critical integration endpoints required for Agendamento module
 */

const axios = require('axios');
const path = require('path');

// Configuration
const config = {
  baseURL: process.env.SERVICES_BASE_URL || 'http://localhost:5005',
  authToken: process.env.TEST_AUTH_TOKEN || 'test-jwt-token',
  companyId: process.env.TEST_COMPANY_ID || 'test-company-uuid',
  timeout: 10000,
};

// Test data
const testData = {
  serviceId: '550e8400-e29b-41d4-a716-446655440000',
  professionalId: '550e8400-e29b-41d4-a716-446655440001',
  customerId: '550e8400-e29b-41d4-a716-446655440002',
  appointmentId: '550e8400-e29b-41d4-a716-446655440003',
};

// HTTP Client
const client = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: {
    'Authorization': `Bearer ${config.authToken}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Test Results Tracking
 */
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * Test Suite: Services Integration APIs
 */
class IntegrationTester {
  
  async runAllTests() {
    console.log('🚀 Starting Services Module Integration Tests');
    console.log('=' .repeat(60));
    console.log(`Base URL: ${config.baseURL}`);
    console.log(`Company ID: ${config.companyId}`);
    console.log('=' .repeat(60));
    console.log();

    const tests = [
      { name: 'Services List API', test: this.testServicesListAPI },
      { name: 'Professionals List API', test: this.testProfessionalsListAPI },
      { name: 'Professional Availability API', test: this.testProfessionalAvailabilityAPI },
      { name: 'Complete Appointment API', test: this.testCompleteAppointmentAPI },
      { name: 'End-to-End Flow', test: this.testEndToEndFlow },
      { name: 'API Performance', test: this.testAPIPerformance },
    ];

    for (const testCase of tests) {
      await this.runTest(testCase.name, testCase.test.bind(this));
    }

    this.printResults();
    
    if (testResults.failed > 0) {
      process.exit(1);
    }
  }

  async runTest(testName, testFunction) {
    testResults.total++;
    console.log(`🧪 Testing: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFunction();
      const duration = Date.now() - startTime;
      
      testResults.passed++;
      console.log(`   ✅ PASSED (${duration}ms)`);
      console.log();
      
    } catch (error) {
      testResults.failed++;
      testResults.errors.push({ test: testName, error: error.message });
      
      console.log(`   ❌ FAILED: ${error.message}`);
      if (error.response?.data) {
        console.log(`   📝 Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      console.log();
    }
  }

  /**
   * Test 1: Services List API
   */
  async testServicesListAPI() {
    const response = await client.get('/api/integrations/services/list');
    
    // Validate response structure
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
      throw new Error('Response success should be true');
    }
    
    if (response.data.source !== 'services') {
      throw new Error(`Expected source 'services', got '${response.data.source}'`);
    }
    
    if (!Array.isArray(response.data.data)) {
      throw new Error('Response data should be an array');
    }
    
    // Validate service structure
    if (response.data.data.length > 0) {
      const service = response.data.data[0];
      const requiredFields = ['id', 'name', 'duration', 'price'];
      
      for (const field of requiredFields) {
        if (!(field in service)) {
          throw new Error(`Service object missing required field: ${field}`);
        }
      }
      
      if (typeof service.price !== 'number') {
        throw new Error('Service price should be a number');
      }
      
      if (typeof service.duration !== 'number') {
        throw new Error('Service duration should be a number');
      }
    }
    
    console.log(`   📊 Found ${response.data.data.length} services`);
  }

  /**
   * Test 2: Professionals List API
   */
  async testProfessionalsListAPI() {
    const response = await client.get('/api/integrations/professionals/list');
    
    // Validate response structure
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
      throw new Error('Response success should be true');
    }
    
    if (!Array.isArray(response.data.data)) {
      throw new Error('Response data should be an array');
    }
    
    // Validate professional structure
    if (response.data.data.length > 0) {
      const professional = response.data.data[0];
      const requiredFields = ['id', 'name', 'specialties', 'status'];
      
      for (const field of requiredFields) {
        if (!(field in professional)) {
          throw new Error(`Professional object missing required field: ${field}`);
        }
      }
      
      if (!Array.isArray(professional.specialties)) {
        throw new Error('Professional specialties should be an array');
      }
    }
    
    console.log(`   📊 Found ${response.data.data.length} professionals`);
    
    // Test with service filter
    const filteredResponse = await client.get(`/api/integrations/professionals/list?service_id=${testData.serviceId}`);
    
    if (filteredResponse.status !== 200) {
      throw new Error('Filtered professionals request failed');
    }
    
    console.log(`   🔍 Filtered query returned ${filteredResponse.data.data.length} professionals`);
  }

  /**
   * Test 3: Professional Availability API
   */
  async testProfessionalAvailabilityAPI() {
    const testDate = '2024-08-28';
    const url = `/api/integrations/professionals/${testData.professionalId}/availability?date=${testDate}&service_id=${testData.serviceId}`;
    
    const response = await client.get(url);
    
    // Validate response structure
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.success) {
      throw new Error('Response success should be true');
    }
    
    const data = response.data.data;
    const requiredFields = ['availableSlots', 'workingHours', 'bookedSlots'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Availability data missing required field: ${field}`);
      }
    }
    
    if (!Array.isArray(data.availableSlots)) {
      throw new Error('availableSlots should be an array');
    }
    
    if (!Array.isArray(data.bookedSlots)) {
      throw new Error('bookedSlots should be an array');
    }
    
    // Validate meta information
    const meta = response.data.meta;
    if (meta.professionalId !== testData.professionalId) {
      throw new Error('Meta professionalId mismatch');
    }
    
    if (meta.date !== testDate) {
      throw new Error('Meta date mismatch');
    }
    
    console.log(`   📅 Date: ${testDate}`);
    console.log(`   🕐 Available slots: ${data.availableSlots.length}`);
    console.log(`   🚫 Booked slots: ${data.bookedSlots.length}`);
    console.log(`   ⏰ Working hours: ${data.workingHours ? `${data.workingHours.start}-${data.workingHours.end}` : 'Not configured'}`);
    
    // Test validation errors
    try {
      await client.get(`/api/integrations/professionals/${testData.professionalId}/availability?date=invalid-date&service_id=${testData.serviceId}`);
      throw new Error('Should have failed with invalid date');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error('Invalid date should return 400 status');
      }
    }
    
    try {
      await client.get(`/api/integrations/professionals/${testData.professionalId}/availability?date=${testDate}`);
      throw new Error('Should have failed with missing service_id');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error('Missing service_id should return 400 status');
      }
    }
    
    console.log(`   ✅ Validation tests passed`);
  }

  /**
   * Test 4: Complete Appointment API
   */
  async testCompleteAppointmentAPI() {
    const appointmentData = {
      customer_id: testData.customerId,
      professional_id: testData.professionalId,
      service_id: testData.serviceId,
      completed_at: '2024-08-28T10:30:00Z',
      notes: 'Teste de integração automático',
      payment_status: 'PAID',
      payment_amount: 150.00,
      payment_method: 'pix'
    };
    
    const response = await client.post(
      `/api/integrations/appointments/${testData.appointmentId}/complete`,
      appointmentData
    );
    
    // Validate response structure
    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }
    
    if (!response.data.success) {
      throw new Error('Response success should be true');
    }
    
    if (!response.data.message.includes('completed successfully')) {
      throw new Error('Response message should confirm successful completion');
    }
    
    const data = response.data.data;
    const requiredFields = ['completedAppointmentId', 'appointmentId', 'totalAmount', 'paymentStatus', 'completedAt', 'createdAt'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Completion data missing required field: ${field}`);
      }
    }
    
    if (data.appointmentId !== testData.appointmentId) {
      throw new Error('AppointmentId mismatch in response');
    }
    
    if (data.totalAmount !== appointmentData.payment_amount) {
      throw new Error('Total amount mismatch in response');
    }
    
    console.log(`   💰 Total amount: $${data.totalAmount}`);
    console.log(`   💳 Payment status: ${data.paymentStatus}`);
    console.log(`   📝 Completed appointment ID: ${data.completedAppointmentId}`);
    
    // Test validation errors
    try {
      await client.post(
        `/api/integrations/appointments/${testData.appointmentId}/complete`,
        { customer_id: 'invalid-uuid' }
      );
      throw new Error('Should have failed with invalid data');
    } catch (error) {
      if (error.response?.status !== 400) {
        throw new Error('Invalid data should return 400 status');
      }
    }
    
    console.log(`   ✅ Validation tests passed`);
  }

  /**
   * Test 5: End-to-End Flow
   */
  async testEndToEndFlow() {
    console.log(`   🔄 Testing complete booking workflow...`);
    
    // Step 1: Get services
    const servicesResponse = await client.get('/api/integrations/services/list');
    const service = servicesResponse.data.data[0];
    
    if (!service) {
      throw new Error('No services available for E2E test');
    }
    
    // Step 2: Get professionals
    const professionalsResponse = await client.get('/api/integrations/professionals/list');
    const professional = professionalsResponse.data.data[0];
    
    if (!professional) {
      throw new Error('No professionals available for E2E test');
    }
    
    // Step 3: Check availability
    const availabilityResponse = await client.get(
      `/api/integrations/professionals/${professional.id}/availability?date=2024-08-28&service_id=${service.id}`
    );
    
    // Step 4: Complete appointment
    const appointmentData = {
      customer_id: testData.customerId,
      professional_id: professional.id,
      service_id: service.id,
      completed_at: '2024-08-28T11:00:00Z',
      notes: 'Teste E2E completo',
      payment_status: 'PAID',
      payment_amount: service.price,
      payment_method: 'card'
    };
    
    const completionResponse = await client.post(
      `/api/integrations/appointments/e2e-test-${Date.now()}/complete`,
      appointmentData
    );
    
    console.log(`   📋 Service: ${service.name} ($${service.price})`);
    console.log(`   👨‍⚕️ Professional: ${professional.name}`);
    console.log(`   ⏰ Available slots: ${availabilityResponse.data.data.availableSlots.length}`);
    console.log(`   ✅ Appointment completed: ${completionResponse.data.data.completedAppointmentId}`);
  }

  /**
   * Test 6: API Performance
   */
  async testAPIPerformance() {
    const performanceTests = [
      { name: 'Services List', url: '/api/integrations/services/list', maxTime: 1000 },
      { name: 'Professionals List', url: '/api/integrations/professionals/list', maxTime: 1000 },
      { 
        name: 'Availability Check', 
        url: `/api/integrations/professionals/${testData.professionalId}/availability?date=2024-08-28&service_id=${testData.serviceId}`, 
        maxTime: 2000 
      },
    ];

    for (const test of performanceTests) {
      const startTime = Date.now();
      
      try {
        const response = await client.get(test.url);
        const responseTime = Date.now() - startTime;
        
        if (response.status !== 200) {
          throw new Error(`${test.name} failed with status ${response.status}`);
        }
        
        if (responseTime > test.maxTime) {
          throw new Error(`${test.name} took ${responseTime}ms, expected < ${test.maxTime}ms`);
        }
        
        console.log(`   ⚡ ${test.name}: ${responseTime}ms (< ${test.maxTime}ms) ✅`);
        
      } catch (error) {
        if (error.response) {
          throw new Error(`${test.name} performance test failed: ${error.message}`);
        }
        throw error;
      }
    }
  }

  /**
   * Print test results summary
   */
  printResults() {
    console.log('=' .repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
    console.log();

    if (testResults.failed > 0) {
      console.log('❌ FAILED TESTS:');
      console.log('-' .repeat(30));
      testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.error}`);
      });
      console.log();
    }

    if (testResults.failed === 0) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('✅ Services module is ready for Agendamento integration');
    } else {
      console.log('💥 INTEGRATION TESTS FAILED!');
      console.log('⚠️  Services module needs fixes before Agendamento integration');
    }
    
    console.log('=' .repeat(60));
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new IntegrationTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 Critical test failure:', error.message);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { IntegrationTester };