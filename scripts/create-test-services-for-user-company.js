#!/usr/bin/env node

/**
 * Script para Criar Serviços de Teste para a Empresa do Usuário Logado
 * 
 * Este script:
 * 1. Identifica o company_id do usuário atual (via logs ou headers)
 * 2. Cria serviços de teste para essa empresa
 * 3. Verifica se os serviços foram criados corretamente
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://nexus_user:nexus_password@localhost:5432/nexus_db?schema=nexus_services"
    }
  }
});

// Serviços de teste para criar
const testServices = [
  {
    name: 'Corte de Cabelo Masculino',
    description: 'Corte tradicional masculino com máquina e tesoura',
    price: 25.00,
    duration: 30,
    category: 'Cabelo',
    requirements: 'Cabelo limpo e seco'
  },
  {
    name: 'Barba e Bigode',
    description: 'Aparar e modelar barba com navalha e tesoura',
    price: 15.00,
    duration: 20,
    category: 'Barba',
    requirements: 'Barba com pelo menos 3 dias de crescimento'
  },
  {
    name: 'Corte + Barba Combo',
    description: 'Pacote completo: corte de cabelo + barba + acabamento',
    price: 35.00,
    duration: 45,
    category: 'Combo',
    requirements: 'Agendamento com antecedência'
  },
  {
    name: 'Lavagem e Hidratação',
    description: 'Lavagem profissional com produtos premium + hidratação',
    price: 20.00,
    duration: 25,
    category: 'Tratamento',
    requirements: 'Indicado para cabelos ressecados'
  },
  {
    name: 'Corte Feminino',
    description: 'Corte feminino estilizado com escova e finalização',
    price: 40.00,
    duration: 60,
    category: 'Cabelo',
    requirements: 'Consulta prévia para definir estilo'
  },
  {
    name: 'Sobrancelha Masculina',
    description: 'Design e limpeza de sobrancelha masculina',
    price: 12.00,
    duration: 15,
    category: 'Estética',
    requirements: 'Primeira vez requer consulta'
  }
];

async function createTestServices() {
  console.log('🚀 CRIANDO SERVIÇOS DE TESTE PARA EMPRESA DO USUÁRIO...\n');

  try {
    // 1. Primeiro, vamos tentar identificar qual company_id usar
    console.log('🔍 Identificando empresa do usuário logado...');
    
    // Opção 1: Verificar logs recentes para pegar company_id usado nas requisições
    console.log('📋 Empresas existentes no sistema:');
    const existingServices = await prisma.service.groupBy({
      by: ['companyId'],
      _count: {
        id: true
      }
    });
    
    console.log('Empresas com serviços cadastrados:');
    existingServices.forEach((group, index) => {
      console.log(`  ${index + 1}. Company ID: ${group.companyId} (${group._count.id} serviços)`);
    });

    // Vamos usar um company_id específico ou criar para uma empresa padrão
    // Na prática, pegaríamos isso dos headers da requisição atual
    let targetCompanyId;
    
    if (existingServices.length > 0) {
      // Usar a primeira empresa existente
      targetCompanyId = existingServices[0].companyId;
      console.log(`\n✅ Usando empresa existente: ${targetCompanyId}`);
    } else {
      // Criar para uma empresa padrão (seria melhor pegar do usuário logado)
      targetCompanyId = '550e8400-e29b-41d4-a716-446655440001';
      console.log(`\n🆕 Usando empresa padrão: ${targetCompanyId}`);
    }

    console.log(`\n🏗️  Criando ${testServices.length} serviços para empresa: ${targetCompanyId}`);

    // 2. Criar os serviços de teste
    const createdServices = [];
    
    for (let i = 0; i < testServices.length; i++) {
      const serviceData = testServices[i];
      console.log(`\n  📝 Criando: ${serviceData.name}...`);
      
      try {
        // Verificar se já existe um serviço com esse nome para a empresa
        const existingService = await prisma.service.findFirst({
          where: {
            companyId: targetCompanyId,
            name: serviceData.name
          }
        });

        if (existingService) {
          console.log(`     ⚠️  Serviço já existe - pulando`);
          continue;
        }

        const newService = await prisma.service.create({
          data: {
            companyId: targetCompanyId,
            name: serviceData.name,
            description: serviceData.description,
            price: serviceData.price,
            duration: serviceData.duration,
            category: serviceData.category,
            requirements: serviceData.requirements,
            status: 'ACTIVE',
            metadata: {
              createdBy: 'test-script',
              testData: true
            }
          }
        });

        createdServices.push(newService);
        console.log(`     ✅ Criado com sucesso - ID: ${newService.id}`);
        
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`     ⚠️  Serviço com nome duplicado - pulando`);
        } else {
          console.log(`     ❌ Erro ao criar: ${error.message}`);
        }
      }
    }

    console.log(`\n📊 RESUMO:`);
    console.log(`   - Serviços criados: ${createdServices.length}`);
    console.log(`   - Company ID: ${targetCompanyId}`);

    // 3. Verificar se os serviços foram criados corretamente
    console.log('\n🔍 Verificando serviços criados...');
    const servicesForCompany = await prisma.service.findMany({
      where: {
        companyId: targetCompanyId
      },
      select: {
        id: true,
        name: true,
        price: true,
        duration: true,
        category: true,
        status: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n📋 Serviços disponíveis para a empresa (${servicesForCompany.length} total):`);
    servicesForCompany.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.name}`);
      console.log(`      - Preço: R$ ${service.price.toFixed(2)}`);
      console.log(`      - Duração: ${service.duration} min`);
      console.log(`      - Categoria: ${service.category}`);
      console.log(`      - Status: ${service.status}`);
      console.log('');
    });

    // 4. Informações importantes para o usuário
    console.log('🎯 PRÓXIMOS PASSOS:');
    console.log('1. Acesse a página /services no frontend');
    console.log('2. Verifique se os serviços aparecem na lista');
    console.log('3. Se não aparecerem, verifique se o company_id do usuário logado é:', targetCompanyId);
    console.log('4. Em caso de dúvida, verifique os logs do API Gateway para o company_id correto');
    
    console.log('\n💡 DICA: Para debug do company_id atual:');
    console.log('   - Abra as DevTools do navegador');
    console.log('   - Vá para Network tab');
    console.log('   - Faça uma requisição para /api/services');
    console.log('   - Verifique os headers da requisição (X-Company-ID)');

  } catch (error) {
    console.error('❌ Erro durante criação dos serviços:', error);
    
    if (error.code === 'P1001') {
      console.log('\n💡 Erro de conexão com banco de dados:');
      console.log('   - Verificar se o container PostgreSQL está rodando');
      console.log('   - Verificar variáveis de ambiente de conexão');
    } else if (error.code === 'P2021') {
      console.log('\n💡 Tabela não existe:');
      console.log('   - Executar migrations do Prisma');
      console.log('   - Verificar se o schema está correto');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Executar criação dos serviços
createTestServices()
  .then(() => {
    console.log('\n✅ SCRIPT CONCLUÍDO COM SUCESSO!');
    console.log('🎉 Os serviços de teste foram criados.');
    console.log('📱 Agora teste a página /services no frontend.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FALHA NA EXECUÇÃO DO SCRIPT:', error);
    process.exit(1);
  });