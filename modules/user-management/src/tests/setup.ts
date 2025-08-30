import { config } from '../utils/config';
import { prisma } from '../utils/database';
import { jest, beforeAll, afterAll } from '@jest/globals';

// Test configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nexus_user:nexus_password@localhost:5432/nexus_erp_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1'; // Use database 1 for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

// Disable email sending in tests
process.env.SMTP_HOST = '';
process.env.EMAIL_ENABLED = 'false';

// Setup global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Ensure database connection is established
  try {
    await prisma.$connect();
    console.log('✅ Database connected for testing');
  } catch (error) {
    console.error('❌ Failed to connect to test database:', error);
    process.exit(1);
  }
});

// Global test cleanup
afterAll(async () => {
  // Clean up test database
  try {
    // Delete all test data in reverse dependency order
    await prisma.auditLog.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.passwordResetRequest.deleteMany({});
    await prisma.emailVerification.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});
    
    await prisma.$disconnect();
    console.log('✅ Database disconnected after testing');
  } catch (error) {
    console.error('❌ Error during test cleanup:', error);
    process.exit(1);
  }
});

// Helper functions for tests
export const createTestCompany = async (overrides?: any) => {
  return await prisma.company.create({
    data: {
      name: 'Test Company',
      email: 'test@company.com',
      plan: 'basic',
      maxUsers: 5,
      ...overrides,
    },
  });
};

export const createTestUser = async (companyId: string, overrides?: any) => {
  const { AuthService } = require('../services/authService');
  
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: await AuthService.hashPassword('password123'),
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      companyId,
      ...overrides,
    },
  });
};

export const cleanupTestData = async () => {
  // Clean up all test data
  await prisma.auditLog.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.passwordResetRequest.deleteMany({});
  await prisma.emailVerification.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
};

// Mock email service for all tests
jest.mock('../services/emailService', () => ({
  emailService: {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendEmailVerification: jest.fn().mockResolvedValue(true),
    verifyConnection: jest.fn().mockResolvedValue(true),
  },
  createEmailService: jest.fn(() => ({
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendEmailVerification: jest.fn().mockResolvedValue(true),
    verifyConnection: jest.fn().mockResolvedValue(true),
  })),
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

export default {
  createTestCompany,
  createTestUser,
  cleanupTestData,
};