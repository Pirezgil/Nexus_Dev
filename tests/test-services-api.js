// Script para testar os endpoints de serviços
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyOTU1MjVjNS0xOWI3LTQxMGQtOWY0ZS1hY2FlZTFjZDEzMjQiLCJjb21wYW55SWQiOiIwY2JkMGJlMy1lZjY3LTRjNjYtYTYyNC04MzIyNTM2NjVmMWIiLCJyb2xlIjoiTUFOQUdFUiIsInNlc3Npb25JZCI6IjdjZmIwNTdkLWFhMTEtNGViOS1hODQ2LWI1MWI4YmJmZTJlMiIsInBlcm1pc3Npb25zIjpbIkNSTTpyZWFkIiwiQ1JNOndyaXRlIiwiQUdFTkRBTUVOVE86cmVhZCIsIkFHRU5EQU1FTlRPOndyaXRlIiwiU0VSVklDRVM6cmVhZCIsIlNFUlZJQ0VTOndyaXRlIiwiQU5BTFlUSUNTOnJlYWQiLCJVU0VSX01BTkFHRU1FTlQ6cmVhZCJdLCJpYXQiOjE3NTY3Njc2MjMsImV4cCI6MTc1Njg1NDAyM30.k_TyyXMxv2xfXVm9CpXuq9uJLIUYUsAI5Z4KmKOeDZo';

async function testServicesAPI() {
  console.log('🧪 Testando APIs de serviços...\n');

  // Teste 1: Listar serviços
  console.log('📋 Teste 1: GET /api/services');
  try {
    const response = await fetch('http://localhost:5001/api/services?limit=3', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ Resposta:', JSON.stringify(data, null, 2));
    
    // Verificar se tem stats
    if (data.stats) {
      console.log('✅ KPIs/stats presentes:', data.stats);
    } else {
      console.log('❌ KPIs/stats ausentes');
    }
    
    // Verificar se tem professionals_count
    if (data.data && data.data.length > 0 && data.data[0].professionals_count !== undefined) {
      console.log('✅ professionals_count presente:', data.data[0].professionals_count);
    } else {
      console.log('❌ professionals_count ausente');
    }
    
    // Verificar se tem isActive
    if (data.data && data.data.length > 0 && data.data[0].isActive !== undefined) {
      console.log('✅ isActive presente:', data.data[0].isActive);
    } else {
      console.log('❌ isActive ausente');
    }
    
  } catch (error) {
    console.log('❌ Erro no teste 1:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 2: Criar serviço com UTF-8
  console.log('📝 Teste 2: POST /api/services (com caracteres especiais)');
  try {
    const serviceData = {
      name: 'Serviço de Manicure e Pedicure',
      description: 'Cuidado completo das unhas com esmalte e decoração',
      price: 25.50,
      duration: 45,
      category: 'Estética'
    };
    
    const response = await fetch('http://localhost:5001/api/services', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(serviceData)
    });
    
    const data = await response.json();
    console.log('✅ Serviço criado:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.log('❌ Erro no teste 2:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 3: Verificar novamente a listagem
  console.log('🔄 Teste 3: GET /api/services (após criação)');
  try {
    const response = await fetch('http://localhost:5001/api/services?limit=2', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 Total de serviços:', data.pagination?.total || 'N/A');
    console.log('📈 KPIs:', data.stats || 'Ausente');
    
    if (data.data && data.data.length > 0) {
      console.log('🎯 Primeiro serviço:', {
        name: data.data[0].name,
        professionals_count: data.data[0].professionals_count,
        isActive: data.data[0].isActive,
        _count: data.data[0]._count
      });
    }
    
  } catch (error) {
    console.log('❌ Erro no teste 3:', error.message);
  }
}

// Executar testes
testServicesAPI().catch(console.error);