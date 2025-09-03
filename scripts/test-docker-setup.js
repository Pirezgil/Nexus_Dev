#!/usr/bin/env node

/**
 * Script de teste para validar a configuração Docker do ERP Nexus
 * Testa conectividade e URLs de API em diferentes ambientes
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DockerTestSuite {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  async runTest(name, testFn) {
    console.log(`🧪 Executando: ${name}`);
    try {
      const result = await testFn();
      this.results.push({ name, status: 'PASS', result });
      console.log(`✅ ${name}: PASSOU`);
      return result;
    } catch (error) {
      this.errors.push({ name, error: error.message });
      console.log(`❌ ${name}: FALHOU - ${error.message}`);
      throw error;
    }
  }

  async testDockerComposeConfig() {
    return this.runTest('Validar docker-compose.yml', async () => {
      const { stdout } = await execAsync('docker-compose config --quiet');
      return 'Configuração válida';
    });
  }

  async testDockerComposeProdConfig() {
    return this.runTest('Validar docker-compose.prod.yml', async () => {
      const { stdout } = await execAsync('docker-compose -f docker-compose.prod.yml config --quiet');
      return 'Configuração de produção válida';
    });
  }

  async testServicesHealth() {
    return this.runTest('Verificar serviços rodando', async () => {
      const { stdout } = await execAsync('docker-compose ps --services --filter "status=running"');
      const runningServices = stdout.trim().split('\n').filter(Boolean);
      return `Serviços rodando: ${runningServices.length}`;
    });
  }

  async testApiGatewayConnectivity() {
    return this.runTest('Testar conectividade API Gateway', async () => {
      try {
        const { stdout } = await execAsync('curl -f -s http://localhost:5001/health || echo "FAILED"');
        if (stdout.includes('FAILED')) {
          throw new Error('API Gateway não está respondendo');
        }
        return 'API Gateway acessível';
      } catch (error) {
        throw new Error('API Gateway não está acessível');
      }
    });
  }

  async testFrontendConnectivity() {
    return this.runTest('Testar conectividade Frontend', async () => {
      try {
        const { stdout } = await execAsync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost:5000 || echo "FAILED"');
        if (stdout.includes('FAILED') || !stdout.includes('200')) {
          throw new Error(`Frontend retornou status: ${stdout}`);
        }
        return 'Frontend acessível';
      } catch (error) {
        throw new Error('Frontend não está acessível');
      }
    });
  }

  async testEnvironmentVariables() {
    return this.runTest('Verificar variáveis de ambiente do frontend', async () => {
      const { stdout } = await execAsync('docker-compose exec -T nexus-frontend printenv | grep NEXT_PUBLIC || echo "NO_ENV_VARS"');
      if (stdout.includes('NO_ENV_VARS')) {
        throw new Error('Variáveis de ambiente não configuradas');
      }
      const envVars = stdout.trim().split('\n').length;
      return `${envVars} variáveis NEXT_PUBLIC configuradas`;
    });
  }

  async runAllTests() {
    console.log('🚀 Iniciando testes de configuração Docker...\n');

    const tests = [
      () => this.testDockerComposeConfig(),
      () => this.testDockerComposeProdConfig(),
      () => this.testServicesHealth(),
      () => this.testApiGatewayConnectivity(),
      () => this.testFrontendConnectivity(),
      () => this.testEnvironmentVariables(),
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test();
        passed++;
      } catch (error) {
        failed++;
      }
      console.log(''); // Linha em branco para separar testes
    }

    console.log('📊 RESUMO DOS TESTES:');
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📈 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (this.errors.length > 0) {
      console.log('\n🚨 ERROS ENCONTRADOS:');
      this.errors.forEach(({ name, error }) => {
        console.log(`- ${name}: ${error}`);
      });
    }

    return { passed, failed, errors: this.errors };
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const testSuite = new DockerTestSuite();
  testSuite.runAllTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Erro ao executar testes:', error);
      process.exit(1);
    });
}

module.exports = DockerTestSuite;