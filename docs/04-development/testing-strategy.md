# Testing Strategy - Nexus ERP

Estratégia completa de testes para garantir qualidade e confiabilidade do sistema modular.

## 🎯 Filosofia de Testes

### **Pirâmide de Testes**
```
    🔺 E2E Tests (Poucos)
   🔺🔺 Integration Tests (Alguns)  
  🔺🔺🔺 Unit Tests (Muitos)
```

**Proporção Ideal:**
- **70% Unit Tests** - Testes rápidos e isolados
- **20% Integration Tests** - Comunicação entre módulos
- **10% E2E Tests** - Fluxos críticos de usuário

## 🧪 Estratégia por Módulo

### **User Management**
```typescript
// Testes Críticos
✅ Login multi-tenant isolation
✅ JWT validation e expiration
✅ Cross-tenant access prevention
✅ Role-based access control
✅ Password hashing security
```

### **CRM**
```typescript
// Testes Críticos
✅ Customer CRUD operations
✅ Multi-tenant data isolation
✅ Search functionality
✅ Customer interaction tracking
✅ Integration with Services module
```

### **Services**
```typescript
// Testes Críticos  
✅ Service and professional management
✅ Appointment completion workflow
✅ Photo upload and storage
✅ Financial calculations
✅ Integration with CRM and Agendamento
```

### **Agendamento**
```typescript
// Testes Críticos
✅ Schedule conflict prevention
✅ Professional availability calculation
✅ WhatsApp notification sending
✅ Calendar view data accuracy
✅ Integration with Services module
```

## 🔧 Ferramentas e Setup

### **Stack de Testes**
```json
{
  "unitTests": "Jest + Supertest",
  "integrationTests": "Jest + Docker",
  "e2eTests": "Playwright",
  "mocking": "Jest mocks + MSW",
  "coverage": "Istanbul",
  "ci": "GitHub Actions"
}
```

### **Configuração por Módulo**
```typescript
// jest.config.js (padrão para todos os módulos)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## 📋 Estrutura de Testes

### **Organização por Módulo**
```
modules/user-management/
├── src/
├── tests/
│   ├── unit/           # Testes unitários
│   │   ├── services/
│   │   ├── controllers/
│   │   └── utils/
│   ├── integration/    # Testes de integração
│   │   ├── auth.test.ts
│   │   └── users.test.ts
│   ├── fixtures/       # Dados de teste
│   └── helpers/        # Utilitários de teste
```

### **Nomenclatura Padrão**
- **Unit:** `*.test.ts`
- **Integration:** `*.integration.test.ts`
- **E2E:** `*.e2e.test.ts`

## 🧪 Exemplos de Testes

### **Unit Test - User Service**
```typescript
// tests/unit/services/userService.test.ts
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const user = await userService.createUser(userData);

      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
      expect(user.id).toBeDefined();
    });

    it('should throw error for duplicate email', async () => {
      await userService.createUser({
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'User 1'
      });

      await expect(
        userService.createUser({
          email: 'duplicate@example.com', // Same email
          password: 'password456',
          name: 'User 2'
        })
      ).rejects.toThrow('Email already exists');
    });
  });
});
```

### **Integration Test - Auth Flow**
```typescript
// tests/integration/auth.integration.test.ts
describe('Authentication Flow', () => {
  it('should complete full auth flow', async () => {
    // 1. Create company and user
    const company = await createTestCompany();
    const user = await createTestUser(company.id);

    // 2. Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: 'password123'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.token).toBeDefined();

    // 3. Validate token
    const token = loginResponse.body.data.token;
    const validateResponse = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.user.id).toBe(user.id);
  });

  it('should prevent cross-tenant access', async () => {
    const company1 = await createTestCompany();
    const company2 = await createTestCompany();
    
    const user1Token = await getAuthToken(company1.id);
    
    // Try to access company2's users with company1's token
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${user1Token}`);

    // Should only return company1's users, not company2's
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0].company_id).toBe(company1.id);
  });
});
```

### **E2E Test - Customer Journey**
```typescript
// tests/e2e/customer-journey.e2e.test.ts
describe('Customer Journey E2E', () => {
  it('should complete full customer journey', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'admin@clinic.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');

    // 2. Create customer
    await page.goto('/customers/new');
    await page.fill('[data-testid=customer-name]', 'Maria Silva');
    await page.fill('[data-testid=customer-phone]', '+5511999999999');
    await page.click('[data-testid=save-customer]');
    
    // Verify customer was created
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();

    // 3. Create appointment
    await page.goto('/appointments/new');
    await page.fill('[data-testid=customer-search]', 'Maria Silva');
    await page.click('[data-testid=customer-option-0]');
    await page.selectOption('[data-testid=service-select]', 'Limpeza de Pele');
    await page.selectOption('[data-testid=professional-select]', 'Dr. Ana Costa');
    await page.fill('[data-testid=appointment-date]', '2024-08-25');
    await page.click('[data-testid=time-slot-10:00]');
    await page.click('[data-testid=create-appointment]');

    // Verify appointment was created
    await expect(page.locator('[data-testid=appointment-success]')).toBeVisible();

    // 4. Complete appointment
    await page.goto('/appointments');
    await page.click('[data-testid=complete-appointment-btn]');
    await page.fill('[data-testid=procedure-notes]', 'Limpeza realizada com sucesso');
    await page.selectOption('[data-testid=payment-status]', 'paid');
    await page.click('[data-testid=save-completion]');

    // Verify completion
    await expect(page.locator('[data-testid=completion-success]')).toBeVisible();
  });
});
```

## 🗄️ Database Testing

### **Test Database Setup**
```typescript
// tests/helpers/database.ts
export const setupTestDb = async () => {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  
  // Create fresh test database for each test suite
  await execSync(`createdb ${testDbName}`);
  
  // Run migrations
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await prisma.$migrate.deploy();
  
  return prisma;
};

export const cleanupTestDb = async () => {
  await prisma.$disconnect();
  await execSync(`dropdb ${testDbName}`);
};
```

### **Test Data Factory**
```typescript
// tests/fixtures/factories.ts
export const createTestCompany = async (overrides = {}) => {
  return await prisma.company.create({
    data: {
      name: 'Test Company',
      schema_name: `test_company_${Date.now()}`,
      enabled_modules: ['CRM', 'SERVICES', 'AGENDAMENTO'],
      ...overrides
    }
  });
};

export const createTestUser = async (companyId: string, overrides = {}) => {
  return await prisma.user.create({
    data: {
      company_id: companyId,
      email: `user${Date.now()}@test.com`,
      password_hash: await bcrypt.hash('password123', 10),
      name: 'Test User',
      role: 'admin',
      ...overrides
    }
  });
};
```

## 📊 Coverage e Qualidade

### **Métricas de Qualidade**
```typescript
// Thresholds mínimos
const coverageThresholds = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80
};

// Critical paths devem ter 100% de coverage
const criticalPaths = [
  'src/services/authService.ts',
  'src/middleware/auth.ts',
  'src/services/tenantIsolation.ts'
];
```

### **Quality Gates**
- ✅ **Coverage > 80%** em todos os módulos
- ✅ **Zero vulnerabilities** críticas
- ✅ **E2E tests passando** para fluxos principais
- ✅ **Integration tests** para comunicação cross-module

## 🚀 CI/CD Integration

### **GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        npm ci
        cd modules/user-management && npm ci
        cd ../crm && npm ci
        cd ../services && npm ci
        cd ../agendamento && npm ci
        
    - name: Run unit tests
      run: npm run test:unit
      
    - name: Run integration tests  
      run: npm run test:integration
      
    - name: Run E2E tests
      run: npm run test:e2e
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

## 📋 Comandos Úteis

### **Execução de Testes**
```bash
# Todos os testes
npm run test

# Por tipo
npm run test:unit
npm run test:integration  
npm run test:e2e

# Com watch mode
npm run test:watch

# Com coverage
npm run test:coverage

# Módulo específico
cd modules/user-management && npm test

# Arquivo específico
npm test -- auth.test.ts

# Debug mode
npm run test:debug
```

### **Utilitários**
```bash
# Limpar cache de testes
npm run test:clear-cache

# Setup inicial dos testes
npm run test:setup

# Generate test report
npm run test:report
```

## 🔧 Boas Práticas

### **Nomenclatura**
```typescript
// ✅ Bom - Descritivo e específico
describe('UserService.createUser', () => {
  it('should hash password before storing', () => {});
  it('should throw error when email already exists', () => {});
});

// ❌ Ruim - Vago
describe('User tests', () => {
  it('should work', () => {});
});
```

### **Isolamento**
```typescript
// ✅ Bom - Cada teste é independente
beforeEach(async () => {
  await cleanDatabase();
  await seedTestData();
});

// ❌ Ruim - Testes dependentes
let createdUser;
it('creates user', () => { createdUser = ... });
it('updates user', () => { /* usa createdUser */ });
```

### **Mocking**
```typescript
// ✅ Bom - Mock apenas dependências externas
jest.mock('../services/emailService');

// ❌ Ruim - Mock tudo
jest.mock('../services/userService'); // Não mocka o que está testando
```

## 📝 Checklist de Testes

### **Para Cada Nova Feature**
- [ ] **Unit tests** para lógica de negócio
- [ ] **Integration tests** para APIs
- [ ] **Error handling** testado
- [ ] **Edge cases** cobertos
- [ ] **Security scenarios** validados
- [ ] **Multi-tenant isolation** verificado

### **Para Cada Release**
- [ ] **Coverage > 80%** mantido
- [ ] **E2E tests** de fluxos críticos passando
- [ ] **Performance tests** executados
- [ ] **Security tests** executados
- [ ] **Cross-module integration** validada

## 🎯 Próximos Passos

1. **Implementar testes** desde o primeiro módulo
2. **Configurar CI/CD** com quality gates
3. **Setup performance testing** com k6
4. **Implementar visual testing** com Chromatic
5. **Criar test utilities** compartilhadas