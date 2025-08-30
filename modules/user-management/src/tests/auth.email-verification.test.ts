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

describe('Email Verification Flow', () => {
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
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.emailVerification.deleteMany({});
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.company.delete({ where: { id: testCompany.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.emailVerification.deleteMany({});
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    jest.clearAllMocks();
  });

  describe('User Registration with Email Verification', () => {
    it('should create user with PENDING status and send verification email', async () => {
      const registrationData = {
        company: {
          name: 'New Test Company',
          email: 'newcompany@test.com',
        },
        admin: {
          email: 'admin@newcompany.com',
          password: 'securePassword123!',
          firstName: 'Admin',
          lastName: 'User',
        },
      };

      const response = await request(app)
        .post('/auth/register')
        .send(registrationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Verifique seu email');

      // Verify user was created with PENDING status
      const user = await prisma.user.findUnique({
        where: { email: registrationData.admin.email },
      });

      expect(user).toBeDefined();
      expect(user?.status).toBe('PENDING');
      expect(user?.emailVerified).toBe(false);

      // Verify email verification was sent
      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        registrationData.admin.email,
        `${registrationData.admin.firstName} ${registrationData.admin.lastName}`
      );

      // Verify verification record was created
      const verification = await prisma.emailVerification.findFirst({
        where: { email: registrationData.admin.email, isUsed: false },
      });

      expect(verification).toBeDefined();
      expect(verification?.expiresAt).toBeInstanceOf(Date);

      testUser = user; // Store for cleanup
    });

    it('should not allow login for unverified user', async () => {
      // Create unverified user
      testUser = await prisma.user.create({
        data: {
          email: 'unverified@example.com',
          password: await AuthService.hashPassword('password123'),
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          status: 'PENDING', // Not verified
          emailVerified: false,
          companyId: testCompany.id,
        },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('inativo');
    });
  });

  describe('GET /auth/verify-email/:token', () => {
    let verificationToken: string;

    beforeEach(async () => {
      // Create test user with PENDING status
      testUser = await prisma.user.create({
        data: {
          email: 'pending@example.com',
          password: await AuthService.hashPassword('password123'),
          firstName: 'Pending',
          lastName: 'User',
          role: 'USER',
          status: 'PENDING',
          emailVerified: false,
          companyId: testCompany.id,
        },
      });

      // Create verification token
      verificationToken = require('crypto').randomBytes(32).toString('hex');
      await prisma.emailVerification.create({
        data: {
          email: testUser.email,
          token: verificationToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });
    });

    it('should successfully verify email with valid token', async () => {
      const response = await request(app)
        .get(`/auth/verify-email/${verificationToken}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Email verificado com sucesso! Sua conta foi ativada.',
      });

      // Verify user status was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser?.status).toBe('ACTIVE');
      expect(updatedUser?.emailVerified).toBe(true);

      // Verify verification record was marked as used
      const verification = await prisma.emailVerification.findFirst({
        where: { token: verificationToken },
      });

      expect(verification?.isUsed).toBe(true);
    });

    it('should redirect to frontend for HTML requests', async () => {
      const response = await request(app)
        .get(`/auth/verify-email/${verificationToken}`)
        .set('Accept', 'text/html');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('email-verified?success=true');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/auth/verify-email/invalid-token')
        .set('Accept', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de verificação inválido ou expirado');
    });

    it('should reject expired token', async () => {
      // Create expired verification token
      const expiredToken = require('crypto').randomBytes(32).toString('hex');
      await prisma.emailVerification.create({
        data: {
          email: testUser.email,
          token: expiredToken,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      const response = await request(app)
        .get(`/auth/verify-email/${expiredToken}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de verificação inválido ou expirado');
    });

    it('should reject reused token', async () => {
      // Use token first time
      await request(app)
        .get(`/auth/verify-email/${verificationToken}`)
        .set('Accept', 'application/json');

      // Try to use same token again
      const response = await request(app)
        .get(`/auth/verify-email/${verificationToken}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Token de verificação inválido ou expirado');
    });
  });

  describe('POST /auth/resend-verification', () => {
    beforeEach(async () => {
      // Create test user with PENDING status
      testUser = await prisma.user.create({
        data: {
          email: 'pending@example.com',
          password: await AuthService.hashPassword('password123'),
          firstName: 'Pending',
          lastName: 'User',
          role: 'USER',
          status: 'PENDING',
          emailVerified: false,
          companyId: testCompany.id,
        },
      });
    });

    it('should resend verification email for unverified user', async () => {
      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify email was sent
      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        testUser.email,
        `${testUser.firstName} ${testUser.lastName}`
      );

      // Verify new verification record was created
      const verifications = await prisma.emailVerification.findMany({
        where: { email: testUser.email, isUsed: false },
      });

      expect(verifications.length).toBe(1);
    });

    it('should return success for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify no email was sent
      expect(emailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('should reject resend for already verified user', async () => {
      // Update user to verified status
      await prisma.user.update({
        where: { id: testUser.id },
        data: { emailVerified: true, status: 'ACTIVE' },
      });

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email já verificado');
    });

    it('should invalidate old verification requests', async () => {
      // Create old verification request
      await prisma.emailVerification.create({
        data: {
          email: testUser.email,
          token: 'old-token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: testUser.email });

      expect(response.status).toBe(200);

      // Verify old request was invalidated
      const oldVerification = await prisma.emailVerification.findFirst({
        where: { email: testUser.email, token: 'old-token' },
      });

      expect(oldVerification?.isUsed).toBe(true);

      // Verify new request exists
      const activeVerifications = await prisma.emailVerification.findMany({
        where: { email: testUser.email, isUsed: false },
      });

      expect(activeVerifications.length).toBe(1);
    });

    it('should enforce rate limiting', async () => {
      // Make multiple requests rapidly
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/auth/resend-verification')
          .send({ email: testUser.email })
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeLessThanOrEqual(2); // Rate limit is 2 per 5min
    });
  });

  describe('Complete Email Verification Flow', () => {
    it('should complete full email verification and login process', async () => {
      const userData = {
        email: 'complete@example.com',
        password: 'password123',
        firstName: 'Complete',
        lastName: 'User',
      };

      // Step 1: Create user with PENDING status
      testUser = await prisma.user.create({
        data: {
          email: userData.email,
          password: await AuthService.hashPassword(userData.password),
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'USER',
          status: 'PENDING',
          emailVerified: false,
          companyId: testCompany.id,
        },
      });

      // Step 2: Send verification email
      await AuthService.sendEmailVerification(
        userData.email,
        `${userData.firstName} ${userData.lastName}`
      );

      // Get verification token
      const verification = await prisma.emailVerification.findFirst({
        where: { email: userData.email, isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      expect(verification).toBeDefined();

      // Step 3: Verify email
      const verifyResponse = await request(app)
        .get(`/auth/verify-email/${verification!.token}`)
        .set('Accept', 'application/json');

      expect(verifyResponse.status).toBe(200);

      // Step 4: User should now be ACTIVE
      const activeUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(activeUser?.status).toBe('ACTIVE');
      expect(activeUser?.emailVerified).toBe(true);

      // Step 5: User should be able to login
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
    });
  });
});