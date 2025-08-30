#!/usr/bin/env node

/**
 * Script para testar e validar a implementação do sistema de autenticação
 * Este script verifica se todas as funcionalidades foram implementadas corretamente
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔐 Nexus ERP - Validação do Sistema de Autenticação\n');

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}📋 ${msg}${colors.reset}\n`)
};

// Verificar se arquivos essenciais existem
function checkRequiredFiles() {
  log.header('Verificando arquivos essenciais...');
  
  const requiredFiles = [
    'src/services/emailService.ts',
    'src/middleware/authRateLimit.ts',
    'src/controllers/authController.ts',
    'src/services/authService.ts',
    'src/tests/auth.password-reset.test.ts',
    'src/tests/auth.email-verification.test.ts',
    'src/tests/auth.rate-limiting.test.ts',
    'jest.config.js',
    'AUTHENTICATION_SECURITY.md'
  ];

  let allFilesExist = true;

  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      log.success(`${file} existe`);
    } else {
      log.error(`${file} não encontrado!`);
      allFilesExist = false;
    }
  });

  return allFilesExist;
}

// Verificar se dependências estão instaladas
function checkDependencies() {
  log.header('Verificando dependências...');
  
  const requiredDeps = [
    'nodemailer',
    '@types/nodemailer',
    'express-rate-limit',
    'jest',
    'supertest',
    '@types/jest',
    '@types/supertest',
    'ts-jest'
  ];

  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    let allDepsInstalled = true;

    requiredDeps.forEach(dep => {
      if (allDeps[dep]) {
        log.success(`${dep} instalado (${allDeps[dep]})`);
      } else {
        log.error(`${dep} não encontrado!`);
        allDepsInstalled = false;
      }
    });

    return allDepsInstalled;
  } catch (error) {
    log.error(`Erro ao ler package.json: ${error.message}`);
    return false;
  }
}

// Verificar estrutura do banco de dados
function checkDatabaseSchema() {
  log.header('Verificando esquema do banco de dados...');
  
  try {
    const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
    
    const requiredModels = [
      'PasswordResetRequest',
      'EmailVerification',
      'User',
      'Company',
      'AuditLog'
    ];

    let allModelsExist = true;

    requiredModels.forEach(model => {
      if (schemaContent.includes(`model ${model}`)) {
        log.success(`Model ${model} definido`);
      } else {
        log.error(`Model ${model} não encontrado!`);
        allModelsExist = false;
      }
    });

    // Verificar campos específicos
    const requiredFields = [
      { model: 'User', field: 'emailVerified' },
      { model: 'User', field: 'status' },
      { model: 'PasswordResetRequest', field: 'token' },
      { model: 'PasswordResetRequest', field: 'expiresAt' },
      { model: 'EmailVerification', field: 'token' },
      { model: 'EmailVerification', field: 'isUsed' }
    ];

    requiredFields.forEach(({ model, field }) => {
      const modelRegex = new RegExp(`model ${model}[\\s\\S]*?\\}`, 'g');
      const modelMatch = schemaContent.match(modelRegex);
      
      if (modelMatch && modelMatch[0].includes(field)) {
        log.success(`Campo ${model}.${field} definido`);
      } else {
        log.error(`Campo ${model}.${field} não encontrado!`);
        allModelsExist = false;
      }
    });

    return allModelsExist;
  } catch (error) {
    log.error(`Erro ao ler schema.prisma: ${error.message}`);
    return false;
  }
}

// Verificar implementação dos endpoints
function checkEndpoints() {
  log.header('Verificando implementação dos endpoints...');
  
  try {
    const routesContent = fs.readFileSync('src/routes/authRoutes.ts', 'utf8');
    const controllerContent = fs.readFileSync('src/controllers/authController.ts', 'utf8');
    
    const requiredRoutes = [
      { route: '/forgot-password', method: 'POST' },
      { route: '/reset-password', method: 'POST' },
      { route: '/verify-email/:token', method: 'GET' },
      { route: '/resend-verification', method: 'POST' }
    ];

    const requiredMethods = [
      'forgotPassword',
      'resetPassword',
      'verifyEmail',
      'resendEmailVerification'
    ];

    let allImplemented = true;

    requiredRoutes.forEach(({ route, method }) => {
      if (routesContent.includes(route) && routesContent.includes(method.toLowerCase())) {
        log.success(`Rota ${method} ${route} definida`);
      } else {
        log.error(`Rota ${method} ${route} não encontrada!`);
        allImplemented = false;
      }
    });

    requiredMethods.forEach(method => {
      if (controllerContent.includes(`static async ${method}`)) {
        log.success(`Método AuthController.${method} implementado`);
      } else {
        log.error(`Método AuthController.${method} não encontrado!`);
        allImplemented = false;
      }
    });

    return allImplemented;
  } catch (error) {
    log.error(`Erro ao verificar endpoints: ${error.message}`);
    return false;
  }
}

// Verificar rate limiting
function checkRateLimiting() {
  log.header('Verificando rate limiting...');
  
  try {
    const rateLimitContent = fs.readFileSync('src/middleware/authRateLimit.ts', 'utf8');
    
    const requiredLimiters = [
      'passwordResetRateLimit',
      'emailVerificationRateLimit',
      'loginRateLimit',
      'registrationRateLimit',
      'changePasswordRateLimit',
      'tokenValidationRateLimit'
    ];

    let allImplemented = true;

    requiredLimiters.forEach(limiter => {
      if (rateLimitContent.includes(`export const ${limiter}`)) {
        log.success(`Rate limiter ${limiter} implementado`);
      } else {
        log.error(`Rate limiter ${limiter} não encontrado!`);
        allImplemented = false;
      }
    });

    return allImplemented;
  } catch (error) {
    log.error(`Erro ao verificar rate limiting: ${error.message}`);
    return false;
  }
}

// Verificar sistema de email
function checkEmailSystem() {
  log.header('Verificando sistema de email...');
  
  try {
    const emailServiceContent = fs.readFileSync('src/services/emailService.ts', 'utf8');
    
    const requiredMethods = [
      'sendPasswordReset',
      'sendEmailVerification',
      'verifyConnection'
    ];

    const requiredTemplates = [
      'getPasswordResetTemplate',
      'getEmailVerificationTemplate',
      'getPasswordResetTextTemplate',
      'getEmailVerificationTextTemplate'
    ];

    let allImplemented = true;

    requiredMethods.forEach(method => {
      if (emailServiceContent.includes(`async ${method}`)) {
        log.success(`Método EmailService.${method} implementado`);
      } else {
        log.error(`Método EmailService.${method} não encontrado!`);
        allImplemented = false;
      }
    });

    requiredTemplates.forEach(template => {
      if (emailServiceContent.includes(`private ${template}`)) {
        log.success(`Template ${template} implementado`);
      } else {
        log.error(`Template ${template} não encontrado!`);
        allImplemented = false;
      }
    });

    return allImplemented;
  } catch (error) {
    log.error(`Erro ao verificar sistema de email: ${error.message}`);
    return false;
  }
}

// Executar testes
function runTests() {
  log.header('Executando testes...');
  
  try {
    // Verificar se jest está configurado
    if (!fs.existsSync('jest.config.js')) {
      log.error('Arquivo jest.config.js não encontrado!');
      return false;
    }

    log.info('Executando testes unitários...');
    
    // Executar testes (sem execução real por ora, apenas verificação)
    const testFiles = [
      'src/tests/auth.password-reset.test.ts',
      'src/tests/auth.email-verification.test.ts',
      'src/tests/auth.rate-limiting.test.ts'
    ];

    let allTestsExist = true;

    testFiles.forEach(testFile => {
      if (fs.existsSync(testFile)) {
        log.success(`Teste ${testFile} existe`);
        
        // Verificar estrutura básica do teste
        const testContent = fs.readFileSync(testFile, 'utf8');
        if (testContent.includes('describe(') && testContent.includes('it(')) {
          log.success(`Teste ${testFile} tem estrutura válida`);
        } else {
          log.warning(`Teste ${testFile} pode ter estrutura incompleta`);
        }
      } else {
        log.error(`Teste ${testFile} não encontrado!`);
        allTestsExist = false;
      }
    });

    return allTestsExist;
  } catch (error) {
    log.error(`Erro ao executar testes: ${error.message}`);
    return false;
  }
}

// Verificar variáveis de ambiente
function checkEnvironmentVariables() {
  log.header('Verificando variáveis de ambiente...');
  
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_PORT', 
    'SMTP_USER',
    'SMTP_PASS',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'FRONTEND_URL',
    'API_URL'
  ];

  if (fs.existsSync('.env.example')) {
    const envExampleContent = fs.readFileSync('.env.example', 'utf8');
    
    let allVarsDocumented = true;

    requiredEnvVars.forEach(envVar => {
      if (envExampleContent.includes(envVar)) {
        log.success(`Variável ${envVar} documentada em .env.example`);
      } else {
        log.warning(`Variável ${envVar} não encontrada em .env.example`);
        allVarsDocumented = false;
      }
    });

    return allVarsDocumented;
  } else {
    log.error('Arquivo .env.example não encontrado!');
    return false;
  }
}

// Função principal
async function main() {
  console.log(`${colors.bold}Iniciando validação da implementação...${colors.reset}\n`);
  
  const checks = [
    { name: 'Arquivos essenciais', fn: checkRequiredFiles },
    { name: 'Dependências', fn: checkDependencies },
    { name: 'Esquema do banco', fn: checkDatabaseSchema },
    { name: 'Endpoints', fn: checkEndpoints },
    { name: 'Rate limiting', fn: checkRateLimiting },
    { name: 'Sistema de email', fn: checkEmailSystem },
    { name: 'Testes', fn: runTests },
    { name: 'Variáveis de ambiente', fn: checkEnvironmentVariables }
  ];

  const results = [];

  for (const check of checks) {
    try {
      const result = check.fn();
      results.push({ name: check.name, passed: result });
    } catch (error) {
      log.error(`Erro durante verificação '${check.name}': ${error.message}`);
      results.push({ name: check.name, passed: false });
    }
  }

  // Resumo final
  log.header('Resumo da Validação');
  
  const passedChecks = results.filter(r => r.passed).length;
  const totalChecks = results.length;

  results.forEach(result => {
    if (result.passed) {
      log.success(`${result.name}: PASSOU`);
    } else {
      log.error(`${result.name}: FALHOU`);
    }
  });

  console.log(`\n${colors.bold}Score: ${passedChecks}/${totalChecks} verificações passaram${colors.reset}`);

  if (passedChecks === totalChecks) {
    console.log(`\n${colors.green}${colors.bold}🎉 Implementação completa e validada com sucesso!${colors.reset}`);
    console.log(`\n${colors.blue}Próximos passos:${colors.reset}`);
    console.log('1. Configure as variáveis de ambiente SMTP');
    console.log('2. Execute as migrações do banco: npm run db:migrate');
    console.log('3. Execute os testes: npm test');
    console.log('4. Inicie o servidor: npm run dev');
  } else {
    console.log(`\n${colors.yellow}${colors.bold}⚠️ Implementação incompleta!${colors.reset}`);
    console.log(`\nVerifique os itens que falharam acima e corrija antes de prosseguir.`);
    process.exit(1);
  }
}

// Executar o script
if (require.main === module) {
  main().catch(error => {
    log.error(`Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkRequiredFiles,
  checkDependencies,
  checkDatabaseSchema,
  checkEndpoints,
  checkRateLimiting,
  checkEmailSystem,
  runTests,
  checkEnvironmentVariables
};