#!/usr/bin/env node
/**
 * Script para testar a integração WhatsApp completa
 * Testa: configuração, envio de mensagens, queue e webhooks
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';
const TEST_PHONE = process.env.TEST_PHONE_NUMBER || '+5511999999999';
const TEST_COMPANY_ID = process.env.TEST_COMPANY_ID || 'test-company';

console.log('🧪 Testando Sistema de Notificações WhatsApp...\n');

// Configurar axios com token
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/agendamento`,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function runTests() {
  let testsPassed = 0;
  let totalTests = 0;

  // Função helper para executar teste
  async function runTest(name, testFn) {
    totalTests++;
    console.log(`\n🔄 ${name}...`);
    
    try {
      await testFn();
      console.log(`✅ ${name} - PASSOU`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name} - FALHOU:`, error.message);
      if (error.response) {
        console.log('   Resposta:', error.response.status, error.response.data);
      }
    }
  }

  // ===== TESTE 1: HEALTH CHECK =====
  await runTest('Health Check do Sistema', async () => {
    const response = await axios.get(`${API_BASE_URL}/api/agendamento/health`);
    
    if (response.status !== 200) {
      throw new Error(`Status inesperado: ${response.status}`);
    }
    
    console.log('   Sistema:', response.data.status === 'healthy' ? '✅ Saudável' : '⚠️  Com problemas');
  });

  // ===== TESTE 2: STATUS WHATSAPP =====
  await runTest('Status da Integração WhatsApp', async () => {
    const response = await api.get('/notifications/whatsapp/status');
    
    const { configured, healthy, info } = response.data.data;
    
    console.log(`   Configurado: ${configured ? '✅' : '❌'}`);
    console.log(`   Saudável: ${healthy ? '✅' : '❌'}`);
    
    if (info) {
      console.log(`   Telefone: ${info.phoneNumber || 'N/A'}`);
      console.log(`   API Version: ${info.apiVersion || 'N/A'}`);
    }
    
    if (!configured || !healthy) {
      throw new Error('WhatsApp não configurado ou com problemas');
    }
  });

  // ===== TESTE 3: ESTATÍSTICAS DA QUEUE =====
  await runTest('Estatísticas da Message Queue', async () => {
    const response = await api.get(`/webhook/stats/${TEST_COMPANY_ID}`);
    
    const { total_messages, by_status, delivery_metrics } = response.data.data;
    
    console.log(`   Total de mensagens: ${total_messages}`);
    console.log(`   Status:`, by_status);
    console.log(`   Taxa de entrega: ${delivery_metrics.delivery_rate}%`);
    console.log(`   Taxa de leitura: ${delivery_metrics.read_rate}%`);
  });

  // ===== TESTE 4: LISTAR TEMPLATES =====
  await runTest('Listar Templates de Mensagem', async () => {
    const response = await api.get(`/templates?company_id=${TEST_COMPANY_ID}`);
    
    const { templates, total } = response.data.data;
    
    console.log(`   Total de templates: ${total}`);
    
    if (templates.length > 0) {
      const template = templates[0];
      console.log(`   Primeiro template: ${template.template_name} (${template.template_type})`);
    }
  });

  // ===== TESTE 5: ENVIAR MENSAGEM DE TESTE =====
  await runTest('Enviar Mensagem de Teste', async () => {
    if (!TEST_PHONE || TEST_PHONE === '+5511999999999') {
      throw new Error('Configure TEST_PHONE_NUMBER no .env para testar envio real');
    }
    
    const response = await api.post('/notifications/test', {
      phone_number: TEST_PHONE,
      company_id: TEST_COMPANY_ID
    });
    
    const { success, messageId, error } = response.data.data;
    
    if (!success) {
      throw new Error(`Falha no envio: ${error}`);
    }
    
    console.log(`   Mensagem enviada com sucesso!`);
    console.log(`   ID da mensagem: ${messageId}`);
    console.log(`   📱 Verifique seu WhatsApp: ${TEST_PHONE}`);
  });

  // ===== TESTE 6: CRIAR TEMPLATE PERSONALIZADO =====
  await runTest('Criar Template Personalizado', async () => {
    const templateData = {
      company_id: TEST_COMPANY_ID,
      template_name: 'test_template_' + Date.now(),
      template_type: 'confirmation',
      channel: 'whatsapp',
      content: 'Olá {{customer_name}}, seu teste foi criado para {{date}} às {{time}}. Obrigado!',
      active: true,
      created_by: 'test-script'
    };
    
    const response = await api.post('/templates', templateData);
    
    const template = response.data.data;
    console.log(`   Template criado: ${template.template_name}`);
    console.log(`   ID: ${template.id}`);
    
    // Limpar - deletar o template criado
    try {
      await api.delete(`/templates/${template.id}?company_id=${TEST_COMPANY_ID}`);
      console.log(`   Template removido após teste`);
    } catch (e) {
      console.log(`   ⚠️  Não foi possível remover template teste`);
    }
  });

  // ===== TESTE 7: SIMULAR WEBHOOK =====
  await runTest('Testar Webhook Verification', async () => {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'test-token';
    
    const response = await axios.get(`${API_BASE_URL}/api/agendamento/webhook/whatsapp`, {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': verifyToken,
        'hub.challenge': 'test-challenge-123'
      }
    });
    
    if (response.data !== 'test-challenge-123') {
      throw new Error('Webhook verification falhou');
    }
    
    console.log('   Webhook verification funcionando corretamente');
  });

  // ===== RESUMO DOS TESTES =====
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESUMO DOS TESTES:`);
  console.log(`   Testes executados: ${totalTests}`);
  console.log(`   Testes aprovados: ${testsPassed}`);
  console.log(`   Testes falharam: ${totalTests - testsPassed}`);
  console.log(`   Taxa de sucesso: ${Math.round((testsPassed / totalTests) * 100)}%`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema funcionando perfeitamente.');
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM. Verifique as configurações.');
  }
  
  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('   1. Configure credenciais reais do WhatsApp no .env');
  console.log('   2. Configure TEST_PHONE_NUMBER para testar envio real');
  console.log('   3. Configure webhook URL no Facebook Developers');
  console.log('   4. Teste criação de agendamento com notificações ativadas');
  console.log('   5. Monitore os logs: docker logs nexus-agendamento -f');
}

// Verificar variáveis de ambiente
function checkEnvironment() {
  console.log('🔧 Verificando configuração...\n');
  
  const requiredVars = [
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName] === 'your-value-here');
  
  if (missingVars.length > 0) {
    console.log('⚠️  Variáveis de ambiente não configuradas:');
    missingVars.forEach(varName => {
      console.log(`   ❌ ${varName}`);
    });
    console.log('\n📝 Configure essas variáveis no arquivo .env para testes completos.');
  } else {
    console.log('✅ Todas as variáveis de ambiente configuradas!');
  }
  
  console.log(`\n📍 Configuração atual:`);
  console.log(`   API Base URL: ${API_BASE_URL}`);
  console.log(`   Test Phone: ${TEST_PHONE}`);
  console.log(`   Company ID: ${TEST_COMPANY_ID}`);
  console.log(`   Auth Token: ${AUTH_TOKEN ? '✅ Configurado' : '❌ Não configurado'}`);
}

// Executar
async function main() {
  try {
    checkEnvironment();
    await runTests();
  } catch (error) {
    console.error('\n💥 Erro durante execução dos testes:', error.message);
    process.exit(1);
  }
}

main();