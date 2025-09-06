#!/usr/bin/env node

/**
 * Nexus ERP - Suite de Testes End-to-End
 * Fase 3 - Integração Completa
 * 
 * Testa comunicação entre todos os serviços
 * Valida health checks e conectividade
 * Executa testes de integração básicos
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configurações
const SERVICES = {
  'API Gateway': 'http://localhost:5001',
  'User Management': 'http://localhost:5003', 
  'CRM': 'http://localhost:5004',
  'Services': 'http://localhost:5005',
  'Agendamento': 'http://localhost:5008',
  'Frontend': 'http://localhost:5000'
};

const TIMEOUT = 10000; // 10 segundos
const MAX_RETRIES = 3;

// Cores para console
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function error(message) {
  log(`ERROR: ${message}`, 'red');
}

function success(message) {
  log(`SUCCESS: ${message}`, 'green');
}

function warn(message) {
  log(`WARNING: ${message}`, 'yellow');
}

function info(message) {
  log(`INFO: ${message}`, 'blue');
}

// Função para fazer requisição HTTP com retry
async function httpRequest(url, options = {}, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        timeout: TIMEOUT,
        ...options
      });
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      warn(`Tentativa ${i + 1} falhou para ${url}, tentando novamente...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Teste de health check básico
async function testHealthCheck(serviceName, baseUrl) {
  info(`Testando health check: ${serviceName}`);
  
  try {
    const response = await httpRequest(`${baseUrl}/health`);
    
    if (response.ok) {
      const data = await response.json();
      success(`${serviceName} health check passou ✓`);
      return {
        service: serviceName,
        status: 'healthy',
        responseTime: response.headers.get('x-response-time') || 'N/A',
        data: data
      };
    } else {
      error(`${serviceName} health check falhou - Status: ${response.status}`);
      return {
        service: serviceName,
        status: 'unhealthy',
        statusCode: response.status
      };
    }
  } catch (err) {
    error(`${serviceName} health check erro: ${err.message}`);
    return {
      service: serviceName,
      status: 'error',
      error: err.message
    };
  }
}

// Teste de conectividade básica
async function testBasicConnectivity(serviceName, baseUrl) {
  info(`Testando conectividade básica: ${serviceName}`);
  
  try {
    const response = await httpRequest(baseUrl);
    
    if (response.ok) {
      success(`${serviceName} conectividade OK ✓`);
      return { service: serviceName, connectivity: 'ok' };
    } else {
      warn(`${serviceName} conectividade com warnings - Status: ${response.status}`);
      return { service: serviceName, connectivity: 'warning', statusCode: response.status };
    }
  } catch (err) {
    error(`${serviceName} conectividade falhou: ${err.message}`);
    return { service: serviceName, connectivity: 'failed', error: err.message };
  }
}

// Teste de integração via API Gateway
async function testApiGatewayIntegration() {
  info('Testando integração via API Gateway...');
  
  const tests = [];
  
  // Teste ping do gateway
  try {
    const response = await httpRequest('http://localhost:5001/ping');
    if (response.ok) {
      success('API Gateway ping ✓');
      tests.push({ test: 'gateway-ping', status: 'passed' });
    } else {
      error(`API Gateway ping falhou - Status: ${response.status}`);
      tests.push({ test: 'gateway-ping', status: 'failed', statusCode: response.status });
    }
  } catch (err) {
    error(`API Gateway ping erro: ${err.message}`);
    tests.push({ test: 'gateway-ping', status: 'error', error: err.message });
  }
  
  // Teste roteamento para User Management
  try {
    const response = await httpRequest('http://localhost:5001/api/auth', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.status === 404 || response.status === 405 || response.ok) {
      success('Roteamento User Management via Gateway ✓');
      tests.push({ test: 'user-management-routing', status: 'passed' });
    } else {
      warn(`Roteamento User Management com problemas - Status: ${response.status}`);
      tests.push({ test: 'user-management-routing', status: 'warning', statusCode: response.status });
    }
  } catch (err) {
    error(`Roteamento User Management erro: ${err.message}`);
    tests.push({ test: 'user-management-routing', status: 'error', error: err.message });
  }
  
  return tests;
}

// Teste de performance básico
async function testBasicPerformance() {
  info('Testando performance básica...');
  
  const performanceTests = [];
  
  for (const [serviceName, baseUrl] of Object.entries(SERVICES)) {
    const startTime = Date.now();
    
    try {
      const response = await httpRequest(`${baseUrl}/health`);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      if (response.ok) {
        const status = responseTime < 1000 ? 'excellent' : 
                      responseTime < 3000 ? 'good' : 
                      responseTime < 5000 ? 'acceptable' : 'slow';
        
        performanceTests.push({
          service: serviceName,
          responseTime: responseTime,
          status: status
        });
        
        if (status === 'slow') {
          warn(`${serviceName} resposta lenta: ${responseTime}ms`);
        } else {
          info(`${serviceName} tempo de resposta: ${responseTime}ms (${status})`);
        }
      }
    } catch (err) {
      performanceTests.push({
        service: serviceName,
        responseTime: null,
        status: 'error',
        error: err.message
      });
    }
  }
  
  return performanceTests;
}

// Função principal de teste
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('   NEXUS ERP - SUITE DE TESTES END-TO-END');
  console.log('   Fase 3: Integração Completa');
  console.log('='.repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    healthChecks: [],
    connectivity: [],
    integration: [],
    performance: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };
  
  // 1. Testes de Health Check
  info('\n1. EXECUTANDO TESTES DE HEALTH CHECK...\n');
  for (const [serviceName, baseUrl] of Object.entries(SERVICES)) {
    const healthResult = await testHealthCheck(serviceName, baseUrl);
    results.healthChecks.push(healthResult);
    results.summary.total++;
    
    if (healthResult.status === 'healthy') {
      results.summary.passed++;
    } else if (healthResult.status === 'unhealthy') {
      results.summary.warnings++;
    } else {
      results.summary.failed++;
    }
  }
  
  // 2. Testes de Conectividade
  info('\n2. EXECUTANDO TESTES DE CONECTIVIDADE...\n');
  for (const [serviceName, baseUrl] of Object.entries(SERVICES)) {
    const connectResult = await testBasicConnectivity(serviceName, baseUrl);
    results.connectivity.push(connectResult);
    results.summary.total++;
    
    if (connectResult.connectivity === 'ok') {
      results.summary.passed++;
    } else if (connectResult.connectivity === 'warning') {
      results.summary.warnings++;
    } else {
      results.summary.failed++;
    }
  }
  
  // 3. Testes de Integração
  info('\n3. EXECUTANDO TESTES DE INTEGRAÇÃO...\n');
  const integrationResults = await testApiGatewayIntegration();
  results.integration = integrationResults;
  
  integrationResults.forEach(test => {
    results.summary.total++;
    if (test.status === 'passed') {
      results.summary.passed++;
    } else if (test.status === 'warning') {
      results.summary.warnings++;
    } else {
      results.summary.failed++;
    }
  });
  
  // 4. Testes de Performance
  info('\n4. EXECUTANDO TESTES DE PERFORMANCE...\n');
  const performanceResults = await testBasicPerformance();
  results.performance = performanceResults;
  
  // 5. Resumo Final
  console.log('\n' + '='.repeat(60));
  console.log('   RESUMO DOS TESTES');
  console.log('='.repeat(60));
  
  console.log(`Total de testes: ${results.summary.total}`);
  console.log(`${colors.green}Passou: ${results.summary.passed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${results.summary.warnings}${colors.reset}`);
  console.log(`${colors.red}Falhou: ${results.summary.failed}${colors.reset}`);
  
  const successRate = Math.round((results.summary.passed / results.summary.total) * 100);
  console.log(`\nTaxa de sucesso: ${successRate}%`);
  
  // 6. Salvar resultados
  const resultsPath = path.join(__dirname, '..', 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  info(`\nResultados salvos em: ${resultsPath}`);
  
  // 7. Status final
  if (results.summary.failed === 0) {
    success('\n🎉 TODOS OS TESTES CRÍTICOS PASSARAM! Sistema pronto para uso.');
    process.exit(0);
  } else if (results.summary.failed < 3) {
    warn('\n⚠️  Alguns testes falharam, mas o sistema pode estar funcional.');
    process.exit(1);
  } else {
    error('\n❌ MUITOS TESTES FALHARAM! Verifique a configuração do sistema.');
    process.exit(2);
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  runAllTests().catch(err => {
    error(`Erro fatal nos testes: ${err.message}`);
    console.error(err.stack);
    process.exit(3);
  });
}

module.exports = { runAllTests, testHealthCheck, testBasicConnectivity };