import { jest } from '@jest/globals';
import { CustomerService } from '../../modules/crm/src/services/customerService';
import { CreateCustomerData, UpdateCustomerData, NotFoundError } from '../../modules/crm/src/types';

// Mock do prisma
const mockPrismaCustomer = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaCustomerInteraction = {
  create: jest.fn(),
  findMany: jest.fn(),
};

const mockPrismaCustomerNote = {
  findMany: jest.fn(),
};

const mockPrisma = {
  customer: mockPrismaCustomer,
  customerInteraction: mockPrismaCustomerInteraction,
  customerNote: mockPrismaCustomerNote,
};

// Mock do redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

// Mock do logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

// Substituir as importações
jest.unstable_mockModule('../../modules/crm/src/utils/database', () => ({
  prisma: mockPrisma,
}));

jest.unstable_mockModule('../../modules/crm/src/utils/redis', () => ({
  redis: mockRedis,
}));

jest.unstable_mockModule('../../modules/crm/src/utils/logger', () => ({
  logger: mockLogger,
}));

describe('CustomerService - Auditoria Campos', () => {
  let customerService: CustomerService;
  const mockCompanyId = 'company-123';
  const mockUserId = 'user-456';
  const mockCustomerId = 'customer-789';

  beforeEach(() => {
    customerService = new CustomerService();
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    const mockCreateData: CreateCustomerData = {
      name: 'João da Silva',
      email: 'joao@email.com',
      phone: '11999999999',
      status: 'ACTIVE' as any,
    };

    const mockCreatedCustomer = {
      id: mockCustomerId,
      companyId: mockCompanyId,
      ...mockCreateData,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: [],
      interactions: [],
    };

    test('deve incluir o campo createdBy na criação do cliente', async () => {
      // Arrange
      mockPrismaCustomer.findFirst.mockResolvedValue(null); // Não existe duplicata
      mockPrismaCustomer.create.mockResolvedValue(mockCreatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.createCustomer(mockCreateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockPrismaCustomer.create).toHaveBeenCalledWith({
        data: {
          ...mockCreateData,
          companyId: mockCompanyId,
          createdBy: mockUserId, // Verificar se o campo foi incluído
        },
        include: {
          notes: true,
          interactions: true,
        },
      });
    });

    test('deve criar uma interação inicial com o usuário correto', async () => {
      // Arrange
      mockPrismaCustomer.findFirst.mockResolvedValue(null);
      mockPrismaCustomer.create.mockResolvedValue(mockCreatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.createCustomer(mockCreateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockPrismaCustomerInteraction.create).toHaveBeenCalledWith({
        data: {
          customerId: mockCustomerId,
          companyId: mockCompanyId,
          type: 'NOTE',
          title: 'Cliente cadastrado',
          description: 'Cliente cadastrado no sistema',
          createdBy: mockUserId, // Verificar se o usuário foi passado corretamente
        },
      });
    });

    test('deve invalidar caches após criação', async () => {
      // Arrange
      mockPrismaCustomer.findFirst.mockResolvedValue(null);
      mockPrismaCustomer.create.mockResolvedValue(mockCreatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.createCustomer(mockCreateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:customer:${mockCustomerId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:customer_tags:${mockCompanyId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:stats:${mockCompanyId}`);
    });
  });

  describe('updateCustomer', () => {
    const mockUpdateData: UpdateCustomerData = {
      name: 'João Silva Atualizado',
      phone: '11888888888',
    };

    const mockExistingCustomer = {
      id: mockCustomerId,
      companyId: mockCompanyId,
      name: 'João da Silva',
      email: 'joao@email.com',
      phone: '11999999999',
      document: null,
    };

    const mockUpdatedCustomer = {
      ...mockExistingCustomer,
      ...mockUpdateData,
      updatedAt: new Date(),
      notes: [],
      interactions: [],
    };

    test('deve incluir o campo updatedBy na atualização do cliente', async () => {
      // Arrange
      mockPrismaCustomer.findFirst
        .mockResolvedValueOnce(mockExistingCustomer) // Primeira chamada: cliente existe
        .mockResolvedValueOnce(null); // Segunda chamada: sem duplicata de email
      mockPrismaCustomer.update.mockResolvedValue(mockUpdatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.updateCustomer(mockCustomerId, mockUpdateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockPrismaCustomer.update).toHaveBeenCalledWith({
        where: { id: mockCustomerId },
        data: {
          ...mockUpdateData,
          updatedBy: mockUserId, // Verificar se o campo foi incluído
        },
        include: {
          notes: {
            orderBy: { createdAt: 'desc' },
          },
          interactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    test('deve criar uma interação de atualização com o usuário correto', async () => {
      // Arrange
      mockPrismaCustomer.findFirst
        .mockResolvedValueOnce(mockExistingCustomer)
        .mockResolvedValueOnce(null);
      mockPrismaCustomer.update.mockResolvedValue(mockUpdatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.updateCustomer(mockCustomerId, mockUpdateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockPrismaCustomerInteraction.create).toHaveBeenCalledWith({
        data: {
          customerId: mockCustomerId,
          companyId: mockCompanyId,
          type: 'NOTE',
          title: 'Cliente atualizado',
          description: 'Dados do cliente foram atualizados',
          createdBy: mockUserId, // Verificar se o usuário foi passado corretamente
        },
      });
    });

    test('deve lançar NotFoundError ao tentar atualizar cliente inexistente', async () => {
      // Arrange
      mockPrismaCustomer.findFirst.mockResolvedValue(null); // Cliente não existe

      // Act & Assert
      await expect(
        customerService.updateCustomer(mockCustomerId, mockUpdateData, mockCompanyId, mockUserId)
      ).rejects.toThrow(NotFoundError);
      await expect(
        customerService.updateCustomer(mockCustomerId, mockUpdateData, mockCompanyId, mockUserId)
      ).rejects.toThrow('Cliente não encontrado');

      // Verificar que o método update não foi chamado
      expect(mockPrismaCustomer.update).not.toHaveBeenCalled();
    });

    test('deve invalidar caches após atualização', async () => {
      // Arrange
      mockPrismaCustomer.findFirst
        .mockResolvedValueOnce(mockExistingCustomer)
        .mockResolvedValueOnce(null);
      mockPrismaCustomer.update.mockResolvedValue(mockUpdatedCustomer);
      mockPrismaCustomerInteraction.create.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(true);

      // Act
      await customerService.updateCustomer(mockCustomerId, mockUpdateData, mockCompanyId, mockUserId);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:customer:${mockCustomerId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:customer_tags:${mockCompanyId}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`crm:stats:${mockCompanyId}`);
    });
  });

  describe('preservação de comportamento existente', () => {
    test('outros métodos devem continuar funcionando normalmente', async () => {
      // Arrange
      const mockCustomer = {
        id: mockCustomerId,
        companyId: mockCompanyId,
        name: 'João da Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        status: 'ACTIVE',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [],
        interactions: [],
        _count: { notes: 0, interactions: 0 },
      };

      mockPrismaCustomer.findFirst.mockResolvedValue(mockCustomer);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      // Act
      const result = await customerService.getCustomerById(mockCustomerId, mockCompanyId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockCustomerId);
      expect(result.name).toBe('João da Silva');
      expect(mockPrismaCustomer.findFirst).toHaveBeenCalledWith({
        where: { id: mockCustomerId, companyId: mockCompanyId },
        include: {
          notes: { orderBy: { createdAt: 'desc' } },
          interactions: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  });
});