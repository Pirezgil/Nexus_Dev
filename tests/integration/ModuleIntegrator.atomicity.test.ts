/**
 * Integration Tests for ModuleIntegrator Atomic Batch Validation
 * 
 * These tests verify the critical fix for Error #5 in the critical analysis report:
 * Ensuring fail-fast, atomic validation that prevents data corruption
 */

import { ModuleIntegrator, BatchValidationError, ValidationResult } from '../../shared/integrators/ModuleIntegrator';

// Mock the logger to avoid noise in tests
jest.mock('../../shared/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock axios to control validation responses
jest.mock('axios');
const mockedAxios = jest.mocked(require('axios'));

describe('ModuleIntegrator.validateBatch - Atomic Fail-Fast Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset ModuleIntegrator configuration
    ModuleIntegrator.configure({
      auth: 'http://localhost:3001',
      crm: 'http://localhost:3002',
      services: 'http://localhost:3003',
      agendamento: 'http://localhost:3004'
    });
  });

  describe('CRITICAL: Fail-Fast Atomicity Tests', () => {
    it('should fail immediately when second validation fails and NOT execute third validation', async () => {
      // ARRANGE: Create test scenario with 3 validations where the 2nd fails
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-789', companyId: 'comp-456' },
        { key: 'professional1', type: 'professional' as const, id: 'prof-101', companyId: 'comp-456' }
      ];

      // Mock responses: 1st succeeds, 2nd fails, 3rd should never be called
      mockedAxios.get
        .mockResolvedValueOnce({ 
          data: { exists: true, customer: { id: 'cust-123', name: 'John Doe' } } 
        })
        .mockRejectedValueOnce(new Error('Service not found'))
        .mockResolvedValueOnce({ 
          data: { exists: true, professional: { id: 'prof-101', name: 'Dr. Smith' } } 
        });

      // ACT & ASSERT: Expect BatchValidationError to be thrown
      await expect(ModuleIntegrator.validateBatch(validations)).rejects.toThrow(BatchValidationError);

      try {
        await ModuleIntegrator.validateBatch(validations);
      } catch (error) {
        // Verify it's our custom error with correct details
        expect(error).toBeInstanceOf(BatchValidationError);
        const batchError = error as BatchValidationError;
        
        expect(batchError.failedValidationKey).toBe('service1');
        expect(batchError.failedValidationType).toBe('service');
        expect(batchError.originalError).toBeInstanceOf(Error);
        expect(batchError.message).toContain('service1');
      }

      // CRITICAL ASSERTION: Only 2 HTTP calls should have been made (customer + service)
      // The third validation (professional) should NEVER have been executed
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      
      // Verify the exact endpoints that were called
      expect(mockedAxios.get).toHaveBeenNthCalledWith(1, 
        'http://localhost:3002/api/customers/cust-123/validate',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Company-ID': 'comp-456'
          })
        })
      );
      
      expect(mockedAxios.get).toHaveBeenNthCalledWith(2,
        'http://localhost:3003/api/services/serv-789/validate',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Company-ID': 'comp-456'
          })
        })
      );
    });

    it('should fail immediately when validation returns exists:false (reference not found)', async () => {
      // ARRANGE: Customer exists but service doesn't exist
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-nonexistent', companyId: 'comp-456' },
        { key: 'professional1', type: 'professional' as const, id: 'prof-101', companyId: 'comp-456' }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ 
          data: { exists: true, customer: { id: 'cust-123' } } 
        })
        .mockResolvedValueOnce({ 
          data: { exists: false } // Service doesn't exist
        });

      // ACT & ASSERT
      await expect(ModuleIntegrator.validateBatch(validations)).rejects.toThrow(BatchValidationError);

      try {
        await ModuleIntegrator.validateBatch(validations);
      } catch (error) {
        const batchError = error as BatchValidationError;
        expect(batchError.failedValidationKey).toBe('service1');
        expect(batchError.message).toContain('service with ID \'serv-nonexistent\' does not exist');
      }

      // Only 2 calls should have been made
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should succeed when all validations pass (atomicity success case)', async () => {
      // ARRANGE: All validations will succeed
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-789', companyId: 'comp-456' },
        { key: 'professional1', type: 'professional' as const, id: 'prof-101', companyId: 'comp-456' }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: { exists: true, customer: { id: 'cust-123', name: 'John Doe' } } })
        .mockResolvedValueOnce({ data: { exists: true, service: { id: 'serv-789', name: 'Haircut' } } })
        .mockResolvedValueOnce({ data: { exists: true, professional: { id: 'prof-101', name: 'Dr. Smith' } } });

      // ACT
      const results = await ModuleIntegrator.validateBatch(validations);

      // ASSERT: All validations should succeed and return results
      expect(Object.keys(results)).toHaveLength(3);
      expect(results.customer1.exists).toBe(true);
      expect(results.service1.exists).toBe(true);
      expect(results.professional1.exists).toBe(true);

      // All 3 HTTP calls should have been made
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Non-Fail-Fast Mode Tests', () => {
    it('should collect all errors when failFast is disabled', async () => {
      // ARRANGE: Multiple failures with failFast disabled
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-invalid', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-invalid', companyId: 'comp-456' },
        { key: 'professional1', type: 'professional' as const, id: 'prof-valid', companyId: 'comp-456' }
      ];

      mockedAxios.get
        .mockRejectedValueOnce(new Error('Customer not found'))
        .mockRejectedValueOnce(new Error('Service not found'))
        .mockResolvedValueOnce({ data: { exists: true, professional: { id: 'prof-valid' } } });

      // ACT: Use non-fail-fast mode
      const results = await ModuleIntegrator.validateBatch(validations, { failFast: false });

      // ASSERT: Should have results for all validations, including errors
      expect(Object.keys(results)).toHaveLength(3);
      expect(results.customer1.exists).toBe(false);
      expect(results.customer1.error).toContain('Customer not found');
      expect(results.service1.exists).toBe(false);
      expect(results.service1.error).toContain('Service not found');
      expect(results.professional1.exists).toBe(true);

      // All 3 HTTP calls should have been made
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty validations array gracefully', async () => {
      const results = await ModuleIntegrator.validateBatch([]);
      expect(results).toEqual({});
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should throw error for unknown validation type', async () => {
      const validations = [
        { key: 'invalid1', type: 'unknown' as any, id: 'test-123', companyId: 'comp-456' }
      ];

      await expect(ModuleIntegrator.validateBatch(validations)).rejects.toThrow(BatchValidationError);

      try {
        await ModuleIntegrator.validateBatch(validations);
      } catch (error) {
        const batchError = error as BatchValidationError;
        expect(batchError.message).toContain('Unknown validation type: unknown');
      }
    });

    it('should handle network timeouts gracefully', async () => {
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' }
      ];

      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.name = 'TimeoutError';
      
      mockedAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(ModuleIntegrator.validateBatch(validations)).rejects.toThrow(BatchValidationError);

      try {
        await ModuleIntegrator.validateBatch(validations);
      } catch (error) {
        const batchError = error as BatchValidationError;
        expect(batchError.originalError.message).toContain('timeout');
      }
    });
  });

  describe('Options Configuration', () => {
    it('should respect validateReferences=false option', async () => {
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-nonexistent', companyId: 'comp-456' }
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: { exists: false } });

      // ACT: Disable reference validation - should not throw even if exists=false
      const results = await ModuleIntegrator.validateBatch(validations, { 
        validateReferences: false 
      });

      // ASSERT: Should succeed even though reference doesn't exist
      expect(results.customer1.exists).toBe(false);
      expect(Object.keys(results)).toHaveLength(1);
    });

    it('should work with both failFast=false and validateReferences=false', async () => {
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-456', companyId: 'comp-456' }
      ];

      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { exists: false } });

      const results = await ModuleIntegrator.validateBatch(validations, { 
        failFast: false, 
        validateReferences: false 
      });

      expect(Object.keys(results)).toHaveLength(2);
      expect(results.customer1.exists).toBe(false);
      expect(results.customer1.error).toBe('Network error');
      expect(results.service1.exists).toBe(false);
    });
  });

  describe('Sequential vs Parallel Execution Verification', () => {
    it('should execute validations sequentially, not in parallel', async () => {
      const validations = [
        { key: 'customer1', type: 'customer' as const, id: 'cust-123', companyId: 'comp-456' },
        { key: 'service1', type: 'service' as const, id: 'serv-789', companyId: 'comp-456' }
      ];

      let callOrder: string[] = [];

      mockedAxios.get
        .mockImplementation(async (url) => {
          if (url.includes('customers')) {
            callOrder.push('customer');
            // Add small delay to ensure sequential execution
            await new Promise(resolve => setTimeout(resolve, 10));
            return { data: { exists: true, customer: { id: 'cust-123' } } };
          } else if (url.includes('services')) {
            callOrder.push('service');
            return { data: { exists: true, service: { id: 'serv-789' } } };
          }
        });

      await ModuleIntegrator.validateBatch(validations);

      // Verify sequential execution order
      expect(callOrder).toEqual(['customer', 'service']);
    });
  });
});

describe('BatchValidationError Class', () => {
  it('should create error with correct properties', () => {
    const originalError = new Error('Original error message');
    const batchError = new BatchValidationError(
      'Batch validation failed at key \'test-key\'',
      'test-key',
      originalError,
      'customer'
    );

    expect(batchError.name).toBe('BatchValidationError');
    expect(batchError.message).toBe('Batch validation failed at key \'test-key\'');
    expect(batchError.failedValidationKey).toBe('test-key');
    expect(batchError.failedValidationType).toBe('customer');
    expect(batchError.originalError).toBe(originalError);
    expect(batchError).toBeInstanceOf(Error);
    expect(batchError).toBeInstanceOf(BatchValidationError);
  });
});