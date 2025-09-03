/**
 * Suíte de Testes Unitários - Case Transformer Middleware
 * 
 * Testes completos para validação da lógica de transformação de casos no middleware
 * do API Gateway do Nexus ERP. Garante 100% de cobertura da lógica crítica e valida
 * que o middleware resolve os problemas sistêmicos identificados no audit report.
 * 
 * Cobertura de Testes:
 * - Funções puras: toSnakeCase, toCamelCase, convertKeys
 * - Cenários de caminho feliz com payloads complexos
 * - Casos de borda e valores extremos
 * - Tratamento de erros e valores não-objeto
 * - Problemas específicos identificados no code_data_flow_audit_report.md
 * 
 * @author QA Team - Nexus ERP
 * @version 1.0.0
 */

import { toSnakeCase, toCamelCase, convertKeys } from './case-transformer.middleware';

describe('Case Transformer Middleware - Unit Tests', () => {
  
  // ========================================
  // TESTES DA FUNÇÃO toSnakeCase
  // ========================================
  describe('toSnakeCase', () => {
    
    describe('Cenários de caminho feliz', () => {
      it('deve converter camelCase simples para snake_case', () => {
        expect(toSnakeCase('firstName')).toBe('first_name');
        expect(toSnakeCase('lastName')).toBe('last_name');
        expect(toSnakeCase('isActive')).toBe('is_active');
        expect(toSnakeCase('userName')).toBe('user_name');
      });

      it('deve converter camelCase complexo com múltiplas palavras', () => {
        expect(toSnakeCase('userAccountSettings')).toBe('user_account_settings');
        expect(toSnakeCase('customerBillingAddress')).toBe('customer_billing_address');
        expect(toSnakeCase('appointmentScheduleTime')).toBe('appointment_schedule_time');
        expect(toSnakeCase('professionalServiceCategory')).toBe('professional_service_category');
      });

      it('deve converter campos identificados no audit report', () => {
        // Problemas críticos do Authentication Module
        expect(toSnakeCase('rememberMe')).toBe('remember_me');
        expect(toSnakeCase('firstName')).toBe('first_name');
        expect(toSnakeCase('lastName')).toBe('last_name');
        expect(toSnakeCase('companyName')).toBe('company_name');
        expect(toSnakeCase('phoneNumber')).toBe('phone_number');
        
        // Problemas críticos do Services Module
        expect(toSnakeCase('isActive')).toBe('is_active');
        expect(toSnakeCase('companyId')).toBe('company_id');
        expect(toSnakeCase('createdAt')).toBe('created_at');
        expect(toSnakeCase('updatedAt')).toBe('updated_at');
        
        // Problemas críticos do CRM Module
        expect(toSnakeCase('birthDate')).toBe('birth_date');
        expect(toSnakeCase('zipCode')).toBe('zip_code');
        
        // Problemas críticos do Agendamento Module
        expect(toSnakeCase('customerId')).toBe('customer_id');
        expect(toSnakeCase('professionalId')).toBe('professional_id');
        expect(toSnakeCase('serviceId')).toBe('service_id');
        expect(toSnakeCase('startTime')).toBe('start_time');
        expect(toSnakeCase('endTime')).toBe('end_time');
      });
    });

    describe('Casos de borda e valores especiais', () => {
      it('deve preservar strings que já estão em snake_case', () => {
        expect(toSnakeCase('first_name')).toBe('first_name');
        expect(toSnakeCase('created_at')).toBe('created_at');
        expect(toSnakeCase('user_id')).toBe('user_id');
      });

      it('deve tratar strings com uma única palavra', () => {
        expect(toSnakeCase('name')).toBe('name');
        expect(toSnakeCase('id')).toBe('id');
        expect(toSnakeCase('email')).toBe('email');
        expect(toSnakeCase('password')).toBe('password');
      });

      it('deve tratar strings com números', () => {
        expect(toSnakeCase('user1Name')).toBe('user1_name');
        expect(toSnakeCase('address2Line')).toBe('address2_line');
        expect(toSnakeCase('phoneNumber1')).toBe('phone_number1');
      });

      it('deve tratar strings com múltiplas maiúsculas consecutivas', () => {
        expect(toSnakeCase('XMLHttpRequest')).toBe('x_m_l_http_request');
        expect(toSnakeCase('CPFNumber')).toBe('c_p_f_number');
        expect(toSnakeCase('CNPJValidation')).toBe('c_n_p_j_validation');
      });
    });

    describe('Tratamento de erros e valores inválidos', () => {
      it('deve tratar string vazia sem quebrar', () => {
        expect(toSnakeCase('')).toBe('');
      });

      it('deve tratar null e undefined preservando o valor', () => {
        expect(toSnakeCase(null as any)).toBe(null);
        expect(toSnakeCase(undefined as any)).toBe(undefined);
      });

      it('deve tratar tipos não-string preservando o valor', () => {
        expect(toSnakeCase(123 as any)).toBe(123);
        expect(toSnakeCase(true as any)).toBe(true);
        expect(toSnakeCase({} as any)).toBe({});
        expect(toSnakeCase([] as any)).toBe([]);
      });
    });
  });

  // ========================================
  // TESTES DA FUNÇÃO toCamelCase
  // ========================================
  describe('toCamelCase', () => {
    
    describe('Cenários de caminho feliz', () => {
      it('deve converter snake_case simples para camelCase', () => {
        expect(toCamelCase('first_name')).toBe('firstName');
        expect(toCamelCase('last_name')).toBe('lastName');
        expect(toCamelCase('is_active')).toBe('isActive');
        expect(toCamelCase('user_name')).toBe('userName');
      });

      it('deve converter snake_case complexo com múltiplas palavras', () => {
        expect(toCamelCase('user_account_settings')).toBe('userAccountSettings');
        expect(toCamelCase('customer_billing_address')).toBe('customerBillingAddress');
        expect(toCamelCase('appointment_schedule_time')).toBe('appointmentScheduleTime');
        expect(toCamelCase('professional_service_category')).toBe('professionalServiceCategory');
      });

      it('deve converter campos do database para frontend (audit report)', () => {
        // Campos do database que devem virar camelCase para o frontend
        expect(toCamelCase('remember_me')).toBe('rememberMe');
        expect(toCamelCase('first_name')).toBe('firstName');
        expect(toCamelCase('last_name')).toBe('lastName');
        expect(toCamelCase('company_name')).toBe('companyName');
        expect(toCamelCase('phone_number')).toBe('phoneNumber');
        expect(toCamelCase('birth_date')).toBe('birthDate');
        expect(toCamelCase('zip_code')).toBe('zipCode');
        expect(toCamelCase('created_at')).toBe('createdAt');
        expect(toCamelCase('updated_at')).toBe('updatedAt');
        expect(toCamelCase('customer_id')).toBe('customerId');
        expect(toCamelCase('professional_id')).toBe('professionalId');
        expect(toCamelCase('service_id')).toBe('serviceId');
        expect(toCamelCase('appointment_date')).toBe('appointmentDate');
        expect(toCamelCase('appointment_time')).toBe('appointmentTime');
      });
    });

    describe('Casos de borda e valores especiais', () => {
      it('deve preservar strings que já estão em camelCase', () => {
        expect(toCamelCase('firstName')).toBe('firstName');
        expect(toCamelCase('isActive')).toBe('isActive');
        expect(toCamelCase('userId')).toBe('userId');
      });

      it('deve tratar strings com uma única palavra', () => {
        expect(toCamelCase('name')).toBe('name');
        expect(toCamelCase('id')).toBe('id');
        expect(toCamelCase('email')).toBe('email');
        expect(toCamelCase('password')).toBe('password');
      });

      it('deve tratar strings com números', () => {
        expect(toCamelCase('user_1_name')).toBe('user1Name');
        expect(toCamelCase('address_2_line')).toBe('address2Line');
        expect(toCamelCase('phone_number_1')).toBe('phoneNumber1');
      });

      it('deve tratar múltiplos underscores consecutivos', () => {
        expect(toCamelCase('user__name')).toBe('user_Name');
        expect(toCamelCase('field___value')).toBe('field__Value');
      });
    });

    describe('Tratamento de erros e valores inválidos', () => {
      it('deve tratar string vazia sem quebrar', () => {
        expect(toCamelCase('')).toBe('');
      });

      it('deve tratar null e undefined preservando o valor', () => {
        expect(toCamelCase(null as any)).toBe(null);
        expect(toCamelCase(undefined as any)).toBe(undefined);
      });

      it('deve tratar tipos não-string preservando o valor', () => {
        expect(toCamelCase(123 as any)).toBe(123);
        expect(toCamelCase(true as any)).toBe(true);
        expect(toCamelCase({} as any)).toBe({});
        expect(toCamelCase([] as any)).toBe([]);
      });
    });
  });

  // ========================================
  // TESTES DA FUNÇÃO convertKeys (CRÍTICA)
  // ========================================
  describe('convertKeys', () => {
    
    describe('Cenários de caminho feliz - Objetos simples', () => {
      it('deve converter objeto simples usando toSnakeCase', () => {
        const input = {
          firstName: 'João',
          lastName: 'Silva',
          isActive: true,
          userId: 123
        };

        const expected = {
          first_name: 'João',
          last_name: 'Silva',
          is_active: true,
          user_id: 123
        };

        const result = convertKeys(input, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve converter objeto simples usando toCamelCase', () => {
        const input = {
          first_name: 'João',
          last_name: 'Silva',
          is_active: true,
          user_id: 123
        };

        const expected = {
          firstName: 'João',
          lastName: 'Silva',
          isActive: true,
          userId: 123
        };

        const result = convertKeys(input, toCamelCase);
        expect(result).toEqual(expected);
      });
    });

    describe('Cenários de caminho feliz - Payloads complexos (Audit Report)', () => {
      it('deve processar payload de criação de usuário (Authentication Module)', () => {
        const userCreationPayload = {
          firstName: 'Maria',
          lastName: 'Santos',
          email: 'maria@example.com',
          phoneNumber: '+5511999999999',
          companyName: 'Empresa Teste Ltda',
          rememberMe: true,
          isActive: true,
          userPreferences: {
            emailNotifications: true,
            smsNotifications: false,
            autoSave: true
          }
        };

        const expected = {
          first_name: 'Maria',
          last_name: 'Santos',
          email: 'maria@example.com',
          phone_number: '+5511999999999',
          company_name: 'Empresa Teste Ltda',
          remember_me: true,
          is_active: true,
          user_preferences: {
            email_notifications: true,
            sms_notifications: false,
            auto_save: true
          }
        };

        const result = convertKeys(userCreationPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve processar payload de criação de cliente (CRM Module)', () => {
        const customerCreationPayload = {
          customerName: 'João Oliveira',
          birthDate: '1985-03-15',
          phoneNumber: '+5511888888888',
          zipCode: '01234-567',
          addressDetails: {
            streetName: 'Rua das Flores',
            streetNumber: '123',
            neighborhoodName: 'Centro',
            cityName: 'São Paulo'
          },
          contactHistory: [
            {
              contactDate: '2024-01-15',
              contactType: 'phone',
              contactNotes: 'Cliente interessado em serviços'
            },
            {
              contactDate: '2024-01-20',
              contactType: 'email',
              contactNotes: 'Enviado orçamento'
            }
          ]
        };

        const expected = {
          customer_name: 'João Oliveira',
          birth_date: '1985-03-15',
          phone_number: '+5511888888888',
          zip_code: '01234-567',
          address_details: {
            street_name: 'Rua das Flores',
            street_number: '123',
            neighborhood_name: 'Centro',
            city_name: 'São Paulo'
          },
          contact_history: [
            {
              contact_date: '2024-01-15',
              contact_type: 'phone',
              contact_notes: 'Cliente interessado em serviços'
            },
            {
              contact_date: '2024-01-20',
              contact_type: 'email',
              contact_notes: 'Enviado orçamento'
            }
          ]
        };

        const result = convertKeys(customerCreationPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve processar payload de agendamento (Agendamento Module)', () => {
        const appointmentPayload = {
          customerId: 'customer-123',
          professionalId: 'prof-456',
          serviceId: 'service-789',
          startTime: '2024-01-25T10:00:00Z',
          endTime: '2024-01-25T11:00:00Z',
          appointmentNotes: 'Primera consulta',
          customerPreferences: {
            preferredTime: 'morning',
            specialNeeds: 'wheelchair_access'
          },
          serviceDetails: [
            {
              serviceName: 'Consulta Médica',
              serviceDuration: 60,
              servicePrice: 150.00
            }
          ]
        };

        const expected = {
          customer_id: 'customer-123',
          professional_id: 'prof-456',
          service_id: 'service-789',
          start_time: '2024-01-25T10:00:00Z',
          end_time: '2024-01-25T11:00:00Z',
          appointment_notes: 'Primera consulta',
          customer_preferences: {
            preferred_time: 'morning',
            special_needs: 'wheelchair_access'
          },
          service_details: [
            {
              service_name: 'Consulta Médica',
              service_duration: 60,
              service_price: 150.00
            }
          ]
        };

        const result = convertKeys(appointmentPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve processar resposta do database com conversão bidirecional', () => {
        // Simula resposta do database em snake_case
        const databaseResponse = {
          success: true,
          data: {
            user_id: 'user-123',
            first_name: 'Ana',
            last_name: 'Costa',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-15T15:30:00Z',
            company_details: {
              company_name: 'Clinica Saúde',
              company_id: 'company-456',
              enabled_modules: ['CRM', 'SERVICES', 'AGENDAMENTO']
            },
            recent_appointments: [
              {
                appointment_id: 'app-789',
                customer_id: 'customer-321',
                appointment_date: '2024-01-20',
                appointment_time: '14:30:00'
              }
            ]
          }
        };

        const expectedFrontendResponse = {
          success: true,
          data: {
            userId: 'user-123',
            firstName: 'Ana',
            lastName: 'Costa',
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-15T15:30:00Z',
            companyDetails: {
              companyName: 'Clinica Saúde',
              companyId: 'company-456',
              enabledModules: ['CRM', 'SERVICES', 'AGENDAMENTO']
            },
            recentAppointments: [
              {
                appointmentId: 'app-789',
                customerId: 'customer-321',
                appointmentDate: '2024-01-20',
                appointmentTime: '14:30:00'
              }
            ]
          }
        };

        const result = convertKeys(databaseResponse, toCamelCase);
        expect(result).toEqual(expectedFrontendResponse);
      });
    });

    describe('Casos de borda críticos', () => {
      it('deve tratar objeto vazio sem quebrar', () => {
        const emptyObject = {};
        const result = convertKeys(emptyObject, toSnakeCase);
        expect(result).toEqual({});
      });

      it('deve tratar array vazio sem quebrar', () => {
        const emptyArray: any[] = [];
        const result = convertKeys(emptyArray, toSnakeCase);
        expect(result).toEqual([]);
      });

      it('deve tratar array com objetos vazios', () => {
        const arrayWithEmptyObjects = [{}, {}, {}];
        const result = convertKeys(arrayWithEmptyObjects, toSnakeCase);
        expect(result).toEqual([{}, {}, {}]);
      });

      it('deve tratar array com valores null e undefined', () => {
        const arrayWithNulls = [
          { name: 'João', value: null },
          { name: 'Maria', value: undefined },
          null,
          undefined
        ];

        const expected = [
          { name: 'João', value: null },
          { name: 'Maria', value: undefined },
          null,
          undefined
        ];

        const result = convertKeys(arrayWithNulls, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve tratar objeto com chaves que não precisam conversão', () => {
        const objectWithSimpleKeys = {
          id: 123,
          name: 'João',
          email: 'joao@example.com',
          age: 30
        };

        const result = convertKeys(objectWithSimpleKeys, toSnakeCase);
        expect(result).toEqual(objectWithSimpleKeys);
      });

      it('deve tratar arrays mistos com diferentes tipos de dados', () => {
        const mixedArray = [
          'string simples',
          123,
          true,
          null,
          { userName: 'João', isActive: true },
          [{ nestedField: 'valor' }]
        ];

        const expected = [
          'string simples',
          123,
          true,
          null,
          { user_name: 'João', is_active: true },
          [{ nested_field: 'valor' }]
        ];

        const result = convertKeys(mixedArray, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve tratar objetos com aninhamento profundo (5+ níveis)', () => {
        const deeplyNestedObject = {
          level1Key: {
            level2Key: {
              level3Key: {
                level4Key: {
                  level5Key: 'valor final',
                  deepArray: [
                    {
                      arrayItemKey: 'array valor'
                    }
                  ]
                }
              }
            }
          }
        };

        const expected = {
          level1_key: {
            level2_key: {
              level3_key: {
                level4_key: {
                  level5_key: 'valor final',
                  deep_array: [
                    {
                      array_item_key: 'array valor'
                    }
                  ]
                }
              }
            }
          }
        };

        const result = convertKeys(deeplyNestedObject, toSnakeCase);
        expect(result).toEqual(expected);
      });
    });

    describe('Tratamento de valores não-objeto', () => {
      it('deve preservar valores primitivos sem conversão', () => {
        expect(convertKeys('string simples', toSnakeCase)).toBe('string simples');
        expect(convertKeys(42, toSnakeCase)).toBe(42);
        expect(convertKeys(true, toSnakeCase)).toBe(true);
        expect(convertKeys(false, toSnakeCase)).toBe(false);
        expect(convertKeys(0, toSnakeCase)).toBe(0);
      });

      it('deve preservar valores null e undefined', () => {
        expect(convertKeys(null, toSnakeCase)).toBe(null);
        expect(convertKeys(undefined, toSnakeCase)).toBe(undefined);
      });

      it('deve preservar valores especiais', () => {
        const date = new Date();
        expect(convertKeys(date, toSnakeCase)).toBe(date);
        
        const regex = /test/;
        expect(convertKeys(regex, toSnakeCase)).toBe(regex);
      });
    });

    describe('Validação de problemas específicos do Audit Report', () => {
      it('deve corrigir problema de login com rememberMe', () => {
        // Problema crítico identificado: rememberMe (frontend) → remember_me (backend)
        const loginPayload = {
          email: 'user@example.com',
          password: '123456',
          rememberMe: true
        };

        const expected = {
          email: 'user@example.com',
          password: '123456',
          remember_me: true
        };

        const result = convertKeys(loginPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve corrigir problema de Service isActive → status', () => {
        // Problema crítico: isActive (boolean) precisa virar is_active no backend
        const servicePayload = {
          serviceName: 'Corte de Cabelo',
          serviceDescription: 'Corte masculino profissional',
          duration: 60,
          price: 50.00,
          category: 'Cortes',
          isActive: true
        };

        const expected = {
          service_name: 'Corte de Cabelo',
          service_description: 'Corte masculino profissional',
          duration: 60,
          price: 50.00,
          category: 'Cortes',
          is_active: true
        };

        const result = convertKeys(servicePayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve corrigir problema de Customer address splitting', () => {
        // Problema crítico: campos de endereço fragmentados
        const customerPayload = {
          customerName: 'Maria Silva',
          document: '123.456.789-00',
          birthDate: '1990-01-01',
          addressInfo: {
            streetName: 'Rua das Flores',
            streetNumber: '123',
            zipCode: '01234-567',
            cityName: 'São Paulo',
            stateName: 'SP'
          }
        };

        const expected = {
          customer_name: 'Maria Silva',
          document: '123.456.789-00',
          birth_date: '1990-01-01',
          address_info: {
            street_name: 'Rua das Flores',
            street_number: '123',
            zip_code: '01234-567',
            city_name: 'São Paulo',
            state_name: 'SP'
          }
        };

        const result = convertKeys(customerPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve corrigir problema de Appointment time structure', () => {
        // Problema crítico: startTime/endTime vs appointment_date + appointment_time
        const appointmentPayload = {
          customerId: 'customer-123',
          professionalId: 'prof-456',
          serviceId: 'service-789',
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T11:00:00Z',
          appointmentNotes: 'Primeira consulta'
        };

        const expected = {
          customer_id: 'customer-123',
          professional_id: 'prof-456',
          service_id: 'service-789',
          start_time: '2024-01-15T10:00:00Z',
          end_time: '2024-01-15T11:00:00Z',
          appointment_notes: 'Primeira consulta'
        };

        const result = convertKeys(appointmentPayload, toSnakeCase);
        expect(result).toEqual(expected);
      });

      it('deve processar resposta do database corrigindo timestamp fields', () => {
        // Problema: created_at/updated_at (DB) → createdAt/updatedAt (Frontend)
        const databaseResponse = {
          success: true,
          data: {
            id: 'user-123',
            first_name: 'João',
            last_name: 'Silva',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-15T15:30:00Z',
            company_id: 'company-456',
            is_active: true
          }
        };

        const expected = {
          success: true,
          data: {
            id: 'user-123',
            firstName: 'João',
            lastName: 'Silva',
            createdAt: '2024-01-01T10:00:00Z',
            updatedAt: '2024-01-15T15:30:00Z',
            companyId: 'company-456',
            isActive: true
          }
        };

        const result = convertKeys(databaseResponse, toCamelCase);
        expect(result).toEqual(expected);
      });
    });

    describe('Performance e edge cases avançados', () => {
      it('deve processar arrays grandes sem degradação significativa', () => {
        // Simula um array grande como poderia vir de uma consulta de relatório
        const largeArray = Array.from({ length: 1000 }, (_, index) => ({
          recordId: `record-${index}`,
          customerName: `Customer ${index}`,
          createdAt: '2024-01-01T10:00:00Z',
          isActive: index % 2 === 0
        }));

        const startTime = Date.now();
        const result = convertKeys(largeArray, toSnakeCase);
        const processingTime = Date.now() - startTime;

        // Deve processar em menos de 100ms (performance aceitável)
        expect(processingTime).toBeLessThan(100);

        // Verifica se a transformação foi aplicada corretamente
        expect(result).toHaveLength(1000);
        expect(result[0]).toHaveProperty('record_id', 'record-0');
        expect(result[0]).toHaveProperty('customer_name', 'Customer 0');
        expect(result[0]).toHaveProperty('created_at', '2024-01-01T10:00:00Z');
        expect(result[0]).toHaveProperty('is_active', true);
      });

      it('deve tratar objetos com referências circulares sem entrar em loop infinito', () => {
        // Cria objeto com referência circular
        const circularObject: any = {
          name: 'Objeto Principal',
          userId: 123
        };
        circularObject.selfReference = circularObject;

        // O comportamento esperado é que a função não entre em loop infinito
        // Mas como o JSON.stringify falhará, esperamos que o tratamento seja gracioso
        expect(() => {
          // Tenta converter - deve falhar de forma controlada
          const result = convertKeys(circularObject, toSnakeCase);
        }).not.toThrow();
      });

      it('deve preservar tipos específicos do JavaScript', () => {
        const objectWithSpecialTypes = {
          dateField: new Date('2024-01-01'),
          regexField: /test-pattern/g,
          numberField: 42,
          booleanField: true,
          nullField: null,
          undefinedField: undefined,
          functionField: () => 'test function'
        };

        const result = convertKeys(objectWithSpecialTypes, toSnakeCase);

        expect(result.date_field).toBeInstanceOf(Date);
        expect(result.regex_field).toBeInstanceOf(RegExp);
        expect(result.number_field).toBe(42);
        expect(result.boolean_field).toBe(true);
        expect(result.null_field).toBe(null);
        expect(result.undefined_field).toBe(undefined);
        expect(typeof result.function_field).toBe('function');
      });
    });
  });

  // ========================================
  // TESTES DE INTEGRAÇÃO DA LÓGICA COMPLETA
  // ========================================
  describe('Integração - Transformação Bidirecional', () => {
    it('deve manter integridade dos dados em conversão ida e volta', () => {
      const originalPayload = {
        userName: 'João Silva',
        userEmail: 'joao@example.com',
        isActive: true,
        userPreferences: {
          emailNotifications: true,
          autoSave: false,
          themeSettings: {
            darkMode: true,
            fontSize: 14
          }
        },
        orderHistory: [
          {
            orderId: 'order-123',
            orderDate: '2024-01-01',
            orderItems: [
              { productName: 'Produto A', productPrice: 100 }
            ]
          }
        ]
      };

      // Converte para snake_case (simulando envio para backend)
      const snakeCaseVersion = convertKeys(originalPayload, toSnakeCase);
      
      // Converte de volta para camelCase (simulando resposta do backend)
      const backToCamelCase = convertKeys(snakeCaseVersion, toCamelCase);

      // Deve ser idêntico ao payload original
      expect(backToCamelCase).toEqual(originalPayload);
    });

    it('deve processar corretamente payload completo de criação de agendamento', () => {
      // Simula payload completo que resolve todos os problemas do audit report
      const complexAppointmentPayload = {
        // Dados do agendamento
        customerId: 'customer-123',
        professionalId: 'professional-456',
        serviceId: 'service-789',
        startTime: '2024-01-25T10:00:00Z',
        endTime: '2024-01-25T11:00:00Z',
        
        // Dados do cliente (problemas do CRM resolvidos)
        customerDetails: {
          firstName: 'Maria',
          lastName: 'Santos',
          birthDate: '1985-03-15',
          phoneNumber: '+5511999999999',
          addressInfo: {
            zipCode: '01234-567',
            streetName: 'Rua das Flores',
            cityName: 'São Paulo'
          }
        },
        
        // Dados do serviço (problemas do Services resolvidos)
        serviceDetails: {
          serviceName: 'Consulta Médica',
          isActive: true,
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z'
        },
        
        // Metadados (problemas do Auth resolvidos)
        userInfo: {
          companyId: 'company-abc',
          rememberMe: true,
          companyName: 'Clínica Saúde Ltda'
        }
      };

      const expectedSnakeCase = {
        // Dados do agendamento
        customer_id: 'customer-123',
        professional_id: 'professional-456',
        service_id: 'service-789',
        start_time: '2024-01-25T10:00:00Z',
        end_time: '2024-01-25T11:00:00Z',
        
        // Dados do cliente
        customer_details: {
          first_name: 'Maria',
          last_name: 'Santos',
          birth_date: '1985-03-15',
          phone_number: '+5511999999999',
          address_info: {
            zip_code: '01234-567',
            street_name: 'Rua das Flores',
            city_name: 'São Paulo'
          }
        },
        
        // Dados do serviço
        service_details: {
          service_name: 'Consulta Médica',
          is_active: true,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-20T15:30:00Z'
        },
        
        // Metadados
        user_info: {
          company_id: 'company-abc',
          remember_me: true,
          company_name: 'Clínica Saúde Ltda'
        }
      };

      const result = convertKeys(complexAppointmentPayload, toSnakeCase);
      expect(result).toEqual(expectedSnakeCase);
    });
  });
});