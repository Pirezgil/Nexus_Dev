#!/usr/bin/env node
/**
 * Validation Script for Atomic Batch Validation Fix
 * 
 * This script validates the critical fix for Error #5:
 * Ensuring ModuleIntegrator.validateBatch is atomic and fail-fast
 */

const path = require('path');

// Add the shared directory to the module path
const sharedPath = path.join(__dirname, '..', 'shared');
require('module').globalPaths.unshift(sharedPath);

const { ModuleIntegrator, BatchValidationError } = require('../shared/integrators/ModuleIntegrator');
const axios = require('axios');

// Mock axios for controlled testing
const originalAxiosGet = axios.get;

console.log('🚀 VALIDATION: ModuleIntegrator Atomic Fail-Fast Batch Validation');
console.log('=' .repeat(70));

async function runValidationTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Mock the logger to prevent noise
  ModuleIntegrator.logger = {
    info: (msg) => console.log(`  [INFO] ${msg}`),
    warn: (msg) => console.log(`  [WARN] ${msg}`),
    error: (msg) => console.log(`  [ERROR] ${msg}`),
    debug: () => {} // Suppress debug logs
  };

  function test(name, testFn) {
    return async function() {
      console.log(`\n🧪 TEST: ${name}`);
      try {
        await testFn();
        console.log(`✅ PASSED: ${name}`);
        testsPassed++;
      } catch (error) {
        console.error(`❌ FAILED: ${name}`);
        console.error(`   Error: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        testsFailed++;
      }
    };
  }

  // Test 1: Empty validation array
  await test('Empty validation array should return empty object', async () => {
    const result = await ModuleIntegrator.validateBatch([]);
    if (Object.keys(result).length !== 0) {
      throw new Error('Expected empty object for empty validation array');
    }
  })();

  // Test 2: Single successful validation (mocked)
  await test('Single successful validation should work', async () => {
    let callCount = 0;
    axios.get = async (url, config) => {
      callCount++;
      return {
        data: { exists: true, customer: { id: 'cust-123', name: 'Test Customer' } }
      };
    };

    const validations = [
      { key: 'customer1', type: 'customer', id: 'cust-123', companyId: 'comp-456' }
    ];

    const result = await ModuleIntegrator.validateBatch(validations);
    
    if (Object.keys(result).length !== 1) {
      throw new Error('Expected 1 result');
    }
    if (!result.customer1.exists) {
      throw new Error('Expected customer1 to exist');
    }
    if (callCount !== 1) {
      throw new Error(`Expected 1 HTTP call, got ${callCount}`);
    }

    // Restore axios
    axios.get = originalAxiosGet;
  })();

  // Test 3: CRITICAL - Fail-fast behavior
  await test('CRITICAL: Should fail fast on second validation failure', async () => {
    let callCount = 0;
    let callOrder = [];

    axios.get = async (url, config) => {
      callCount++;
      
      if (url.includes('customers')) {
        callOrder.push('customer');
        return {
          data: { exists: true, customer: { id: 'cust-123', name: 'Test Customer' } }
        };
      } else if (url.includes('services')) {
        callOrder.push('service');
        throw new Error('Service not found');
      } else if (url.includes('professionals')) {
        callOrder.push('professional');
        return {
          data: { exists: true, professional: { id: 'prof-101', name: 'Test Professional' } }
        };
      }
    };

    const validations = [
      { key: 'customer1', type: 'customer', id: 'cust-123', companyId: 'comp-456' },
      { key: 'service1', type: 'service', id: 'serv-789', companyId: 'comp-456' },
      { key: 'professional1', type: 'professional', id: 'prof-101', companyId: 'comp-456' }
    ];

    let errorThrown = false;
    try {
      await ModuleIntegrator.validateBatch(validations);
    } catch (error) {
      errorThrown = true;
      
      // Verify it's our BatchValidationError
      if (!(error instanceof BatchValidationError)) {
        throw new Error(`Expected BatchValidationError, got ${error.constructor.name}`);
      }
      
      // Verify error details
      if (error.failedValidationKey !== 'service1') {
        throw new Error(`Expected failedValidationKey='service1', got '${error.failedValidationKey}'`);
      }
      
      if (error.failedValidationType !== 'service') {
        throw new Error(`Expected failedValidationType='service', got '${error.failedValidationType}'`);
      }
    }

    if (!errorThrown) {
      throw new Error('Expected BatchValidationError to be thrown');
    }

    // CRITICAL CHECK: Only 2 HTTP calls should have been made
    if (callCount !== 2) {
      throw new Error(`FAIL-FAST VIOLATED: Expected 2 HTTP calls, got ${callCount}. Third validation should not have been executed.`);
    }

    // Verify call order
    if (callOrder.length !== 2 || callOrder[0] !== 'customer' || callOrder[1] !== 'service') {
      throw new Error(`Wrong call order: ${callOrder.join(', ')}. Expected: customer, service`);
    }

    console.log(`   ✅ ATOMICITY VERIFIED: Only ${callCount} calls made, third validation correctly skipped`);
    console.log(`   ✅ CALL ORDER VERIFIED: ${callOrder.join(' → ')}`);

    // Restore axios
    axios.get = originalAxiosGet;
  })();

  // Test 4: Non-fail-fast mode should continue
  await test('Non-fail-fast mode should collect all errors', async () => {
    let callCount = 0;

    axios.get = async (url, config) => {
      callCount++;
      
      if (url.includes('customers')) {
        throw new Error('Customer not found');
      } else if (url.includes('services')) {
        throw new Error('Service not found');
      } else if (url.includes('professionals')) {
        return { data: { exists: true, professional: { id: 'prof-101' } } };
      }
    };

    const validations = [
      { key: 'customer1', type: 'customer', id: 'cust-invalid', companyId: 'comp-456' },
      { key: 'service1', type: 'service', id: 'serv-invalid', companyId: 'comp-456' },
      { key: 'professional1', type: 'professional', id: 'prof-valid', companyId: 'comp-456' }
    ];

    const result = await ModuleIntegrator.validateBatch(validations, { failFast: false });
    
    if (Object.keys(result).length !== 3) {
      throw new Error(`Expected 3 results, got ${Object.keys(result).length}`);
    }
    
    if (result.customer1.exists !== false || !result.customer1.error) {
      throw new Error('Expected customer1 to have error');
    }
    
    if (result.service1.exists !== false || !result.service1.error) {
      throw new Error('Expected service1 to have error');
    }
    
    if (result.professional1.exists !== true) {
      throw new Error('Expected professional1 to exist');
    }

    // All 3 calls should have been made in non-fail-fast mode
    if (callCount !== 3) {
      throw new Error(`Expected 3 HTTP calls in non-fail-fast mode, got ${callCount}`);
    }

    console.log(`   ✅ NON-FAIL-FAST MODE: All ${callCount} calls made as expected`);

    // Restore axios
    axios.get = originalAxiosGet;
  })();

  // Test 5: Reference validation
  await test('Should fail when reference does not exist', async () => {
    axios.get = async (url, config) => {
      return { data: { exists: false } }; // Reference doesn't exist
    };

    const validations = [
      { key: 'customer1', type: 'customer', id: 'cust-nonexistent', companyId: 'comp-456' }
    ];

    let errorThrown = false;
    try {
      await ModuleIntegrator.validateBatch(validations);
    } catch (error) {
      errorThrown = true;
      
      if (!(error instanceof BatchValidationError)) {
        throw new Error(`Expected BatchValidationError, got ${error.constructor.name}`);
      }
      
      if (!error.message.includes('não existe')) {
        throw new Error(`Expected message about non-existence, got: ${error.message}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Expected error for non-existent reference');
    }

    // Restore axios
    axios.get = originalAxiosGet;
  })();

  // Test 6: Unknown validation type
  await test('Should fail for unknown validation type', async () => {
    const validations = [
      { key: 'unknown1', type: 'unknown_type', id: 'test-123', companyId: 'comp-456' }
    ];

    let errorThrown = false;
    try {
      await ModuleIntegrator.validateBatch(validations);
    } catch (error) {
      errorThrown = true;
      
      if (!(error instanceof BatchValidationError)) {
        throw new Error(`Expected BatchValidationError, got ${error.constructor.name}`);
      }
      
      if (!error.message.includes('Tipo de validação desconhecido')) {
        throw new Error(`Expected unknown type error, got: ${error.message}`);
      }
    }

    if (!errorThrown) {
      throw new Error('Expected error for unknown validation type');
    }
  })();

  // Test Summary
  console.log('\n' + '='.repeat(70));
  console.log(`📊 TEST SUMMARY`);
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Atomic batch validation fix is working correctly.');
    console.log('\n🔒 CRITICAL VERIFICATION:');
    console.log('   ✅ Fail-fast behavior prevents execution of subsequent validations');
    console.log('   ✅ BatchValidationError provides detailed failure information');
    console.log('   ✅ Sequential execution ensures atomicity');
    console.log('   ✅ Non-fail-fast mode works for edge cases');
    console.log('\n🚀 The fix for Error #5 (ModuleIntegrator validation gaps) is COMPLETE and VERIFIED.');
    return true;
  } else {
    console.log('\n💥 Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run the validation
runValidationTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 CRITICAL ERROR during validation:', error);
    process.exit(1);
  });