// ERP Nexus - Login Validation Tests
// Testes automatizados para validar funcionamento do login

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuração dos testes
const CONFIG = {
  API_GATEWAY: 'http://localhost:5001',
  USER_MANAGEMENT: 'http://localhost:5003',
  TEST_TIMEOUT: 10000,
  CREDENTIALS: {
    admin: { email: 'admin@demo.com', password: '123456789' },
    manager: { email: 'manager@demo.com', password: '123456789' },
    user: { email: 'usuario1@demo.com', password: '123456789' },
    invalid: { email: 'invalid@test.com', password: 'wrongpassword' }
  }
};

// Utilitários de teste
const testUtils = {
  log: (message, data = null) => {
    console.log(`[TEST] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  },
  
  error: (message, error) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    console.error(error);
  },

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  makeRequest: async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        timeout: CONFIG.TEST_TIMEOUT,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ERP-Nexus-Test-Client',
          ...options.headers
        }
      });
      
      const data = await response.json();
      return {
        success: response.ok,
        status: response.status,
        data,
        headers: response.headers
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 0
      };
    }
  }
};

// Testes de validação
const tests = {
  // Teste 1: Health Check do API Gateway
  async testHealthCheck() {
    testUtils.log('🔍 Teste 1: Health Check do API Gateway');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/health`);
    
    if (response.success && response.data.status) {
      testUtils.log('✅ API Gateway está rodando', {
        status: response.data.status,
        services: response.data.services?.length || 0,
        timestamp: response.data.timestamp
      });
      return true;
    } else {
      testUtils.error('❌ API Gateway não está acessível', response.error || response.data);
      return false;
    }
  },

  // Teste 2: Ping do API Gateway
  async testPing() {
    testUtils.log('🔍 Teste 2: Ping do API Gateway');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/ping`);
    
    if (response.success && response.data.success) {
      testUtils.log('✅ Ping respondeu corretamente', {
        message: response.data.message,
        timestamp: response.data.timestamp
      });
      return true;
    } else {
      testUtils.error('❌ Ping falhou', response.error || response.data);
      return false;
    }
  },

  // Teste 3: Health Check do User Management
  async testUserManagementHealth() {
    testUtils.log('🔍 Teste 3: Health Check do User Management');
    
    const response = await testUtils.makeRequest(`${CONFIG.USER_MANAGEMENT}/health`);
    
    if (response.success && response.data.success) {
      testUtils.log('✅ User Management está saudável', {
        status: response.data.data?.status,
        uptime: response.data.data?.uptime,
        version: response.data.data?.version
      });
      return true;
    } else {
      testUtils.error('❌ User Management não está saudável', response.error || response.data);
      return false;
    }
  },

  // Teste 4: Login direto no User Management (bypass Gateway)
  async testDirectLogin() {
    testUtils.log('🔍 Teste 4: Login direto no User Management');
    
    const response = await testUtils.makeRequest(`${CONFIG.USER_MANAGEMENT}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(CONFIG.CREDENTIALS.admin)
    });
    
    if (response.success && response.data.success) {
      testUtils.log('✅ Login direto funcionou', {
        user: response.data.data?.user?.email,
        hasToken: !!response.data.data?.tokens?.accessToken
      });
      return response.data.data;
    } else {
      testUtils.error('❌ Login direto falhou', response.data || response.error);
      return false;
    }
  },

  // Teste 5: Login via API Gateway
  async testGatewayLogin() {
    testUtils.log('🔍 Teste 5: Login via API Gateway');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(CONFIG.CREDENTIALS.admin)
    });
    
    if (response.success && response.data.success) {
      testUtils.log('✅ Login via Gateway funcionou', {
        user: response.data.data?.user?.email,
        hasToken: !!response.data.data?.tokens?.accessToken
      });
      return response.data.data;
    } else {
      testUtils.error('❌ Login via Gateway falhou', response.data || response.error);
      return false;
    }
  },

  // Teste 6: Validação de token
  async testTokenValidation(loginData) {
    if (!loginData || !loginData.tokens?.accessToken) {
      testUtils.error('❌ Sem dados de login para validar token');
      return false;
    }

    testUtils.log('🔍 Teste 6: Validação de token');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/api/auth/validate`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.tokens.accessToken}`
      }
    });
    
    if (response.success && response.data.success) {
      testUtils.log('✅ Token é válido', {
        user: response.data.data?.user?.email,
        valid: response.data.data?.valid
      });
      return true;
    } else {
      testUtils.error('❌ Token inválido', response.data || response.error);
      return false;
    }
  },

  // Teste 7: Login com credenciais inválidas
  async testInvalidCredentials() {
    testUtils.log('🔍 Teste 7: Login com credenciais inválidas');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify(CONFIG.CREDENTIALS.invalid)
    });
    
    // Esperamos que falhe (401)
    if (!response.success && response.status === 401) {
      testUtils.log('✅ Credenciais inválidas rejeitadas corretamente', {
        status: response.status,
        message: response.data?.message || response.data?.error
      });
      return true;
    } else {
      testUtils.error('❌ Credenciais inválidas foram aceitas (falha de segurança)', response.data);
      return false;
    }
  },

  // Teste 8: Logout
  async testLogout(loginData) {
    if (!loginData || !loginData.tokens?.accessToken) {
      testUtils.error('❌ Sem dados de login para fazer logout');
      return false;
    }

    testUtils.log('🔍 Teste 8: Logout');
    
    const response = await testUtils.makeRequest(`${CONFIG.API_GATEWAY}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${loginData.tokens.accessToken}`
      }
    });
    
    // Logout pode ser bem-sucedido mesmo se token já expirou
    if (response.success || response.status === 401) {
      testUtils.log('✅ Logout executado', {
        status: response.status,
        success: response.data?.success
      });
      return true;
    } else {
      testUtils.error('❌ Logout falhou', response.data || response.error);
      return false;
    }
  }
};

// Função principal de execução dos testes
async function runTests() {
  console.log('🚀 Iniciando testes de validação do login ERP Nexus');
  console.log('📅 Data:', new Date().toISOString());
  console.log('🔧 Configuração:', {
    gateway: CONFIG.API_GATEWAY,
    userManagement: CONFIG.USER_MANAGEMENT,
    timeout: CONFIG.TEST_TIMEOUT
  });
  console.log('----------------------------------------');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  let loginData = null;

  // Executar testes em sequência
  const testSequence = [
    { name: 'Health Check API Gateway', fn: tests.testHealthCheck },
    { name: 'Ping API Gateway', fn: tests.testPing },
    { name: 'Health Check User Management', fn: tests.testUserManagementHealth },
    { name: 'Login direto User Management', fn: tests.testDirectLogin, saveResult: true },
    { name: 'Login via API Gateway', fn: tests.testGatewayLogin, saveResult: true },
    { name: 'Validação de token', fn: tests.testTokenValidation, useLoginData: true },
    { name: 'Credenciais inválidas', fn: tests.testInvalidCredentials },
    { name: 'Logout', fn: tests.testLogout, useLoginData: true }
  ];

  for (const test of testSequence) {
    results.total++;
    
    try {
      testUtils.log(`\n🧪 Executando: ${test.name}`);
      
      let result;
      if (test.useLoginData) {
        result = await test.fn(loginData);
      } else {
        result = await test.fn();
      }
      
      if (test.saveResult && result) {
        loginData = result;
      }
      
      if (result) {
        results.passed++;
        results.details.push({ test: test.name, status: 'PASS' });
      } else {
        results.failed++;
        results.details.push({ test: test.name, status: 'FAIL' });
      }
      
      // Pequena pausa entre testes
      await testUtils.sleep(500);
      
    } catch (error) {
      results.failed++;
      results.details.push({ test: test.name, status: 'ERROR', error: error.message });
      testUtils.error(`Erro inesperado no teste ${test.name}`, error);
    }
  }

  // Relatório final
  console.log('\n========================================');
  console.log('📊 RELATÓRIO FINAL DOS TESTES');
  console.log('========================================');
  console.log(`📋 Total de testes: ${results.total}`);
  console.log(`✅ Aprovados: ${results.passed}`);
  console.log(`❌ Falharam: ${results.failed}`);
  console.log(`📈 Taxa de sucesso: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('\n📝 Detalhes:');
  
  results.details.forEach((detail, index) => {
    const icon = detail.status === 'PASS' ? '✅' : detail.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${icon} ${detail.test} - ${detail.status}`);
    if (detail.error) {
      console.log(`   🔴 Erro: ${detail.error}`);
    }
  });

  // Conclusão
  console.log('\n🎯 CONCLUSÃO:');
  if (results.failed === 0) {
    console.log('🎉 Todos os testes passaram! O sistema de login está funcionando corretamente.');
  } else if (results.passed > results.failed) {
    console.log('⚠️ A maioria dos testes passou, mas há algumas questões que precisam ser investigadas.');
  } else {
    console.log('🚨 Muitos testes falharam. O sistema de login precisa de correções urgentes.');
  }

  console.log(`\n📅 Testes concluídos em: ${new Date().toISOString()}`);
  
  return results;
}

// Executar se chamado diretamente
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Erro fatal nos testes:', error);
    process.exit(1);
  });
}

module.exports = { runTests, tests, testUtils, CONFIG };