// ========================================
// TESTE DE VALIDAÇÃO DO SISTEMA DE AUTENTICAÇÃO
// ========================================
// Este arquivo contém testes para validar as correções implementadas no sistema de tokens JWT

/**
 * TESTE MANUAL - Execute estas funções no console do navegador para validar
 * 
 * EXECUÇÃO:
 * 1. Abra o DevTools (F12)
 * 2. Vá para a aba Console
 * 3. Cole e execute cada função individualmente
 * 4. Verifique os logs para confirmar que tudo está funcionando
 */

// ========================================
// FUNÇÃO 1: TESTAR PERSISTÊNCIA DE TOKEN
// ========================================
const testTokenPersistence = () => {
  console.log('🧪 TESTE 1: Persistência de Token');
  console.log('===============================');
  
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const testRefreshToken = 'refresh_token_test_123';
  
  // Limpar storage primeiro
  localStorage.clear();
  sessionStorage.clear();
  
  // Tentar salvar token
  localStorage.setItem('erp_nexus_token', testToken);
  localStorage.setItem('erp_nexus_refresh_token', testRefreshToken);
  localStorage.setItem('erp_nexus_token_timestamp', Date.now().toString());
  
  // Verificar se foi salvo
  const savedToken = localStorage.getItem('erp_nexus_token');
  const savedRefresh = localStorage.getItem('erp_nexus_refresh_token');
  const savedTimestamp = localStorage.getItem('erp_nexus_token_timestamp');
  
  console.log('✅ Resultado do teste de persistência:', {
    tokenSaved: savedToken === testToken,
    refreshSaved: savedRefresh === testRefreshToken,
    timestampSaved: !!savedTimestamp,
    tokenLength: savedToken?.length,
    tokenPreview: savedToken?.substring(0, 30) + '...'
  });
  
  // Simular refresh da página (verificar se persiste)
  setTimeout(() => {
    const persistedToken = localStorage.getItem('erp_nexus_token');
    console.log('✅ Token após "refresh" da página:', {
      persisted: persistedToken === testToken,
      length: persistedToken?.length,
      preview: persistedToken?.substring(0, 30) + '...'
    });
  }, 1000);
};

// ========================================
// FUNÇÃO 2: TESTAR VALIDAÇÃO DE TOKEN JWT
// ========================================
const testTokenValidation = () => {
  console.log('🧪 TESTE 2: Validação de Token JWT');
  console.log('==================================');
  
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const invalidTokens = [
    '',
    null,
    undefined,
    'invalid.token',
    'not.a.jwt.token',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Só header
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0' // Sem signature
  ];
  
  // Função de validação (replicada do código)
  const validateTokenIntegrity = (token) => {
    if (!token || typeof token !== 'string') return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      JSON.parse(atob(parts[0]));
      JSON.parse(atob(parts[1]));
      return true;
    } catch (error) {
      return false;
    }
  };
  
  // Testar token válido
  const validResult = validateTokenIntegrity(validToken);
  console.log('✅ Token válido:', {
    token: validToken.substring(0, 50) + '...',
    isValid: validResult,
    expected: true,
    passed: validResult === true
  });
  
  // Testar tokens inválidos
  invalidTokens.forEach((token, index) => {
    const result = validateTokenIntegrity(token);
    console.log(`✅ Token inválido ${index + 1}:`, {
      token: token?.toString().substring(0, 30) || 'null/undefined',
      isValid: result,
      expected: false,
      passed: result === false
    });
  });
};

// ========================================
// FUNÇÃO 3: TESTAR RECUPERAÇÃO DE TOKEN
// ========================================
const testTokenRetrieval = () => {
  console.log('🧪 TESTE 3: Recuperação de Token');
  console.log('================================');
  
  const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  
  // Limpar primeiro
  localStorage.clear();
  sessionStorage.clear();
  
  // Teste 1: Sem tokens
  console.log('✅ Teste sem tokens:', {
    localStorage: localStorage.getItem('erp_nexus_token'),
    sessionStorage: sessionStorage.getItem('erp_nexus_token'),
    expected: null
  });
  
  // Teste 2: Token no localStorage
  localStorage.setItem('erp_nexus_token', testToken);
  console.log('✅ Teste com localStorage:', {
    token: localStorage.getItem('erp_nexus_token')?.substring(0, 30) + '...',
    found: !!localStorage.getItem('erp_nexus_token'),
    expected: true
  });
  
  // Teste 3: Fallback para sessionStorage
  localStorage.removeItem('erp_nexus_token');
  sessionStorage.setItem('erp_nexus_token', testToken);
  
  // Simular a função getToken com fallback
  const getTokenWithFallback = () => {
    let token = localStorage.getItem('erp_nexus_token');
    if (token) return token;
    
    token = sessionStorage.getItem('erp_nexus_token');
    if (token) {
      // Migrar para localStorage
      localStorage.setItem('erp_nexus_token', token);
      sessionStorage.removeItem('erp_nexus_token');
      console.log('🔄 Token migrado do sessionStorage para localStorage');
      return token;
    }
    
    return null;
  };
  
  const fallbackToken = getTokenWithFallback();
  console.log('✅ Teste fallback sessionStorage:', {
    token: fallbackToken?.substring(0, 30) + '...',
    migratedToLocalStorage: !!localStorage.getItem('erp_nexus_token'),
    removedFromSessionStorage: !sessionStorage.getItem('erp_nexus_token'),
    expected: true
  });
};

// ========================================
// FUNÇÃO 4: TESTAR LIMPEZA DE TOKENS
// ========================================
const testTokenClearing = () => {
  console.log('🧪 TESTE 4: Limpeza de Tokens');
  console.log('=============================');
  
  const testToken = 'test_token_123';
  const testRefreshToken = 'test_refresh_123';
  
  // Configurar tokens em todos os storages
  localStorage.setItem('erp_nexus_token', testToken);
  localStorage.setItem('erp_nexus_refresh_token', testRefreshToken);
  localStorage.setItem('erp_nexus_token_timestamp', Date.now().toString());
  sessionStorage.setItem('erp_nexus_token', testToken);
  localStorage.setItem('erp-nexus-auth', JSON.stringify({ test: true }));
  
  console.log('✅ Estado antes da limpeza:', {
    localStorage_token: !!localStorage.getItem('erp_nexus_token'),
    localStorage_refresh: !!localStorage.getItem('erp_nexus_refresh_token'),
    localStorage_timestamp: !!localStorage.getItem('erp_nexus_token_timestamp'),
    sessionStorage_token: !!sessionStorage.getItem('erp_nexus_token'),
    zustand_auth: !!localStorage.getItem('erp-nexus-auth')
  });
  
  // Função de limpeza (replicada do código)
  const clearAllTokens = () => {
    localStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp_nexus_refresh_token');
    localStorage.removeItem('erp_nexus_token_timestamp');
    sessionStorage.removeItem('erp_nexus_token');
    localStorage.removeItem('erp-nexus-auth');
  };
  
  clearAllTokens();
  
  console.log('✅ Estado após a limpeza:', {
    localStorage_token: localStorage.getItem('erp_nexus_token'),
    localStorage_refresh: localStorage.getItem('erp_nexus_refresh_token'),
    localStorage_timestamp: localStorage.getItem('erp_nexus_token_timestamp'),
    sessionStorage_token: sessionStorage.getItem('erp_nexus_token'),
    zustand_auth: localStorage.getItem('erp-nexus-auth'),
    allCleared: (
      !localStorage.getItem('erp_nexus_token') &&
      !localStorage.getItem('erp_nexus_refresh_token') &&
      !localStorage.getItem('erp_nexus_token_timestamp') &&
      !sessionStorage.getItem('erp_nexus_token') &&
      !localStorage.getItem('erp-nexus-auth')
    )
  });
};

// ========================================
// FUNÇÃO 5: TESTAR RACE CONDITIONS
// ========================================
const testRaceConditions = async () => {
  console.log('🧪 TESTE 5: Race Conditions');
  console.log('===========================');
  
  // Simular múltiplas chamadas simultâneas
  let refreshCount = 0;
  let isRefreshing = false;
  let refreshPromise = null;
  
  const simulateRefresh = async (id) => {
    console.log(`🔄 Refresh ${id} iniciado`);
    
    if (isRefreshing && refreshPromise) {
      console.log(`⏳ Refresh ${id} aguardando refresh em andamento`);
      return refreshPromise;
    }
    
    isRefreshing = true;
    refreshCount++;
    
    refreshPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log(`✅ Refresh ${id} concluído`);
        resolve(`new_token_${id}`);
        isRefreshing = false;
        refreshPromise = null;
      }, 1000);
    });
    
    return refreshPromise;
  };
  
  console.log('🚀 Iniciando 5 refreshes simultâneos...');
  
  const promises = [];
  for (let i = 1; i <= 5; i++) {
    promises.push(simulateRefresh(i));
  }
  
  const results = await Promise.all(promises);
  
  console.log('✅ Resultados dos refreshes:', {
    results,
    totalRefreshes: refreshCount,
    expected: 1,
    raceConditionPrevented: refreshCount === 1
  });
};

// ========================================
// FUNÇÃO 6: EXECUTAR TODOS OS TESTES
// ========================================
const runAllTests = async () => {
  console.log('🧪 EXECUTANDO TODOS OS TESTES DE AUTENTICAÇÃO');
  console.log('===========================================');
  
  try {
    testTokenPersistence();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    testTokenValidation();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testTokenRetrieval();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testTokenClearing();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testRaceConditions();
    
    console.log('🎉 TODOS OS TESTES CONCLUÍDOS!');
    console.log('============================');
    console.log('Verifique os logs acima para confirmar que tudo está funcionando corretamente.');
    
  } catch (error) {
    console.error('❌ Erro durante execução dos testes:', error);
  }
};

// ========================================
// INSTRUÇÕES DE USO
// ========================================
console.log(`
📋 INSTRUÇÕES PARA TESTAR O SISTEMA DE AUTENTICAÇÃO:

1. Para testar persistência de token:
   testTokenPersistence()

2. Para testar validação de JWT:
   testTokenValidation()

3. Para testar recuperação com fallback:
   testTokenRetrieval()

4. Para testar limpeza de tokens:
   testTokenClearing()

5. Para testar race conditions:
   testRaceConditions()

6. Para executar todos os testes:
   runAllTests()

Execute no console do navegador (F12 -> Console)
`);

// Exportar para uso em testes automatizados (se necessário)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testTokenPersistence,
    testTokenValidation,
    testTokenRetrieval,
    testTokenClearing,
    testRaceConditions,
    runAllTests
  };
}