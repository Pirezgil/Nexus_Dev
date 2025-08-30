import request from 'supertest';
import { app } from '../app'; // Assuming app is exported from main app file
import { prisma } from '../utils/database';
import { AuthService } from '../services/authService';
import { emailService } from '../services/emailService';

// Mock email service to prevent actual emails during testing
jest.mock('../services/emailService', () => ({
  emailService: {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendEmailVerification: jest.fn().mockResolvedValue(true),
    verifyConnection: jest.fn().mockResolvedValue(true),
  },
}));

describe('Password Reset Flow', () => {
  let testUser: any;
  let testCompany: any;

  beforeAll(async () => {
    // Create test company
    testCompany = await prisma.company.create({
      data: {
        name: 'Test Company',
        email: 'test@company.com',
        plan: 'basic',
        maxUsers: 5,
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        password: await AuthService.hashPassword('password123'),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        companyId: testCompany.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.passwordResetRequest.deleteMany({
      where: { email: testUser.email },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.company.delete({ where: { id: testCompany.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear any existing password reset requests
    await prisma.passwordResetRequest.deleteMany({
      where: { email: testUser.email },
    });
    jest.clearAllMocks();
  });

  describe('POST /auth/forgot-password', () => {
    it('should successfully initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir sua senha',
      });

      // Verify password reset request was created
      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: { email: testUser.email, isUsed: false },
      });

      expect(resetRequest).toBeDefined();
      expect(resetRequest?.expiresAt).toBeInstanceOf(Date);

      // Verify email was sent
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        testUser.email,
        expect.any(String),
        `${testUser.firstName} ${testUser.lastName}`
      );
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify no reset request was created
      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: { email: 'nonexistent@example.com' },
      });

      expect(resetRequest).toBeNull();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should invalidate previous reset requests', async () => {
      // Create first reset request
      await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      const firstRequest = await prisma.passwordResetRequest.findFirst({
        where: { email: testUser.email, isUsed: false },
      });

      expect(firstRequest).toBeDefined();

      // Create second reset request
      await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      // First request should now be marked as used
      const updatedFirstRequest = await prisma.passwordResetRequest.findUnique({
        where: { id: firstRequest!.id },
      });

      expect(updatedFirstRequest?.isUsed).toBe(true);

      // New request should exist and be unused
      const activeRequests = await prisma.passwordResetRequest.findMany({
        where: { email: testUser.email, isUsed: false },
      });

      expect(activeRequests).toHaveLength(1);
    });

    it('should enforce rate limiting', async () => {
      // Make multiple requests rapidly
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send({ email: testUser.email })
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeLessThanOrEqual(3); // Rate limit is 3 per 15min
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken: string;
    let hashedToken: string;

    beforeEach(async () => {
      // Create a valid reset request
      const crypto = require('crypto');
      resetToken = crypto.randomBytes(32).toString('hex');
      hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      await prisma.passwordResetRequest.create({
        data: {
          email: testUser.email,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });
    });

    it('should successfully reset password with valid token', async () => {
      const newPassword = 'newPassword123!';

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Senha redefinida com sucesso',
      });

      // Verify password was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      const isPasswordValid = await AuthService.verifyPassword(
        newPassword,
        updatedUser!.password
      );
      expect(isPasswordValid).toBe(true);

      // Verify reset request was marked as used
      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: { token: hashedToken },
      });

      expect(resetRequest?.isUsed).toBe(true);

      // Verify all user sessions were revoked
      const activeSessions = await prisma.session.findMany({
        where: { userId: testUser.id, isRevoked: false },
      });

      expect(activeSessions).toHaveLength(0);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de redefinição inválido ou expirado');
    });

    it('should reject expired token', async () => {
      // Create expired reset request
      const expiredToken = require('crypto').randomBytes(32).toString('hex');
      const expiredHashedToken = require('crypto').createHash('sha256').update(expiredToken).digest('hex');

      await prisma.passwordResetRequest.create({
        data: {
          email: testUser.email,
          token: expiredHashedToken,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: expiredToken,
          password: 'newPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de redefinição inválido ou expirado');
    });

    it('should reject reused token', async () => {
      const newPassword = 'newPassword123!';

      // Use token first time
      await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
        });

      // Try to use same token again
      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: 'anotherPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de redefinição inválido ou expirado');
    });

    it('should validate password strength', async () => {
      const weakPassword = '123';

      const response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          password: weakPassword,
        });

      // Assuming password validation is implemented in validation middleware
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('senha');
    });
  });

  describe('Complete Password Reset Flow', () => {
    it('should complete full password reset process', async () => {
      const newPassword = 'newSecurePassword123!';

      // Step 1: Request password reset
      const forgotResponse = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      expect(forgotResponse.status).toBe(200);

      // Get the reset token from database (in real scenario, user gets it from email)
      const resetRequest = await prisma.passwordResetRequest.findFirst({
        where: { email: testUser.email, isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      expect(resetRequest).toBeDefined();

      // Reverse the hash to simulate getting token from email
      // In real scenario, we would use the original token sent in email
      const crypto = require('crypto');
      
      // Since we can't reverse the hash, we'll create our own token for testing
      const testToken = crypto.randomBytes(32).toString('hex');
      const testHashedToken = crypto.createHash('sha256').update(testToken).digest('hex');

      // Update the reset request with our test token
      await prisma.passwordResetRequest.update({
        where: { id: resetRequest!.id },
        data: { token: testHashedToken },
      });

      // Step 2: Reset password using token
      const resetResponse = await request(app)
        .post('/auth/reset-password')
        .send({
          token: testToken,
          password: newPassword,
        });

      expect(resetResponse.status).toBe(200);

      // Step 3: Verify can login with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();

      // Step 4: Verify old password doesn't work
      const oldPasswordLoginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'password123', // Original password
        });

      expect(oldPasswordLoginResponse.status).toBe(401);
    });
  });
});