// Teste simplificado da API para verificar estrutura básica
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyOTU1MjVjNS0xOWI3LTQxMGQtOWY0ZS1hY2FlZTFjZDEzMjQiLCJjb21wYW55SWQiOiIwY2JkMGJlMy1lZjY3LTRjNjYtYTYyNC04MzIyNTM2NjVmMWIiLCJyb2xlIjoiTUFOQUdFUiIsInNlc3Npb25JZCI6IjdjZmIwNTdkLWFhMTEtNGViOS1hODQ2LWI1MWI4YmJmZTJlMiIsInBlcm1pc3Npb25zIjpbIkNSTTpyZWFkIiwiQ1JNOndyaXRlIiwiQUdFTkRBTUVOVE86cmVhZCIsIkFHRU5EQU1FTlRPOndyaXRlIiwiU0VSVklDRVM6cmVhZCIsIlNFUlZJQ0VTOndyaXRlIiwiQU5BTFlUSUNTOnJlYWQiLCJVU0VSX01BTkFHRU1FTlQ6cmVhZCJdLCJpYXQiOjE3NTY3Njc2MjMsImV4cCI6MTc1Njg1NDAyM30.k_TyyXMxv2xfXVm9CpXuq9uJLIUYUsAI5Z4KmKOeDZo';

async function testBasicAPI() {
  console.log('🧪 Testando API simplificada...\n');

  try {
    // Testar chamada direta ao módulo de serviços (bypass do gateway)
    console.log('📡 Teste 1: Chamada direta ao módulo services');
    const directResponse = await fetch('http://localhost:5005/api/services?limit=2', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'X-Company-ID': '0cbd0be3-ef67-4c66-a624-832253665f1b',
        'X-User-ID': '295525c5-19b7-410d-9f4e-acaee1cd1324'
      }
    });
    
    if (directResponse.ok) {
      const directData = await directResponse.json();
      console.log('✅ Resposta direta do módulo services:', JSON.stringify(directData, null, 2));
    } else {
      const errorData = await directResponse.json();
      console.log('❌ Erro na chamada direta:', errorData);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // Testar chamada via gateway
    console.log('📡 Teste 2: Chamada via API Gateway');
    const gatewayResponse = await fetch('http://localhost:5001/api/services?limit=2', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (gatewayResponse.ok) {
      const gatewayData = await gatewayResponse.json();
      console.log('✅ Resposta via gateway:', JSON.stringify(gatewayData, null, 2));
    } else {
      const errorData = await gatewayResponse.json();
      console.log('❌ Erro via gateway:', errorData);
    }

  } catch (error) {
    console.error('❌ Erro no teste gateway:', error.message);
  }
}

testBasicAPI().catch(console.error);