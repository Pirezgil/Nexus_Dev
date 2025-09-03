// ERP Nexus - Decimal Precision Validation Tests
// Testes para validar a correção da inconsistência crítica de precisão decimal

import { 
  formatCurrency, 
  parseCurrency, 
  isValidDecimal, 
  parseDecimalInput,
  formatDecimalInput 
} from '../frontend/src/utils/index.ts';

describe('Decimal Precision Correction Validation', () => {
  
  // ====================================
  // 1. TESTE DE FORMATAÇÃO DE MOEDA
  // ====================================
  
  describe('formatCurrency', () => {
    test('deve formatar strings decimais corretamente', () => {
      expect(formatCurrency('199.99')).toBe('R$ 199,99');
      expect(formatCurrency('0.01')).toBe('R$ 0,01');
      expect(formatCurrency('1500.50')).toBe('R$ 1.500,50');
    });

    test('deve formatar números corretamente (compatibilidade)', () => {
      expect(formatCurrency(199.99)).toBe('R$ 199,99');
      expect(formatCurrency(0.01)).toBe('R$ 0,01');
      expect(formatCurrency(1500.50)).toBe('R$ 1.500,50');
    });

    test('deve lidar com valores inválidos', () => {
      expect(formatCurrency('invalid')).toBe('R$ 0,00');
      expect(formatCurrency('')).toBe('R$ 0,00');
      expect(formatCurrency(NaN)).toBe('R$ 0,00');
    });
  });

  // ====================================
  // 2. TESTE DE PARSING DE MOEDA
  // ====================================
  
  describe('parseCurrency', () => {
    test('deve converter moeda formatada para string decimal', () => {
      expect(parseCurrency('R$ 199,99')).toBe('199.99');
      expect(parseCurrency('1.500,50')).toBe('1500.50');
      expect(parseCurrency('0,01')).toBe('0.01');
    });

    test('deve lidar com entrada apenas numérica', () => {
      expect(parseCurrency('199,99')).toBe('199.99');
      expect(parseCurrency('199.99')).toBe('199.99');
    });

    test('deve retornar 0.00 para valores inválidos', () => {
      expect(parseCurrency('abc')).toBe('0.00');
      expect(parseCurrency('')).toBe('0.00');
      expect(parseCurrency('R$ abc')).toBe('0.00');
    });
  });

  // ====================================
  // 3. TESTE DE VALIDAÇÃO DECIMAL
  // ====================================
  
  describe('isValidDecimal', () => {
    test('deve validar strings decimais válidas', () => {
      expect(isValidDecimal('199.99')).toBe(true);
      expect(isValidDecimal('0.01')).toBe(true);
      expect(isValidDecimal('1500.5')).toBe(true);
      expect(isValidDecimal('100')).toBe(true);
    });

    test('deve rejeitar strings decimais inválidas', () => {
      expect(isValidDecimal('199.999')).toBe(false); // Mais de 2 casas decimais
      expect(isValidDecimal('abc')).toBe(false);
      expect(isValidDecimal('199,99')).toBe(false); // Vírgula em vez de ponto
      expect(isValidDecimal('')).toBe(false);
    });
  });

  // ====================================
  // 4. TESTE DE CONVERSÃO DE INPUT
  // ====================================
  
  describe('parseDecimalInput & formatDecimalInput', () => {
    test('deve converter input brasileiro para decimal', () => {
      expect(parseDecimalInput('199,99')).toBe('199.99');
      expect(parseDecimalInput('1.500,50')).toBe('1500.50');
      expect(parseDecimalInput('0,01')).toBe('0.01');
    });

    test('deve formatar decimal para input brasileiro', () => {
      expect(formatDecimalInput('199.99')).toBe('199,99');
      expect(formatDecimalInput('1500.50')).toBe('1500,50');
      expect(formatDecimalInput('0.01')).toBe('0,01');
    });
  });

  // ====================================
  // 5. TESTE DE CENÁRIO CRÍTICO
  // ====================================
  
  describe('Precision Loss Prevention', () => {
    test('deve prevenir perda de precisão em cálculos', () => {
      const price = '199.99';
      const quantity = 3;
      
      // Convertemos para número apenas no momento do cálculo
      const total = (parseFloat(price) * quantity).toFixed(2);
      
      expect(total).toBe('599.97'); // Exato, sem perda de precisão
      expect(formatCurrency(total)).toBe('R$ 599,97');
    });

    test('deve manter precisão em operações complexas', () => {
      const prices = ['199.99', '299.50', '99.01'];
      
      const total = prices
        .map(price => parseFloat(price))
        .reduce((sum, price) => sum + price, 0)
        .toFixed(2);
      
      expect(total).toBe('598.50');
      expect(formatCurrency(total)).toBe('R$ 598,50');
    });

    test('deve lidar corretamente com valores existentes do banco', () => {
      // Simula valor vindo do Prisma (Decimal serializado como string)
      const priceFromDB = '199.99';
      
      // Deve formatar corretamente
      expect(formatCurrency(priceFromDB)).toBe('R$ 199,99');
      
      // Deve validar como decimal válido
      expect(isValidDecimal(priceFromDB)).toBe(true);
      
      // Deve permitir cálculos precisos
      const discountedPrice = (parseFloat(priceFromDB) * 0.9).toFixed(2);
      expect(discountedPrice).toBe('179.99');
    });
  });

  // ====================================
  // 6. TESTE DE COMPATIBILIDADE
  // ====================================
  
  describe('Backward Compatibility', () => {
    test('deve lidar com valores number legados', () => {
      const legacyPrice = 199.99; // number do sistema antigo
      
      expect(formatCurrency(legacyPrice)).toBe('R$ 199,99');
    });

    test('deve converter valores legados para string format', () => {
      const legacyPrices = [199.99, 299.50, 99.01];
      const convertedPrices = legacyPrices.map(price => price.toFixed(2));
      
      convertedPrices.forEach(price => {
        expect(typeof price).toBe('string');
        expect(isValidDecimal(price)).toBe(true);
      });
    });
  });

  // ====================================
  // 7. TESTE DE EDGE CASES
  // ====================================
  
  describe('Edge Cases', () => {
    test('deve lidar com valores muito pequenos', () => {
      expect(formatCurrency('0.01')).toBe('R$ 0,01');
      expect(parseCurrency('R$ 0,01')).toBe('0.01');
    });

    test('deve lidar com valores muito grandes', () => {
      expect(formatCurrency('999999.99')).toBe('R$ 999.999,99');
      expect(parseCurrency('R$ 999.999,99')).toBe('999999.99');
    });

    test('deve lidar com zeros', () => {
      expect(formatCurrency('0.00')).toBe('R$ 0,00');
      expect(parseCurrency('R$ 0,00')).toBe('0.00');
    });
  });
});

// ====================================
// TESTE DE INTEGRAÇÃO
// ====================================

describe('Integration Test - Service Form Workflow', () => {
  test('deve simular fluxo completo de criação de serviço', () => {
    // 1. Usuário digita valor no formulário (formato brasileiro)
    const userInput = '199,99';
    
    // 2. Sistema converte para formato decimal
    const decimalValue = parseDecimalInput(userInput);
    expect(decimalValue).toBe('199.99');
    
    // 3. Sistema valida o valor
    expect(isValidDecimal(decimalValue)).toBe(true);
    
    // 4. Valor é armazenado no estado (string)
    const formData = {
      name: 'Corte de Cabelo',
      price: decimalValue, // '199.99'
    };
    
    // 5. Valor é enviado para API (string)
    expect(typeof formData.price).toBe('string');
    
    // 6. Valor é exibido formatado na UI
    const displayValue = formatCurrency(formData.price);
    expect(displayValue).toBe('R$ 199,99');
    
    // 7. Cálculo com o valor (ex: desconto de 10%)
    const discountedPrice = (parseFloat(formData.price) * 0.9).toFixed(2);
    expect(discountedPrice).toBe('179.99');
    expect(formatCurrency(discountedPrice)).toBe('R$ 179,99');
  });
});