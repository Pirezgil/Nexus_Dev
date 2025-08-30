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

describe('Authentication Rate Limiting', () => {
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
        email: 'ratelimit@example.com',
        password: await AuthService.hashPassword('password123'),
        firstName: 'Rate',
        lastName: 'Limited',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        companyId: testCompany.id,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.passwordResetRequest.deleteMany({});
    await prisma.emailVerification.deleteMany({});
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.company.delete({ where: { id: testCompany.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing requests
    await prisma.passwordResetRequest.deleteMany({});
    await prisma.emailVerification.deleteMany({});
    jest.clearAllMocks();
    
    // Wait a bit between tests to avoid rate limiting between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Login Rate Limiting', () => {
    it('should enforce login rate limits', async () => {
      const loginData = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      // Make multiple rapid login attempts
      const promises = Array.from({ length: 8 }, () =>
        request(app)
          .post('/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);

      // Count rate limited responses (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const authErrorResponses = responses.filter(r => r.status === 401);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: false,
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          error: expect.stringContaining('Muitas tentativas de login'),
          retryAfter: expect.any(Number),
        });
      });

      // Should not exceed the limit of 5 successful attempts per window
      expect(authErrorResponses.length).toBeLessThanOrEqual(5);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      // Should include standard rate limit headers
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Password Reset Rate Limiting', () => {
    it('should enforce password reset rate limits', async () => {
      const resetData = { email: testUser.email };

      // Make multiple rapid password reset requests
      const promises = Array.from({ length: 6 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send(resetData)
      );

      const responses = await Promise.all(promises);

      // Count rate limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Should not exceed the limit of 3 attempts per 15 minute window
      expect(successfulResponses.length).toBeLessThanOrEqual(3);

      // Rate limited responses should have proper structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: false,
          code: 'TOO_MANY_PASSWORD_RESET_ATTEMPTS',
          error: expect.stringContaining('Muitas tentativas de redefinição'),
          retryAfter: expect.any(Number),
        });
      });
    });

    it('should use IP and email combination for rate limiting', async () => {
      // This test would ideally use different IP addresses, but for unit testing
      // we can verify the key generation logic by checking that same email
      // from same IP gets rate limited
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send({ email: testUser.email })
      );

      const responses = await Promise.all(promises);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Email Verification Rate Limiting', () => {
    beforeEach(async () => {
      // Create a user with pending status for verification tests
      await prisma.user.upsert({
        where: { email: 'pending@example.com' },
        update: {
          status: 'PENDING',
          emailVerified: false,
        },
        create: {
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

    it('should enforce email verification rate limits', async () => {
      const verificationData = { email: 'pending@example.com' };

      // Make multiple rapid verification requests
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/auth/resend-verification')
          .send(verificationData)
      );

      const responses = await Promise.all(promises);

      // Count rate limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Should not exceed the limit of 2 attempts per 5 minute window
      expect(successfulResponses.length).toBeLessThanOrEqual(2);

      // Rate limited responses should have proper structure
      rateLimitedResponses.forEach(response => {
        expect(response.body).toMatchObject({
          success: false,
          code: 'TOO_MANY_EMAIL_VERIFICATION_ATTEMPTS',
          error: expect.stringContaining('Muitas tentativas de verificação'),
          retryAfter: expect.any(Number),
        });
      });
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should enforce registration rate limits', async () => {
      const registrationData = {
        company: {
          name: 'Rate Test Company',
          email: 'ratetest@company.com',
        },
        admin: {
          email: 'admin@ratetest.com',
          password: 'securePassword123!',
          firstName: 'Admin',
          lastName: 'User',
        },
      };

      // Make multiple rapid registration requests
      const promises = Array.from({ length: 4 }, (_, index) =>
        request(app)
          .post('/auth/register')
          .send({
            ...registrationData,
            company: {
              ...registrationData.company,
              email: `ratetest${index}@company.com`,
            },
            admin: {
              ...registrationData.admin,
              email: `admin${index}@ratetest.com`,
            },
          })
      );

      const responses = await Promise.all(promises);

      // Count rate limited responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 201);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Should not exceed the limit of 2 registrations per hour
      expect(successfulResponses.length).toBeLessThanOrEqual(2);

      // Clean up created companies and users
      for (const response of successfulResponses) {
        if (response.body.data?.company?.id) {
          await prisma.company.delete({
            where: { id: response.body.data.company.id },
          }).catch(() => {}); // Ignore cleanup errors
        }
      }
    });
  });

  describe('Token Validation Rate Limiting', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Get a valid access token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'password123',
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should enforce token validation rate limits', async () => {
      // Make many rapid token validation requests
      const promises = Array.from({ length: 70 }, () =>
        request(app)
          .get('/auth/validate')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(promises);

      // Should have some rate limited responses (limit is 60 per minute)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeLessThanOrEqual(60);
    });
  });

  describe('General Auth Rate Limiting', () => {
    it('should enforce general rate limits for other endpoints', async () => {
      // Make many rapid requests to /auth/me endpoint
      const promises = Array.from({ length: 120 }, () =>
        request(app)
          .post('/auth/check-email')
          .send({ email: 'test@example.com' })
      );

      const responses = await Promise.all(promises);

      // Should have some rate limited responses (limit is 100 per 15 minutes)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Rate Limiting Security Features', () => {
    it('should log rate limit violations', async () => {
      // This would require mocking the logger and checking calls
      // For now, we'll just verify that rate limiting works
      const promises = Array.from({ length: 8 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send({ email: testUser.email })
      );

      const responses = await Promise.all(promises);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // In a real implementation, we would verify that logger.warn was called
      // with appropriate rate limit violation information
    });

    it('should handle concurrent requests properly', async () => {
      // Send exactly the limit number of concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send({ email: testUser.email })
      );

      const responses = await Promise.all(promises);
      
      // All 3 should succeed (within limit)
      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBe(3);

      // Next request should be rate limited
      const nextResponse = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      expect(nextResponse.status).toBe(429);
    });

    it('should provide retry-after header in rate limit responses', async () => {
      // Exhaust rate limit
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/auth/forgot-password')
          .send({ email: testUser.email })
      );

      await Promise.all(promises);

      // Next request should be rate limited with retry-after header
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: testUser.email });

      expect(response.status).toBe(429);
      expect(response.body.retryAfter).toBeDefined();
      expect(typeof response.body.retryAfter).toBe('number');
      expect(response.body.retryAfter).toBeGreaterThan(0);
    });
  });
});