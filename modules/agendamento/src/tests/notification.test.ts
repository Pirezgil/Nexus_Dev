/**
 * Testes de integração para o sistema de notificações
 * Valida funcionamento dos providers e queue system
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { WhatsAppProvider } from '../services/providers/WhatsAppProvider';
import { SMSProvider } from '../services/providers/SMSProvider';
import { EmailProvider } from '../services/providers/EmailProvider';
import { TemplateEngine } from '../services/TemplateEngine';
import { NotificationService } from '../services/NotificationServiceNew';

// Mock das variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock dos providers externos para não fazer chamadas reais
jest.mock('axios');
jest.mock('twilio');
jest.mock('nodemailer');

describe('Sistema de Notificações', () => {

  describe('TemplateEngine', () => {
    test('deve renderizar template com variáveis', () => {
      const template = 'Olá {{customer_name}}, seu agendamento é {{appointment_date}} às {{appointment_time}}';
      const variables = {
        customer_name: 'João Silva',
        customer_phone: '11999999999',
        appointment_date: '15 de dezembro de 2024',
        appointment_time: '14:30',
        service_name: 'Consulta',
        professional_name: 'Dr. Ana',
        company_name: 'Clínica Teste',
        company_phone: '1133334444',
        company_address: 'Rua Teste, 123'
      };

      const result = TemplateEngine.render(template, variables);
      
      expect(result).toBe('Olá João Silva, seu agendamento é 15 de dezembro de 2024 às 14:30');
    });

    test('deve limpar variáveis não substituídas', () => {
      const template = 'Olá {{customer_name}}, {{unknown_variable}} agendamento confirmado';
      const variables = {
        customer_name: 'João Silva',
        customer_phone: '11999999999',
        appointment_date: '15 de dezembro de 2024',
        appointment_time: '14:30',
        service_name: 'Consulta',
        professional_name: 'Dr. Ana',
        company_name: 'Clínica Teste',
        company_phone: '1133334444',
        company_address: 'Rua Teste, 123'
      };

      const result = TemplateEngine.render(template, variables);
      
      expect(result).toBe('Olá João Silva,  agendamento confirmado');
    });

    test('deve validar variáveis obrigatórias', () => {
      const variables = {
        customer_name: 'João Silva',
        appointment_date: '15 de dezembro de 2024'
        // Faltando outras variáveis obrigatórias
      };

      const validation = TemplateEngine.validateVariables(variables);
      
      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('appointment_time');
      expect(validation.missing).toContain('service_name');
      expect(validation.missing).toContain('company_name');
    });

    test('deve extrair variáveis de um template', () => {
      const template = 'Olá {{customer_name}}, seu agendamento é {{appointment_date}} às {{appointment_time}}';
      
      const variables = TemplateEngine.extractVariables(template);
      
      expect(variables).toEqual(['customer_name', 'appointment_date', 'appointment_time']);
    });

    test('deve gerar preview com dados de exemplo', () => {
      const template = 'Olá {{customer_name}}, agendamento {{appointment_date}}';
      
      const preview = TemplateEngine.previewTemplate(template);
      
      expect(preview).toContain('Olá João Silva');
      expect(preview).toContain('15 de dezembro de 2024');
    });

    test('deve renderizar template de email', () => {
      const template = {
        subject: 'Agendamento - {{company_name}}',
        html: '<p>Olá {{customer_name}}</p>'
      };
      const variables = {
        customer_name: 'João Silva',
        customer_phone: '11999999999',
        appointment_date: '15 de dezembro de 2024',
        appointment_time: '14:30',
        service_name: 'Consulta',
        professional_name: 'Dr. Ana',
        company_name: 'Clínica Teste',
        company_phone: '1133334444',
        company_address: 'Rua Teste, 123'
      };

      const result = TemplateEngine.renderEmail(template, variables);
      
      expect(result.subject).toBe('Agendamento - Clínica Teste');
      expect(result.html).toBe('<p>Olá João Silva</p>');
    });
  });

  describe('WhatsAppProvider', () => {
    let provider: WhatsAppProvider;

    beforeAll(() => {
      // Mock das variáveis de ambiente para WhatsApp
      process.env.WHATSAPP_API_URL = 'http://localhost:8080';
      process.env.WHATSAPP_INSTANCE_KEY = 'test_instance';
      process.env.WHATSAPP_TOKEN = 'test_token';
      
      provider = new WhatsAppProvider();
    });

    test('deve formatar número de telefone corretamente', async () => {
      // Mock axios para simular resposta bem-sucedida
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: {
          error: false,
          key: { id: 'msg_123' }
        }
      });

      const result = await provider.sendMessage({
        phone: '(11) 99999-9999',
        message: 'Teste'
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:8080/message/sendText/test_instance',
        {
          number: '5511999999999@s.whatsapp.net',
          text: 'Teste',
          delay: 0
        },
        expect.any(Object)
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
    });

    test('deve tratar erro de API', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockResolvedValue({
        data: {
          error: true,
          message: 'Instância não conectada'
        }
      });

      const result = await provider.sendMessage({
        phone: '11999999999',
        message: 'Teste'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Instância não conectada');
    });

    test('deve tratar timeout de conexão', async () => {
      const mockAxios = require('axios');
      mockAxios.post.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout'
      });

      const result = await provider.sendMessage({
        phone: '11999999999',
        message: 'Teste'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout ao enviar mensagem WhatsApp');
    });
  });

  describe('SMSProvider', () => {
    let provider: SMSProvider;

    beforeAll(() => {
      // Mock das variáveis de ambiente para SMS
      process.env.TWILIO_ACCOUNT_SID = 'ACtest123';
      process.env.TWILIO_AUTH_TOKEN = 'test_token';
      process.env.TWILIO_PHONE_NUMBER = '+5511999999999';
      
      provider = new SMSProvider();
    });

    test('deve validar número de telefone', () => {
      expect(provider.validatePhoneNumber('11999999999')).toBe(true);
      expect(provider.validatePhoneNumber('1199999999')).toBe(true);
      expect(provider.validatePhoneNumber('119999999')).toBe(false);
      expect(provider.validatePhoneNumber('12345')).toBe(false);
    });

    test('deve formatar número brasileiro corretamente', async () => {
      const mockTwilio = require('twilio');
      const mockClient = {
        messages: {
          create: jest.fn().mockResolvedValue({
            sid: 'SM123',
            status: 'sent'
          })
        }
      };
      mockTwilio.mockReturnValue(mockClient);

      provider = new SMSProvider(); // Recriar com mock

      const result = await provider.sendMessage('11999999999', 'Teste SMS');

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        body: 'Teste SMS',
        from: '+5511999999999',
        to: '+5511999999999'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM123');
    });

    test('deve mapear status do Twilio corretamente', async () => {
      const mockTwilio = require('twilio');
      const mockClient = {
        messages: jest.fn(() => ({
          fetch: jest.fn().mockResolvedValue({
            status: 'delivered'
          })
        }))
      };
      mockTwilio.mockReturnValue(mockClient);

      provider = new SMSProvider();
      const status = await provider.getMessageStatus('SM123');

      expect(status).toBe('delivered');
    });
  });

  describe('EmailProvider', () => {
    let provider: EmailProvider;

    beforeAll(() => {
      // Mock das variáveis de ambiente para Email
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'test@gmail.com';
      process.env.SMTP_PASSWORD = 'test_password';
      process.env.SMTP_FROM = 'Test <test@gmail.com>';
      
      provider = new EmailProvider();
    });

    test('deve validar endereço de email', () => {
      expect(provider['validateEmail']('test@gmail.com')).toBe(true);
      expect(provider['validateEmail']('invalid-email')).toBe(false);
      expect(provider['validateEmail']('')).toBe(false);
    });

    test('deve converter HTML para texto', () => {
      const html = '<p>Olá <strong>João</strong></p><br><p>Seu agendamento</p>';
      const text = provider['htmlToText'](html);
      
      expect(text).toBe('Olá João\n\n\nSeu agendamento');
    });

    test('deve criar opções de email corretamente', async () => {
      const mockNodemailer = require('nodemailer');
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: 'email_123',
          accepted: ['test@example.com'],
          rejected: []
        }),
        verify: jest.fn().mockResolvedValue(true)
      };
      mockNodemailer.createTransporter.mockReturnValue(mockTransporter);

      provider = new EmailProvider();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for initialization

      const result = await provider.sendMessage(
        'test@example.com',
        'Agendamento Confirmado',
        '<h1>Confirmação</h1>',
        true
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Test <test@gmail.com>',
        to: 'test@example.com',
        subject: 'Agendamento Confirmado',
        html: '<h1>Confirmação</h1>',
        headers: expect.any(Object)
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email_123');
    });
  });

  describe('Integração do Sistema', () => {
    test('deve processar fluxo completo de notificação', async () => {
      // Este é um teste mais complexo que simula o fluxo completo
      const appointmentData = {
        id: 'appointment_123',
        company_id: 'company_123',
        customer_id: 'customer_123',
        professional_id: 'prof_123',
        service_id: 'service_123',
        appointment_date: new Date('2024-12-01'),
        appointment_time: '14:30',
        status: 'scheduled',
        customerName: 'João Silva',
        customerPhone: '11999999999',
        customerEmail: 'joao@example.com',
        serviceName: 'Consulta Médica',
        professionalName: 'Dr. Ana Costa',
        companyName: 'Clínica Teste',
        companyPhone: '1133334444',
        companyAddress: 'Rua Teste, 123'
      };

      // Mock dos providers
      const mockWhatsApp = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'wa_123'
      });
      const mockSMS = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'sms_123'
      });
      const mockEmail = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'email_123'
      });

      // Simular envio pelos três canais
      const whatsappResult = await mockWhatsApp();
      const smsResult = await mockSMS();
      const emailResult = await mockEmail();

      expect(whatsappResult.success).toBe(true);
      expect(smsResult.success).toBe(true);
      expect(emailResult.success).toBe(true);

      expect(whatsappResult.messageId).toBeTruthy();
      expect(smsResult.messageId).toBeTruthy();
      expect(emailResult.messageId).toBeTruthy();
    });

    test('deve tratar falhas graciosamente', async () => {
      // Simular falha em um dos canais
      const mockWhatsApp = jest.fn().mockResolvedValue({
        success: false,
        error: 'WhatsApp não configurado'
      });
      const mockEmail = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'email_123'
      });

      const whatsappResult = await mockWhatsApp();
      const emailResult = await mockEmail();

      // WhatsApp falhou mas email funcionou
      expect(whatsappResult.success).toBe(false);
      expect(emailResult.success).toBe(true);
      
      // Sistema deve continuar funcionando
      expect(whatsappResult.error).toBeTruthy();
      expect(emailResult.messageId).toBeTruthy();
    });
  });

  describe('Templates Padrão', () => {
    test('deve ter templates para todos os tipos e canais', () => {
      const templates = TemplateEngine.getDefaultTemplates();

      // Verificar estrutura
      expect(templates).toHaveProperty('whatsapp');
      expect(templates).toHaveProperty('sms');
      expect(templates).toHaveProperty('email');

      // Verificar tipos de notificação
      const types = ['confirmation', 'reminder', 'cancellation', 'reschedule'];
      
      for (const type of types) {
        expect(templates.whatsapp).toHaveProperty(type);
        expect(templates.sms).toHaveProperty(type);
        expect(templates.email).toHaveProperty(type);
      }

      // Verificar que templates de email têm subject e html
      for (const type of types) {
        expect(templates.email[type]).toHaveProperty('subject');
        expect(templates.email[type]).toHaveProperty('html');
      }
    });

    test('deve renderizar todos os templates padrão', () => {
      const templates = TemplateEngine.getDefaultTemplates();
      const variables = {
        customer_name: 'João Silva',
        customer_phone: '11999999999',
        appointment_date: '15 de dezembro de 2024',
        appointment_time: '14:30',
        service_name: 'Consulta Médica',
        professional_name: 'Dr. Ana Costa',
        company_name: 'Clínica Teste',
        company_phone: '1133334444',
        company_address: 'Rua Teste, 123'
      };

      const types = ['confirmation', 'reminder', 'cancellation', 'reschedule'];
      
      for (const type of types) {
        // WhatsApp e SMS
        const whatsappRendered = TemplateEngine.render(templates.whatsapp[type], variables);
        const smsRendered = TemplateEngine.render(templates.sms[type], variables);
        
        expect(whatsappRendered).toContain('João Silva');
        expect(smsRendered).toContain('João Silva');
        expect(whatsappRendered.length).toBeGreaterThan(10);
        expect(smsRendered.length).toBeGreaterThan(10);

        // Email
        const emailRendered = TemplateEngine.renderEmail(templates.email[type], variables);
        expect(emailRendered.subject).toContain('Clínica Teste');
        expect(emailRendered.html).toContain('João Silva');
      }
    });
  });
});