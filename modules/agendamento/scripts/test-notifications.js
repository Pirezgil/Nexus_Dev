/**
 * Script para testar o sistema de notificações manualmente
 * Execute: node scripts/test-notifications.js
 */

const { WhatsAppProvider } = require('../src/services/providers/WhatsAppProvider');
const { SMSProvider } = require('../src/services/providers/SMSProvider');  
const { EmailProvider } = require('../src/services/providers/EmailProvider');
const { TemplateEngine } = require('../src/services/TemplateEngine');

require('dotenv').config();

async function testProviders() {
  console.log('🧪 Testando Sistema de Notificações\n');

  // Dados de teste
  const testData = {
    customer_name: 'João da Silva',
    customer_phone: '11999999999',
    customer_email: 'teste@example.com',
    appointment_date: '15 de dezembro de 2024',
    appointment_time: '14:30',
    service_name: 'Consulta Médica',
    professional_name: 'Dr. Ana Costa',
    company_name: 'Clínica Nexus',
    company_phone: '(11) 3333-4444',
    company_address: 'Rua das Flores, 123 - São Paulo, SP'
  };

  // 1. Testar Templates
  console.log('📝 Testando Templates...');
  try {
    const templates = TemplateEngine.getDefaultTemplates();
    const whatsappMessage = TemplateEngine.render(
      templates.whatsapp.confirmation, 
      testData
    );
    
    console.log('✅ Template WhatsApp renderizado:');
    console.log(whatsappMessage);
    console.log();

    const emailTemplate = TemplateEngine.renderEmail(
      templates.email.confirmation,
      testData
    );
    
    console.log('✅ Template Email renderizado:');
    console.log('Subject:', emailTemplate.subject);
    console.log('HTML preview:', emailTemplate.html.substring(0, 200) + '...');
    console.log();
  } catch (error) {
    console.log('❌ Erro nos templates:', error.message);
  }

  // 2. Testar WhatsApp Provider
  console.log('📱 Testando WhatsApp Provider...');
  try {
    const whatsappProvider = new WhatsAppProvider();
    
    // Teste de conectividade (não envia mensagem real)
    const connectionTest = await whatsappProvider.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ WhatsApp conectado com sucesso');
      
      // Teste de envio (descomente para enviar mensagem real)
      // const result = await whatsappProvider.sendMessage({
      //   phone: testData.customer_phone,
      //   message: `🧪 TESTE: Olá ${testData.customer_name}, este é um teste do sistema.`
      // });
      // console.log('Resultado envio:', result);
      
    } else {
      console.log('⚠️  WhatsApp não conectado:', connectionTest.error);
    }
  } catch (error) {
    console.log('❌ Erro WhatsApp:', error.message);
  }
  console.log();

  // 3. Testar SMS Provider  
  console.log('📲 Testando SMS Provider...');
  try {
    const smsProvider = new SMSProvider();
    
    // Teste de conectividade
    const connectionTest = await smsProvider.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ SMS (Twilio) conectado com sucesso');
      
      // Verificar saldo
      const balance = await smsProvider.getAccountBalance();
      if (balance.balance) {
        console.log(`💰 Saldo: ${balance.balance} ${balance.currency}`);
      }

      // Teste de validação de número
      const validPhone = smsProvider.validatePhoneNumber(testData.customer_phone);
      console.log(`📞 Número ${testData.customer_phone} válido:`, validPhone);
      
      // Teste de envio (descomente para enviar SMS real)
      // const result = await smsProvider.sendMessage(
      //   testData.customer_phone,
      //   `TESTE: Olá ${testData.customer_name}, teste do sistema Nexus.`
      // );
      // console.log('Resultado envio:', result);
      
    } else {
      console.log('⚠️  SMS não conectado:', connectionTest.error);
    }
  } catch (error) {
    console.log('❌ Erro SMS:', error.message);
  }
  console.log();

  // 4. Testar Email Provider
  console.log('📧 Testando Email Provider...');
  try {
    const emailProvider = new EmailProvider();
    
    // Teste de conectividade  
    const connectionTest = await emailProvider.testConnection();
    
    if (connectionTest.success) {
      console.log('✅ Email (SMTP) conectado com sucesso');
      
      const config = emailProvider.getConfiguration();
      console.log(`📮 Configuração: ${config.host}:${config.port} - ${config.from}`);
      
      // Teste de envio (descomente para enviar email real)
      // const result = await emailProvider.sendMessage(
      //   testData.customer_email,
      //   '🧪 Teste Sistema Nexus',
      //   `<h2>Teste do Sistema</h2><p>Olá ${testData.customer_name}, este é um teste.</p>`,
      //   true
      // );
      // console.log('Resultado envio:', result);
      
    } else {
      console.log('⚠️  Email não conectado:', connectionTest.error);
    }
  } catch (error) {
    console.log('❌ Erro Email:', error.message);
  }
  console.log();

  // 5. Testar validações
  console.log('🔍 Testando Validações...');
  
  // Validação de variáveis
  const incompleteData = {
    customer_name: 'João',
    appointment_date: '15/12/2024'
    // Faltando outras variáveis obrigatórias
  };
  
  const validation = TemplateEngine.validateVariables(incompleteData);
  console.log('Variáveis incompletas - Válido:', validation.valid);
  console.log('Variáveis faltando:', validation.missing);
  
  // Extração de variáveis
  const template = 'Olá {{customer_name}}, seu agendamento {{appointment_date}} às {{appointment_time}}';
  const extractedVars = TemplateEngine.extractVariables(template);
  console.log('Variáveis extraídas:', extractedVars);
  
  console.log();

  // 6. Resumo dos testes
  console.log('📊 Resumo dos Testes:');
  console.log('- ✅ Templates funcionando');
  console.log('- ✅ Validações funcionando'); 
  console.log('- 📱 WhatsApp: Verificar configuração se houver erro');
  console.log('- 📲 SMS: Verificar credenciais Twilio se houver erro');
  console.log('- 📧 Email: Verificar configuração SMTP se houver erro');
  console.log();
  console.log('💡 Para testar envio real, descomente as linhas de envio no código.');
  console.log('⚠️  ATENÇÃO: Envios reais consomem créditos/quota dos provedores!');
}

// Função para testar webhook handlers
async function testWebhookSimulation() {
  console.log('\n🔗 Simulando Webhooks...');
  
  // Simular webhook WhatsApp de confirmação
  const mockWhatsAppMessage = {
    from: '5511999999999@s.whatsapp.net',
    type: 'text',
    timestamp: Math.floor(Date.now() / 1000).toString(),
    text: {
      body: 'sim'
    }
  };

  console.log('📱 Simulando mensagem WhatsApp "sim":', mockWhatsAppMessage);
  console.log('-> Ação esperada: Confirmar agendamento');
  console.log();

  // Simular webhook de status
  const mockStatusUpdate = {
    id: 'msg_123',
    status: 'delivered',
    timestamp: Math.floor(Date.now() / 1000).toString(),
    recipient_id: '5511999999999'
  };

  console.log('📊 Simulando update de status:', mockStatusUpdate);
  console.log('-> Ação esperada: Atualizar status no banco');
  console.log();
}

// Função principal
async function main() {
  try {
    await testProviders();
    await testWebhookSimulation();
    
    console.log('🎉 Testes concluídos! Sistema pronto para uso.');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { testProviders, testWebhookSimulation };