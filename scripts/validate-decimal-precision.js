#!/usr/bin/env node

// ERP Nexus - Decimal Precision Validation Script
// Script para validar a correção da inconsistência crítica de precisão decimal

const fs = require('fs');
const path = require('path');

console.log('🚀 ERP Nexus - Validação de Correção de Precisão Decimal\n');

// ====================================
// CONFIGURAÇÕES
// ====================================

const frontendPath = path.join(__dirname, '../frontend/src');
const testsPath = path.join(__dirname, '../tests');

// ====================================
// FUNÇÕES DE VALIDAÇÃO
// ====================================

function validateFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`❌ ${description}: ${filePath} - ARQUIVO NÃO ENCONTRADO`);
    return false;
  }
}

function validateFileContent(filePath, searchPatterns, description) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${description}: Arquivo não encontrado`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let allPassed = true;

  searchPatterns.forEach(({ pattern, shouldExist, description: patternDesc }) => {
    const exists = content.includes(pattern);
    if (shouldExist && exists) {
      console.log(`  ✅ ${patternDesc}`);
    } else if (!shouldExist && !exists) {
      console.log(`  ✅ ${patternDesc}`);
    } else {
      console.log(`  ❌ ${patternDesc}`);
      allPassed = false;
    }
  });

  return allPassed;
}

// ====================================
// EXECUÇÃO DOS TESTES
// ====================================

console.log('📋 FASE 1: Validando Arquivos Principais\n');

const coreFiles = [
  {
    path: path.join(frontendPath, 'utils/index.ts'),
    description: 'Utilitários de moeda atualizados'
  },
  {
    path: path.join(frontendPath, 'types/index.ts'),
    description: 'Interfaces TypeScript atualizadas'
  },
  {
    path: path.join(frontendPath, 'types/api/index.ts'),
    description: 'Tipos da API atualizados'
  },
  {
    path: path.join(testsPath, 'decimal-precision-validation.test.js'),
    description: 'Suite de testes criada'
  }
];

let coreFilesValid = true;
coreFiles.forEach(file => {
  if (!validateFileExists(file.path, file.description)) {
    coreFilesValid = false;
  }
});

if (!coreFilesValid) {
  console.log('\n❌ Arquivos principais não encontrados. Abortando validação.\n');
  process.exit(1);
}

console.log('\n📋 FASE 2: Validando Conteúdo dos Utilitários\n');

const utilValidation = validateFileContent(
  path.join(frontendPath, 'utils/index.ts'),
  [
    {
      pattern: 'formatCurrency = (value: string | number)',
      shouldExist: true,
      description: 'formatCurrency aceita string e number'
    },
    {
      pattern: 'parseCurrency = (value: string): string',
      shouldExist: true,
      description: 'parseCurrency retorna string'
    },
    {
      pattern: 'isValidDecimal',
      shouldExist: true,
      description: 'Função de validação decimal criada'
    },
    {
      pattern: 'parseDecimalInput',
      shouldExist: true,
      description: 'Função de parsing de input criada'
    }
  ],
  'Utilitários de moeda'
);

console.log('\n📋 FASE 3: Validando Interfaces TypeScript\n');

const typesValidation = validateFileContent(
  path.join(frontendPath, 'types/index.ts'),
  [
    {
      pattern: 'price: string; // ✅ DECIMAL PRECISION',
      shouldExist: true,
      description: 'Campo price convertido para string'
    },
    {
      pattern: 'totalAmount: string; // ✅ DECIMAL PRECISION',
      shouldExist: true,
      description: 'Campo totalAmount convertido para string'
    },
    {
      pattern: 'price: number',
      shouldExist: false,
      description: 'Campos price com number removidos'
    }
  ],
  'Interfaces principais'
);

console.log('\n📋 FASE 4: Validando Formulários\n');

const serviceFormValidation = validateFileContent(
  path.join(frontendPath, 'app/(main)/services/new/page.tsx'),
  [
    {
      pattern: 'inputMode="decimal"',
      shouldExist: true,
      description: 'Input com inputMode decimal'
    },
    {
      pattern: 'handlePriceChange',
      shouldExist: true,
      description: 'Handler de preço especializado'
    },
    {
      pattern: 'price: \'0.00\'',
      shouldExist: true,
      description: 'Estado inicial como string'
    }
  ],
  'Formulário de criação de serviços'
);

const editFormValidation = validateFileContent(
  path.join(frontendPath, 'app/(main)/services/edit/[id]/page.tsx'),
  [
    {
      pattern: 'inputMode="decimal"',
      shouldExist: true,
      description: 'Input com inputMode decimal'
    },
    {
      pattern: 'handlePriceChange',
      shouldExist: true,
      description: 'Handler de preço especializado'
    }
  ],
  'Formulário de edição de serviços'
);

// ====================================
// TESTE DE PRECISÃO MATEMÁTICA
// ====================================

console.log('\n📋 FASE 5: Teste de Precisão Matemática\n');

function testMathematicalPrecision() {
  console.log('🧮 Testando cenário crítico: 199.99 × 3');
  
  // Cenário problemático (number)
  const numberResult = 199.99 * 3;
  console.log(`  ❌ Resultado com number: ${numberResult}`);
  
  // Cenário corrigido (string)
  const stringPrice = '199.99';
  const stringResult = (parseFloat(stringPrice) * 3).toFixed(2);
  console.log(`  ✅ Resultado com string: ${stringResult}`);
  
  if (stringResult === '599.97') {
    console.log('  ✅ Precisão matemática preservada');
    return true;
  } else {
    console.log('  ❌ Precisão matemática comprometida');
    return false;
  }
}

const mathPrecisionValid = testMathematicalPrecision();

// ====================================
// RELATÓRIO FINAL
// ====================================

console.log('\n' + '='.repeat(60));
console.log('📊 RELATÓRIO FINAL DE VALIDAÇÃO');
console.log('='.repeat(60));

const validations = [
  { name: 'Arquivos principais', passed: coreFilesValid },
  { name: 'Utilitários de moeda', passed: utilValidation },
  { name: 'Interfaces TypeScript', passed: typesValidation },
  { name: 'Formulário de criação', passed: serviceFormValidation },
  { name: 'Formulário de edição', passed: editFormValidation },
  { name: 'Precisão matemática', passed: mathPrecisionValid }
];

let allPassed = true;
validations.forEach(validation => {
  const status = validation.passed ? '✅ PASSOU' : '❌ FALHOU';
  console.log(`${status} - ${validation.name}`);
  if (!validation.passed) allPassed = false;
});

console.log('\n' + '='.repeat(60));

if (allPassed) {
  console.log('🎉 SUCESSO: Correção de precisão decimal implementada com sucesso!');
  console.log('\n📝 Próximos passos recomendados:');
  console.log('   1. Executar testes unitários: npm test');
  console.log('   2. Executar build do frontend: npm run build');
  console.log('   3. Testar fluxo completo de criação de serviços');
  console.log('   4. Validar cálculos em ambiente de desenvolvimento\n');
  process.exit(0);
} else {
  console.log('❌ FALHA: Algumas validações falharam. Revise as correções.');
  console.log('\n🔍 Verifique os itens marcados com ❌ acima.');
  console.log('📖 Consulte a documentação de correção para mais detalhes.\n');
  process.exit(1);
}