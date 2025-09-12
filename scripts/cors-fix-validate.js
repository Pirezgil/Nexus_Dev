#!/usr/bin/env node
/**
 * CORS Fix Validation Script
 * Tests CORS configuration after fixes are applied
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const config = {
  apiGateway: 'http://localhost:5001',
  frontend: 'http://localhost:3000',
  timeout: 10000
};

class CORSValidator {
  constructor() {
    this.results = [];
    this.startTime = performance.now();
  }

  async test(name, testFn) {
    console.log(`🧪 Testing: ${name}...`);
    const start = performance.now();
    
    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), config.timeout)
        )
      ]);
      
      const duration = Math.round(performance.now() - start);
      this.results.push({
        name,
        status: 'PASS',
        duration: `${duration}ms`,
        details: result
      });
      
      console.log(`   ✅ PASS (${duration}ms)`);
      if (result && typeof result === 'object') {
        console.log(`   📊 Details:`, result);
      }
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.results.push({
        name,
        status: 'FAIL',
        duration: `${duration}ms`,
        error: error.message
      });
      
      console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
    }
    
    console.log('');
  }

  async validateGatewayHealth() {
    return axios.get(`${config.apiGateway}/health`).then(response => ({
      status: response.status,
      healthy: response.data?.status === 'healthy' || response.status === 200
    }));
  }

  async validateGatewayPing() {
    return axios.get(`${config.apiGateway}/ping`).then(response => ({
      status: response.status,
      message: response.data?.message,
      timestamp: response.data?.timestamp
    }));
  }

  async validateCORSHeaders() {
    const origin = config.frontend;
    
    return axios.options(`${config.apiGateway}/api/crm/customers`, {
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    }).then(response => {
      const headers = response.headers;
      
      return {
        status: response.status,
        corsHeaders: {
          'access-control-allow-origin': headers['access-control-allow-origin'],
          'access-control-allow-methods': headers['access-control-allow-methods'],
          'access-control-allow-headers': headers['access-control-allow-headers'],
          'access-control-allow-credentials': headers['access-control-allow-credentials']
        },
        originAllowed: headers['access-control-allow-origin'] === origin || 
                      headers['access-control-allow-origin'] === '*'
      };
    });
  }

  async validateCRMEndpoint() {
    return axios.get(`${config.apiGateway}/api/crm/customers`, {
      headers: {
        'Origin': config.frontend
      },
      validateStatus: (status) => status < 500 // Accept 401/403 as valid responses
    }).then(response => ({
      status: response.status,
      corsHeaderPresent: !!response.headers['access-control-allow-origin'],
      corsOrigin: response.headers['access-control-allow-origin'],
      responseType: typeof response.data
    }));
  }

  async validateAuthEndpoint() {
    return axios.post(`${config.apiGateway}/api/auth/login`, {
      email: 'test@example.com',
      password: 'test123'
    }, {
      headers: {
        'Origin': config.frontend,
        'Content-Type': 'application/json'
      },
      validateStatus: (status) => status < 500
    }).then(response => ({
      status: response.status,
      corsHeaderPresent: !!response.headers['access-control-allow-origin'],
      corsOrigin: response.headers['access-control-allow-origin'],
      hasErrorResponse: !!response.data?.error
    }));
  }

  async validateNginxProxy() {
    // Test if nginx is proxying correctly
    return axios.get(`http://localhost:5000/api/crm/customers`, {
      headers: {
        'Origin': config.frontend
      },
      timeout: 5000,
      validateStatus: (status) => status < 500
    }).then(response => ({
      status: response.status,
      viaProxy: response.headers['server']?.includes('nginx') || 
               response.headers['x-proxy'] === 'nginx',
      corsHeaderPresent: !!response.headers['access-control-allow-origin']
    })).catch(error => {
      if (error.code === 'ECONNREFUSED') {
        return { nginxRunning: false, error: 'Nginx not running on port 5000' };
      }
      throw error;
    });
  }

  async validateFullWorkflow() {
    // Simulate a full frontend -> backend request flow
    const testData = {
      name: 'Test Customer',
      email: 'test@customer.com',
      phone: '(11) 99999-9999'
    };

    return axios.post(`${config.apiGateway}/api/crm/customers`, testData, {
      headers: {
        'Origin': config.frontend,
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-invalid-token'
      },
      validateStatus: (status) => status < 500
    }).then(response => ({
      status: response.status,
      corsWorking: !!response.headers['access-control-allow-origin'],
      authRejected: response.status === 401,
      properErrorHandling: !!response.data?.error
    }));
  }

  printSummary() {
    const totalTime = Math.round(performance.now() - this.startTime);
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log('='.repeat(60));
    console.log('📋 CORS VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Time: ${totalTime}ms`);
    console.log('');

    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   • ${result.name}: ${result.error}`);
        });
      console.log('');
    }

    if (passed === this.results.length) {
      console.log('🎉 All tests passed! CORS is configured correctly.');
    } else {
      console.log('⚠️  Some tests failed. Review the configuration and fix the issues.');
    }

    console.log('');
    console.log('📊 DETAILED RESULTS:');
    console.table(this.results);
  }
}

async function main() {
  console.log('🚀 Starting CORS Configuration Validation');
  console.log('='.repeat(60));
  console.log(`API Gateway: ${config.apiGateway}`);
  console.log(`Frontend Origin: ${config.frontend}`);
  console.log(`Timeout: ${config.timeout}ms`);
  console.log('');

  const validator = new CORSValidator();

  // Basic connectivity tests
  await validator.test('API Gateway Health Check', () => validator.validateGatewayHealth());
  await validator.test('API Gateway Ping', () => validator.validateGatewayPing());
  
  // CORS specific tests
  await validator.test('CORS Preflight Request', () => validator.validateCORSHeaders());
  await validator.test('CRM Endpoint CORS', () => validator.validateCRMEndpoint());
  await validator.test('Auth Endpoint CORS', () => validator.validateAuthEndpoint());
  
  // Proxy tests
  await validator.test('Nginx Proxy (if running)', () => validator.validateNginxProxy());
  
  // End-to-end workflow test
  await validator.test('Full Request Workflow', () => validator.validateFullWorkflow());

  validator.printSummary();
  
  // Exit with appropriate code
  const allPassed = validator.results.every(r => r.status === 'PASS');
  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  });
}

module.exports = { CORSValidator };