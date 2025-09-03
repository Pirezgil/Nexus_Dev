import request from 'supertest';
import { app } from '../modules/user-management/src/app';
import { prisma } from '../modules/user-management/src/utils/database';
import { AuthService } from '../modules/user-management/src/services/authService';
import { UserService } from '../modules/user-management/src/services/userService';
import { UserRole, UserStatus } from '@prisma/client';

describe('POST /auth/login - Integration Tests', () => {
  let testCompanyId: string;
  let testUserId: string;
  const testEmail = 'admin@test-company.com';
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    // Limpar dados de teste existentes
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { email: testEmail }
    });
    await prisma.company.deleteMany({
      where: { email: 'test@company.com' }
    });

    // Criar empresa de teste
    const testCompany = await prisma.company.create({
      data: {
        name: 'Empresa de Teste',
        email: 'test@company.com',
        isActive: true,
        plan: 'basic'
      }
    });
    testCompanyId = testCompany.id;

    // Criar usuário de teste
    const hashedPassword = await AuthService.hashPassword(testPassword);
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Teste',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        companyId: testCompanyId
      }
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: { id: testUserId }
    });
    await prisma.company.deleteMany({
      where: { id: testCompanyId }
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Limpar sessões após cada teste
    await prisma.session.deleteMany({
      where: { userId: testUserId }
    });
  });

  describe('Cenário de Sucesso', () => {
    it('deve fazer login com credenciais válidas e retornar token JWT', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: {
            id: testUserId,
            email: testEmail,
            firstName: 'Admin',
            lastName: 'Teste',
            role: 'ADMIN',
            status: 'ACTIVE',
            company: {
              id: testCompanyId,
              name: 'Empresa de Teste',
              plan: 'basic'
            }
          },
          tokens: {
            accessToken: expect.any(String),
            refreshToken: expect.any(String),
            expiresIn: expect.any(Number)
          }
        }
      });

      // Verificar se o token é válido
      const token = response.body.data.tokens.accessToken;
      expect(token).toBeTruthy();

      // Verificar se a sessão foi criada no banco
      const session = await prisma.session.findFirst({
        where: { userId: testUserId }
      });
      expect(session).toBeTruthy();
      expect(session?.isRevoked).toBe(false);
    });

    it('deve atualizar lastLoginAt do usuário após login bem-sucedido', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: testUserId }
      });
      const lastLoginBefore = userBefore?.lastLoginAt;

      await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      const userAfter = await prisma.user.findUnique({
        where: { id: testUserId }
      });
      const lastLoginAfter = userAfter?.lastLoginAt;

      expect(lastLoginAfter).not.toBe(lastLoginBefore);
      expect(lastLoginAfter).toBeInstanceOf(Date);
    });

    it('deve incluir permissões corretas baseadas no role do usuário', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(200);
      
      // Verificar se o token contém as permissões corretas para ADMIN
      const token = response.body.data.tokens.accessToken;
      const decoded = require('jsonwebtoken').verify(
        token, 
        process.env.JWT_SECRET || 'test-secret'
      );
      
      expect(decoded.permissions).toContain('CRM:read');
      expect(decoded.permissions).toContain('CRM:write');
      expect(decoded.permissions).toContain('CRM:delete');
      expect(decoded.permissions).toContain('CRM:admin');
      expect(decoded.permissions).toContain('SYSTEM:admin');
    });
  });

  describe('Cenários de Erro', () => {
    it('deve retornar 401 para email inexistente', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'naoexiste@teste.com',
          password: testPassword
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Email ou senha incorretos'
      });
    });

    it('deve retornar 401 para senha incorreta', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'senhaIncorreta123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Email ou senha incorretos'
      });
    });

    it('deve retornar 400 para dados de entrada inválidos', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'email-inválido',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('deve retornar 401 para empresa inativa', async () => {
      // Desativar empresa temporariamente
      await prisma.company.update({
        where: { id: testCompanyId },
        data: { isActive: false }
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Empresa inativa'
      });

      // Reativar empresa para outros testes
      await prisma.company.update({
        where: { id: testCompanyId },
        data: { isActive: true }
      });
    });
  });

  describe('Funcionalidade Multi-tenant', () => {
    let company2Id: string;
    let user2Id: string;
    const user2Email = 'admin@company2.com';

    beforeAll(async () => {
      // Criar segunda empresa e usuário
      const company2 = await prisma.company.create({
        data: {
          name: 'Empresa 2',
          email: 'company2@test.com',
          isActive: true,
          plan: 'premium'
        }
      });
      company2Id = company2.id;

      const hashedPassword = await AuthService.hashPassword(testPassword);
      const user2 = await prisma.user.create({
        data: {
          email: user2Email,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'Company2',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          companyId: company2Id
        }
      });
      user2Id = user2.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: { id: user2Id }
      });
      await prisma.company.deleteMany({
        where: { id: company2Id }
      });
    });

    it('deve fazer login para usuários de empresas diferentes com dados isolados', async () => {
      // Login usuário empresa 1
      const response1 = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      // Login usuário empresa 2
      const response2 = await request(app)
        .post('/auth/login')
        .send({
          email: user2Email,
          password: testPassword
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verificar se os dados das empresas estão isolados
      expect(response1.body.data.user.company.id).toBe(testCompanyId);
      expect(response2.body.data.user.company.id).toBe(company2Id);
      expect(response1.body.data.user.company.name).toBe('Empresa de Teste');
      expect(response2.body.data.user.company.name).toBe('Empresa 2');

      // Verificar se os tokens contêm companyId corretos
      const token1 = response1.body.data.tokens.accessToken;
      const token2 = response2.body.data.tokens.accessToken;
      
      const decoded1 = require('jsonwebtoken').verify(
        token1, 
        process.env.JWT_SECRET || 'test-secret'
      );
      const decoded2 = require('jsonwebtoken').verify(
        token2, 
        process.env.JWT_SECRET || 'test-secret'
      );

      expect(decoded1.companyId).toBe(testCompanyId);
      expect(decoded2.companyId).toBe(company2Id);
      expect(decoded1.userId).toBe(testUserId);
      expect(decoded2.userId).toBe(user2Id);
    });
  });

  describe('Validação de Sessões', () => {
    it('deve criar sessão no banco de dados após login bem-sucedido', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(200);

      const session = await prisma.session.findFirst({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' }
      });

      expect(session).toBeTruthy();
      expect(session?.userId).toBe(testUserId);
      expect(session?.companyId).toBe(testCompanyId);
      expect(session?.accessToken).toBe(response.body.data.tokens.accessToken);
      expect(session?.refreshToken).toBe(response.body.data.tokens.refreshToken);
      expect(session?.isRevoked).toBe(false);
      expect(session?.expiresAt).toBeInstanceOf(Date);
    });

    it('deve armazenar informações do dispositivo na sessão', async () => {
      const userAgent = 'Test User Agent';
      const response = await request(app)
        .post('/auth/login')
        .set('User-Agent', userAgent)
        .send({
          email: testEmail,
          password: testPassword
        });

      expect(response.status).toBe(200);

      const session = await prisma.session.findFirst({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' }
      });

      expect(session?.userAgent).toBe(userAgent);
      expect(session?.ipAddress).toBeTruthy();
    });
  });

  describe('Rate Limiting (apenas se habilitado)', () => {
    // Nota: Este teste só será executado se o rate limiting estiver ativo
    it('deve aplicar rate limiting após muitas tentativas (se habilitado)', async () => {
      if (process.env.NODE_ENV === 'development') {
        // Skip test in development as rate limiting is disabled
        return;
      }

      // Fazer múltiplas tentativas de login com credenciais inválidas
      const promises = Array.from({ length: 6 }, () =>
        request(app)
          .post('/auth/login')
          .send({
            email: testEmail,
            password: 'senhaIncorreta'
          })
      );

      const responses = await Promise.all(promises);

      // As primeiras tentativas devem retornar 401 (credenciais inválidas)
      // A partir da 6ª tentativa deve retornar 429 (rate limit)
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeTruthy();
    });
  });
});