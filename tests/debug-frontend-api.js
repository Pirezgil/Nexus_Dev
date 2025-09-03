// Debug script para testar chamadas da API pelo frontend
// Executar no console do navegador na página http://localhost:3000/services

console.log('🔍 Iniciando debug da API de serviços no frontend...');

// Teste 1: Verificar se a API está acessível
console.log('\n📡 Teste 1: Verificar API Gateway');
fetch('/api/services/health')
  .then(response => response.json())
  .then(data => console.log('✅ Health check:', data))
  .catch(error => console.error('❌ Health check failed:', error));

// Teste 2: Verificar autenticação
console.log('\n🔑 Teste 2: Verificar token de autenticação');
const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
console.log('Token present:', !!token);
console.log('Token length:', token?.length || 0);

// Teste 3: Fazer chamada autenticada para /api/services
console.log('\n📋 Teste 3: Chamar /api/services');
fetch('/api/services?limit=5', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response ok:', response.ok);
  return response.json();
})
.then(data => {
  console.log('✅ API Response:', data);
  
  // Verificar estrutura dos dados
  if (data.data && data.data.length > 0) {
    const firstService = data.data[0];
    console.log('\n🔍 Análise do primeiro serviço:');
    console.log('- id:', firstService.id);
    console.log('- name:', firstService.name);
    console.log('- price:', firstService.price);
    console.log('- isActive:', firstService.isActive);
    console.log('- professionals_count:', firstService.professionals_count);
    console.log('- _count:', firstService._count);
  }
  
  // Verificar KPIs
  if (data.stats) {
    console.log('\n📊 KPIs encontrados:', data.stats);
  } else {
    console.log('\n❌ KPIs ausentes');
  }
})
.catch(error => {
  console.error('❌ API call failed:', error);
});

// Teste 4: Verificar store de autenticação
console.log('\n🏪 Teste 4: Verificar store de autenticação');
// Se usando Zustand, tentar acessar o store
try {
  // Tentar acessar store global se disponível
  if (window.authStore) {
    console.log('Auth store state:', window.authStore.getState());
  }
} catch (e) {
  console.log('Store not accessible from window');
}

// Teste 5: Verificar erros de rede
console.log('\n🌐 Teste 5: Verificar configuração de rede');
console.log('Current URL:', window.location.href);
console.log('Base URL:', window.location.origin);

console.log('\n✅ Debug script executado. Verifique os logs acima para identificar problemas.');