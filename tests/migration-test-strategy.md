# Comprehensive Test Strategy: isActive → status Enum Migration

## Executive Summary

This document outlines a comprehensive test strategy for migrating the `isActive` boolean field to a `status` enum (`ACTIVE`, `INACTIVE`, `MAINTENANCE`) across the ERP Nexus application. Based on codebase analysis, this migration affects both frontend components and backend services.

## Migration Impact Analysis

### Current State Analysis

**Backend (Services Module)**
- Uses `ServiceStatus` enum: `'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'`
- Has backward compatibility mapping: `isActive = service.status === 'ACTIVE'`
- Database schema already supports full enum

**Frontend**
- Uses `ServiceStatus` type: `'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'`
- Some components still reference `isActive` for display logic
- DataTable component needs status rendering updates

## Test Categories & Scenarios

## 1. Unit Tests

### 1.1 Component Rendering Tests

#### Frontend Components
```typescript
// Service List Component Tests
describe('ServiceListComponent', () => {
  describe('Status Display', () => {
    it('should render ACTIVE status with green indicator', () => {
      const service = { status: 'ACTIVE', name: 'Test Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByTestId('status-indicator')).toHaveClass('bg-green-500');
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('should render INACTIVE status with red indicator', () => {
      const service = { status: 'INACTIVE', name: 'Test Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByTestId('status-indicator')).toHaveClass('bg-red-500');
      expect(screen.getByText('Inativo')).toBeInTheDocument();
    });

    it('should render MAINTENANCE status with yellow indicator', () => {
      const service = { status: 'MAINTENANCE', name: 'Test Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByTestId('status-indicator')).toHaveClass('bg-yellow-500');
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });

    it('should handle missing status gracefully', () => {
      const service = { name: 'Test Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByText('Status desconhecido')).toBeInTheDocument();
    });
  });

  describe('Backward Compatibility', () => {
    it('should render legacy isActive=true as ACTIVE status', () => {
      const service = { isActive: true, name: 'Legacy Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('should render legacy isActive=false as INACTIVE status', () => {
      const service = { isActive: false, name: 'Legacy Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByText('Inativo')).toBeInTheDocument();
    });

    it('should prioritize status over isActive when both present', () => {
      const service = { status: 'MAINTENANCE', isActive: true, name: 'Test Service' };
      render(<ServiceListItem service={service} />);
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });
  });
});

// Service Form Component Tests
describe('ServiceFormComponent', () => {
  describe('Status Selection', () => {
    it('should display all three status options in dropdown', () => {
      render(<ServiceForm />);
      fireEvent.click(screen.getByTestId('status-dropdown'));
      expect(screen.getByText('Ativo')).toBeInTheDocument();
      expect(screen.getByText('Inativo')).toBeInTheDocument();
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });

    it('should default to ACTIVE status for new services', () => {
      render(<ServiceForm />);
      expect(screen.getByDisplayValue('Ativo')).toBeInTheDocument();
    });

    it('should validate required status field', async () => {
      render(<ServiceForm />);
      fireEvent.click(screen.getByTestId('status-dropdown'));
      fireEvent.click(screen.getByText('Selecione...')); // Clear selection
      fireEvent.click(screen.getByTestId('submit-button'));
      await waitFor(() => {
        expect(screen.getByText('Status é obrigatório')).toBeInTheDocument();
      });
    });
  });
});

// DataTable Component Tests
describe('DataTableComponent', () => {
  describe('Status Column Rendering', () => {
    it('should render status badges correctly in table', () => {
      const services = [
        { id: '1', name: 'Service 1', status: 'ACTIVE' },
        { id: '2', name: 'Service 2', status: 'INACTIVE' },
        { id: '3', name: 'Service 3', status: 'MAINTENANCE' }
      ];
      render(<DataTable data={services} columns={serviceColumns} />);
      
      expect(screen.getByText('Ativo')).toBeInTheDocument();
      expect(screen.getByText('Inativo')).toBeInTheDocument();
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });

    it('should support status filtering', async () => {
      const services = generateMockServices(50);
      render(<DataTable data={services} columns={serviceColumns} filtering={true} />);
      
      fireEvent.click(screen.getByTestId('status-filter'));
      fireEvent.click(screen.getByText('Apenas Ativos'));
      
      await waitFor(() => {
        const visibleRows = screen.getAllByTestId('table-row');
        visibleRows.forEach(row => {
          expect(within(row).getByText('Ativo')).toBeInTheDocument();
        });
      });
    });

    it('should support status sorting', async () => {
      const services = generateMockServices(10);
      render(<DataTable data={services} columns={serviceColumns} />);
      
      fireEvent.click(screen.getByTestId('status-column-header'));
      
      await waitFor(() => {
        const statusCells = screen.getAllByTestId('status-cell');
        expect(statusCells[0]).toHaveTextContent('Ativo');
        expect(statusCells[statusCells.length - 1]).toHaveTextContent('Manutenção');
      });
    });
  });
});
```

#### Backend Service Tests
```typescript
// Service Service Tests
describe('ServiceService', () => {
  describe('Status Management', () => {
    it('should create service with ACTIVE status by default', async () => {
      const serviceData = {
        companyId: 'company-1',
        name: 'Test Service',
        price: 100,
        duration: 60
      };
      
      const service = await serviceService.createService(serviceData, 'user-1');
      
      expect(service.status).toBe('ACTIVE');
    });

    it('should update service status successfully', async () => {
      const service = await createTestService();
      
      const updated = await serviceService.updateService(
        service.id,
        { status: 'MAINTENANCE' },
        service.companyId,
        'user-1'
      );
      
      expect(updated.status).toBe('MAINTENANCE');
    });

    it('should filter services by status', async () => {
      await Promise.all([
        createTestService({ status: 'ACTIVE' }),
        createTestService({ status: 'INACTIVE' }),
        createTestService({ status: 'MAINTENANCE' })
      ]);
      
      const response = await serviceService.getServices(
        { companyId: 'company-1', status: 'ACTIVE' },
        { page: 1, limit: 10 }
      );
      
      expect(response.data).toHaveLength(1);
      expect(response.data[0].status).toBe('ACTIVE');
    });

    it('should provide backward compatibility mapping', async () => {
      const services = await createTestServices([
        { status: 'ACTIVE' },
        { status: 'INACTIVE' },
        { status: 'MAINTENANCE' }
      ]);
      
      const response = await serviceService.getServices(
        { companyId: 'company-1' },
        { page: 1, limit: 10 }
      );
      
      response.data.forEach(service => {
        expect(service.isActive).toBe(service.status === 'ACTIVE');
      });
    });
  });

  describe('Status Validation', () => {
    it('should validate status enum values', async () => {
      await expect(
        serviceService.updateService(
          'service-1',
          { status: 'INVALID_STATUS' as any },
          'company-1',
          'user-1'
        )
      ).rejects.toThrow('Invalid status value');
    });

    it('should handle null status gracefully', async () => {
      const service = await createTestService();
      
      await expect(
        serviceService.updateService(
          service.id,
          { status: null as any },
          service.companyId,
          'user-1'
        )
      ).rejects.toThrow('Status cannot be null');
    });
  });
});
```

### 1.2 State Management Tests

```typescript
// Services Hook Tests
describe('useServices', () => {
  describe('Status Filtering', () => {
    it('should filter services by status', async () => {
      const { result } = renderHook(() => useServices({
        status: 'ACTIVE'
      }));
      
      await waitFor(() => {
        expect(result.current.services).toBeDefined();
        result.current.services.forEach(service => {
          expect(service.status).toBe('ACTIVE');
        });
      });
    });

    it('should support multiple status filtering', async () => {
      const { result } = renderHook(() => useServices({
        statuses: ['ACTIVE', 'MAINTENANCE']
      }));
      
      await waitFor(() => {
        result.current.services.forEach(service => {
          expect(['ACTIVE', 'MAINTENANCE']).toContain(service.status);
        });
      });
    });
  });

  describe('Status Updates', () => {
    it('should update service status optimistically', async () => {
      const { result } = renderHook(() => useServices());
      
      await act(async () => {
        await result.current.updateService('service-1', { status: 'MAINTENANCE' });
      });
      
      const updatedService = result.current.services.find(s => s.id === 'service-1');
      expect(updatedService.status).toBe('MAINTENANCE');
    });

    it('should rollback on update failure', async () => {
      mockApiError();
      const { result } = renderHook(() => useServices());
      
      await act(async () => {
        try {
          await result.current.updateService('service-1', { status: 'MAINTENANCE' });
        } catch (error) {
          // Expected error
        }
      });
      
      const service = result.current.services.find(s => s.id === 'service-1');
      expect(service.status).toBe('ACTIVE'); // Rolled back
    });
  });
});
```

## 2. Integration Tests

### 2.1 API Request/Response Validation

```typescript
// API Integration Tests
describe('Services API Integration', () => {
  describe('Status Field Handling', () => {
    it('should create service with status field', async () => {
      const serviceData = {
        name: 'Test Service',
        status: 'ACTIVE',
        price: '100.00',
        duration: 60
      };
      
      const response = await api.post('/api/services', serviceData);
      
      expect(response.status).toBe(201);
      expect(response.data.status).toBe('ACTIVE');
      expect(response.data.isActive).toBe(true); // Backward compatibility
    });

    it('should update service status via API', async () => {
      const service = await createTestService();
      
      const response = await api.put(`/api/services/${service.id}`, {
        status: 'MAINTENANCE'
      });
      
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('MAINTENANCE');
      expect(response.data.isActive).toBe(false);
    });

    it('should filter services by status via API', async () => {
      await createTestServices([
        { status: 'ACTIVE' },
        { status: 'INACTIVE' }
      ]);
      
      const response = await api.get('/api/services?status=ACTIVE');
      
      expect(response.status).toBe(200);
      response.data.data.forEach(service => {
        expect(service.status).toBe('ACTIVE');
      });
    });

    it('should validate status enum in API requests', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: 'INVALID_STATUS',
        price: '100.00',
        duration: 60
      });
      
      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid status');
    });
  });

  describe('Backward Compatibility', () => {
    it('should accept legacy isActive field and convert to status', async () => {
      const response = await api.post('/api/services', {
        name: 'Legacy Service',
        isActive: true,
        price: '100.00',
        duration: 60
      });
      
      expect(response.status).toBe(201);
      expect(response.data.status).toBe('ACTIVE');
    });

    it('should return both status and isActive in response', async () => {
      const service = await createTestService({ status: 'MAINTENANCE' });
      
      const response = await api.get(`/api/services/${service.id}`);
      
      expect(response.data.status).toBe('MAINTENANCE');
      expect(response.data.isActive).toBe(false);
    });
  });
});
```

### 2.2 Database Persistence Verification

```typescript
// Database Integration Tests
describe('Database Status Persistence', () => {
  describe('Status Enum Storage', () => {
    it('should persist status enum values correctly', async () => {
      const service = await prisma.service.create({
        data: {
          companyId: 'company-1',
          name: 'Test Service',
          status: 'MAINTENANCE',
          price: 100,
          duration: 60
        }
      });
      
      const retrieved = await prisma.service.findUnique({
        where: { id: service.id }
      });
      
      expect(retrieved.status).toBe('MAINTENANCE');
    });

    it('should enforce status enum constraints', async () => {
      await expect(
        prisma.service.create({
          data: {
            companyId: 'company-1',
            name: 'Test Service',
            status: 'INVALID_STATUS' as any,
            price: 100,
            duration: 60
          }
        })
      ).rejects.toThrow();
    });

    it('should support status filtering in database queries', async () => {
      await Promise.all([
        createTestService({ status: 'ACTIVE' }),
        createTestService({ status: 'INACTIVE' }),
        createTestService({ status: 'MAINTENANCE' })
      ]);
      
      const activeServices = await prisma.service.findMany({
        where: {
          companyId: 'company-1',
          status: 'ACTIVE'
        }
      });
      
      expect(activeServices).toHaveLength(1);
      expect(activeServices[0].status).toBe('ACTIVE');
    });

    it('should support complex status queries', async () => {
      await createTestServices([
        { status: 'ACTIVE', name: 'Active 1' },
        { status: 'ACTIVE', name: 'Active 2' },
        { status: 'INACTIVE', name: 'Inactive 1' },
        { status: 'MAINTENANCE', name: 'Maintenance 1' }
      ]);
      
      const availableServices = await prisma.service.findMany({
        where: {
          companyId: 'company-1',
          status: {
            in: ['ACTIVE', 'MAINTENANCE']
          }
        }
      });
      
      expect(availableServices).toHaveLength(3);
    });
  });

  describe('Migration Data Integrity', () => {
    it('should maintain data consistency after migration', async () => {
      // Simulate pre-migration data
      const legacyData = [
        { name: 'Service 1', isActive: true },
        { name: 'Service 2', isActive: false }
      ];
      
      // Run migration simulation
      await runStatusMigration();
      
      // Verify post-migration data
      const services = await prisma.service.findMany({
        where: { companyId: 'company-1' }
      });
      
      const service1 = services.find(s => s.name === 'Service 1');
      const service2 = services.find(s => s.name === 'Service 2');
      
      expect(service1.status).toBe('ACTIVE');
      expect(service2.status).toBe('INACTIVE');
    });
  });
});
```

### 2.3 Error Handling

```typescript
// Error Handling Tests
describe('Status Migration Error Handling', () => {
  describe('API Error Responses', () => {
    it('should return proper error for invalid status values', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: 'UNKNOWN_STATUS',
        price: '100.00'
      });
      
      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        success: false,
        error: 'Invalid status value',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should handle database constraint violations', async () => {
      mockDatabaseError('ENUM_CONSTRAINT_VIOLATION');
      
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: 'INVALID',
        price: '100.00'
      });
      
      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid status');
    });
  });

  describe('Frontend Error Handling', () => {
    it('should display user-friendly error for invalid status', async () => {
      mockApiError(400, { error: 'Invalid status value' });
      
      render(<ServiceForm />);
      
      fireEvent.change(screen.getByTestId('status-input'), {
        target: { value: 'INVALID' }
      });
      
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByText('Status inválido. Selecione uma opção válida.')).toBeInTheDocument();
      });
    });

    it('should recover gracefully from status update failures', async () => {
      const { result } = renderHook(() => useServices());
      
      mockApiError(500, { error: 'Server error' });
      
      await act(async () => {
        try {
          await result.current.updateService('service-1', { status: 'MAINTENANCE' });
        } catch (error) {
          // Expected
        }
      });
      
      // Should maintain original status
      const service = result.current.services.find(s => s.id === 'service-1');
      expect(service.status).toBe('ACTIVE');
      
      // Should show error message
      expect(result.current.error).toBeDefined();
    });
  });
});
```

## 3. Regression Tests

### 3.1 Existing Services Display

```typescript
// Regression Tests
describe('Services Display Regression', () => {
  describe('Existing Service Compatibility', () => {
    it('should display existing services correctly after migration', async () => {
      // Setup pre-migration services
      const existingServices = await createLegacyServices([
        { name: 'Legacy Active', isActive: true },
        { name: 'Legacy Inactive', isActive: false }
      ]);
      
      render(<ServicesList />);
      
      await waitFor(() => {
        expect(screen.getByText('Legacy Active')).toBeInTheDocument();
        expect(screen.getByText('Legacy Inactive')).toBeInTheDocument();
        
        // Should show status based on isActive
        expect(screen.getByText('Ativo')).toBeInTheDocument();
        expect(screen.getByText('Inativo')).toBeInTheDocument();
      });
    });

    it('should maintain filtering functionality', async () => {
      await createMixedServices();
      
      render(<ServicesList />);
      
      // Filter by active
      fireEvent.click(screen.getByTestId('active-filter'));
      
      await waitFor(() => {
        const serviceRows = screen.getAllByTestId('service-row');
        serviceRows.forEach(row => {
          expect(within(row).queryByText('Inativo')).not.toBeInTheDocument();
        });
      });
    });

    it('should maintain search functionality', async () => {
      await createTestServices([
        { name: 'Corte de Cabelo', status: 'ACTIVE' },
        { name: 'Manicure', status: 'INACTIVE' },
        { name: 'Pedicure', status: 'MAINTENANCE' }
      ]);
      
      render(<ServicesList />);
      
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'Corte' }
      });
      
      await waitFor(() => {
        expect(screen.getByText('Corte de Cabelo')).toBeInTheDocument();
        expect(screen.queryByText('Manicure')).not.toBeInTheDocument();
      });
    });
  });

  describe('Service Form Compatibility', () => {
    it('should edit existing services without breaking', async () => {
      const service = await createTestService({
        name: 'Test Service',
        status: 'ACTIVE'
      });
      
      render(<ServiceForm serviceId={service.id} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Service')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Ativo')).toBeInTheDocument();
      });
      
      // Update status
      fireEvent.click(screen.getByTestId('status-dropdown'));
      fireEvent.click(screen.getByText('Manutenção'));
      fireEvent.click(screen.getByTestId('save-button'));
      
      await waitFor(() => {
        expect(screen.getByText('Serviço atualizado com sucesso')).toBeInTheDocument();
      });
    });
  });
});
```

### 3.2 Legacy Data Compatibility

```typescript
// Legacy Data Tests
describe('Legacy Data Compatibility', () => {
  describe('isActive Field Support', () => {
    it('should handle services with only isActive field', async () => {
      const legacyService = {
        id: 'legacy-1',
        name: 'Legacy Service',
        isActive: true,
        price: '100.00',
        duration: 60
      };
      
      render(<ServiceCard service={legacyService} />);
      
      expect(screen.getByText('Ativo')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge')).toHaveClass('bg-green-500');
    });

    it('should handle mixed data scenarios', async () => {
      const mixedServices = [
        { id: '1', name: 'New Service', status: 'MAINTENANCE' },
        { id: '2', name: 'Legacy Service', isActive: true },
        { id: '3', name: 'Complete Service', status: 'ACTIVE', isActive: true }
      ];
      
      render(<ServicesList services={mixedServices} />);
      
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
      expect(screen.getAllByText('Ativo')).toHaveLength(2);
    });
  });

  describe('Data Migration Validation', () => {
    it('should validate data consistency after migration', async () => {
      const preMigrationData = await getAllServices();
      await runStatusMigration();
      const postMigrationData = await getAllServices();
      
      expect(postMigrationData).toHaveLength(preMigrationData.length);
      
      postMigrationData.forEach((service, index) => {
        const original = preMigrationData[index];
        
        // Verify status mapping
        if (original.isActive === true) {
          expect(service.status).toBe('ACTIVE');
        } else if (original.isActive === false) {
          expect(service.status).toBe('INACTIVE');
        }
        
        // Verify backward compatibility
        expect(service.isActive).toBe(service.status === 'ACTIVE');
      });
    });
  });
});
```

### 3.3 UI Behavior Consistency

```typescript
// UI Consistency Tests
describe('UI Behavior Consistency', () => {
  describe('Status Display Consistency', () => {
    it('should display status consistently across components', async () => {
      const service = { id: '1', name: 'Test', status: 'MAINTENANCE' };
      
      const { rerender } = render(<ServiceCard service={service} />);
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
      
      rerender(<ServiceListItem service={service} />);
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
      
      rerender(<ServiceBadge status={service.status} />);
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });

    it('should maintain color coding consistency', async () => {
      const statuses = [
        { status: 'ACTIVE', color: 'bg-green-500' },
        { status: 'INACTIVE', color: 'bg-red-500' },
        { status: 'MAINTENANCE', color: 'bg-yellow-500' }
      ];
      
      statuses.forEach(({ status, color }) => {
        render(<StatusBadge status={status} />);
        expect(screen.getByTestId('status-indicator')).toHaveClass(color);
        cleanup();
      });
    });
  });

  describe('Form Behavior Consistency', () => {
    it('should maintain form validation behavior', async () => {
      render(<ServiceForm />);
      
      // Submit without status
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByText('Status é obrigatório')).toBeInTheDocument();
      });
      
      // Select status and submit
      fireEvent.click(screen.getByTestId('status-dropdown'));
      fireEvent.click(screen.getByText('Ativo'));
      
      await waitFor(() => {
        expect(screen.queryByText('Status é obrigatório')).not.toBeInTheDocument();
      });
    });
  });
});
```

## 4. Edge Cases & Validation

### 4.1 Invalid Enum Values

```typescript
// Edge Case Tests
describe('Status Enum Edge Cases', () => {
  describe('Invalid Values', () => {
    it('should reject invalid status values in API', async () => {
      const invalidStatuses = [
        'ENABLED', 'DISABLED', 'PENDING', 'ARCHIVED', '', null, undefined
      ];
      
      for (const status of invalidStatuses) {
        const response = await api.post('/api/services', {
          name: 'Test Service',
          status,
          price: '100.00',
          duration: 60
        });
        
        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Invalid status');
      }
    });

    it('should handle case-sensitive status values', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: 'active', // lowercase
        price: '100.00',
        duration: 60
      });
      
      expect(response.status).toBe(400);
    });

    it('should validate status in frontend forms', async () => {
      render(<ServiceForm />);
      
      // Try to manually enter invalid status
      const statusInput = screen.getByTestId('status-input');
      fireEvent.change(statusInput, { target: { value: 'INVALID' } });
      fireEvent.blur(statusInput);
      
      await waitFor(() => {
        expect(screen.getByText('Status inválido')).toBeInTheDocument();
      });
    });
  });

  describe('Null/Undefined Values', () => {
    it('should handle missing status field gracefully', () => {
      const service = { id: '1', name: 'Test Service' };
      
      render(<ServiceCard service={service} />);
      
      expect(screen.getByText('Status não definido')).toBeInTheDocument();
    });

    it('should default to ACTIVE for new services', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        price: '100.00',
        duration: 60
        // No status provided
      });
      
      expect(response.data.status).toBe('ACTIVE');
    });
  });

  describe('Type Conversion Edge Cases', () => {
    it('should handle status as number', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: 1, // Number instead of string
        price: '100.00'
      });
      
      expect(response.status).toBe(400);
    });

    it('should handle status as boolean', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        status: true, // Boolean instead of string
        price: '100.00'
      });
      
      expect(response.status).toBe(400);
    });
  });
});
```

### 4.2 Missing Status Field

```typescript
// Missing Field Tests
describe('Missing Status Field Handling', () => {
  describe('Database Layer', () => {
    it('should require status field in database', async () => {
      await expect(
        prisma.service.create({
          data: {
            companyId: 'company-1',
            name: 'Test Service',
            price: 100,
            duration: 60
            // No status field
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('API Layer', () => {
    it('should provide default status when not specified', async () => {
      const response = await api.post('/api/services', {
        name: 'Test Service',
        price: '100.00',
        duration: 60
      });
      
      expect(response.data.status).toBe('ACTIVE');
    });
  });

  describe('Frontend Layer', () => {
    it('should display placeholder for missing status', () => {
      const service = { id: '1', name: 'Test' };
      
      render(<ServiceCard service={service} />);
      
      expect(screen.getByText('Status não informado')).toBeInTheDocument();
    });

    it('should validate required status in forms', async () => {
      render(<ServiceForm />);
      
      // Clear default status
      fireEvent.click(screen.getByTestId('status-dropdown'));
      fireEvent.click(screen.getByText('Selecione...'));
      
      fireEvent.click(screen.getByTestId('submit-button'));
      
      await waitFor(() => {
        expect(screen.getByText('Status é obrigatório')).toBeInTheDocument();
      });
    });
  });
});
```

### 4.3 Migration Scenarios

```typescript
// Migration Scenario Tests
describe('Migration Scenario Tests', () => {
  describe('Data Transformation', () => {
    it('should migrate isActive=true to ACTIVE status', async () => {
      const legacyData = {
        id: 'service-1',
        name: 'Legacy Service',
        isActive: true,
        price: 100
      };
      
      const migrated = await migrateServiceStatus(legacyData);
      
      expect(migrated.status).toBe('ACTIVE');
      expect(migrated.isActive).toBe(true);
    });

    it('should migrate isActive=false to INACTIVE status', async () => {
      const legacyData = {
        id: 'service-1',
        name: 'Legacy Service',
        isActive: false,
        price: 100
      };
      
      const migrated = await migrateServiceStatus(legacyData);
      
      expect(migrated.status).toBe('INACTIVE');
      expect(migrated.isActive).toBe(false);
    });

    it('should handle bulk migration', async () => {
      const legacyServices = [
        { id: '1', isActive: true },
        { id: '2', isActive: false },
        { id: '3', isActive: true }
      ];
      
      const migrated = await bulkMigrateServices(legacyServices);
      
      expect(migrated[0].status).toBe('ACTIVE');
      expect(migrated[1].status).toBe('INACTIVE');
      expect(migrated[2].status).toBe('ACTIVE');
    });
  });

  describe('Rollback Scenarios', () => {
    it('should support rollback from status to isActive', async () => {
      const modernData = {
        id: 'service-1',
        name: 'Modern Service',
        status: 'MAINTENANCE'
      };
      
      const rolledBack = await rollbackToIsActive(modernData);
      
      expect(rolledBack.isActive).toBe(false); // MAINTENANCE maps to false
    });
  });
});
```

## Test Data Fixtures & Mock Scenarios

### Test Data Setup
```typescript
// Test Fixtures
export const serviceFixtures = {
  active: {
    id: 'service-active',
    name: 'Active Service',
    status: 'ACTIVE' as ServiceStatus,
    price: '100.00',
    duration: 60,
    isActive: true
  },
  
  inactive: {
    id: 'service-inactive',
    name: 'Inactive Service',
    status: 'INACTIVE' as ServiceStatus,
    price: '75.00',
    duration: 45,
    isActive: false
  },
  
  maintenance: {
    id: 'service-maintenance',
    name: 'Maintenance Service',
    status: 'MAINTENANCE' as ServiceStatus,
    price: '150.00',
    duration: 90,
    isActive: false
  },
  
  legacy: {
    id: 'service-legacy',
    name: 'Legacy Service',
    isActive: true,
    price: '50.00',
    duration: 30
  }
};

export const createTestServices = async (count = 10) => {
  const services = [];
  for (let i = 0; i < count; i++) {
    const status = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'][i % 3];
    services.push(await createTestService({ status }));
  }
  return services;
};
```

### Mock API Responses
```typescript
// Mock API Setup
export const mockApiResponses = {
  getServices: {
    success: true,
    data: [serviceFixtures.active, serviceFixtures.maintenance],
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 }
  },
  
  createService: {
    success: true,
    data: serviceFixtures.active
  },
  
  updateServiceStatus: {
    success: true,
    data: { ...serviceFixtures.active, status: 'MAINTENANCE' }
  },
  
  validationError: {
    success: false,
    error: 'Invalid status value',
    code: 'VALIDATION_ERROR'
  }
};
```

## Test Execution Strategy

### Test Environment Setup
1. **Unit Tests**: Jest + React Testing Library
2. **Integration Tests**: Supertest + Test Database
3. **E2E Tests**: Playwright/Cypress
4. **Performance Tests**: Artillery/K6

### Test Data Management
- Clean database before each test suite
- Use transactions for test isolation
- Seed consistent test data
- Mock external dependencies

### Coverage Requirements
- **Unit Tests**: >90% code coverage
- **Integration Tests**: All API endpoints
- **Regression Tests**: Critical user flows
- **Edge Cases**: All enum validation paths

### Execution Pipeline
```bash
# Unit tests
npm test -- --coverage --passWithNoTests

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

## Validation Criteria

### Success Criteria
- ✅ All three status values render correctly
- ✅ Backward compatibility maintained
- ✅ Form validation works properly
- ✅ API responses include both fields
- ✅ Database constraints enforced
- ✅ Error handling covers edge cases
- ✅ Migration preserves data integrity

### Performance Criteria
- API response time <200ms
- UI renders status within 100ms
- Database queries optimized
- Memory usage stable

### Quality Gates
- Zero breaking changes to existing functionality
- All error scenarios handled gracefully
- User experience remains consistent
- Data integrity maintained throughout migration

This comprehensive test strategy ensures a robust migration from `isActive` to `status` enum while maintaining backward compatibility and system reliability.