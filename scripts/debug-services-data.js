#!/usr/bin/env node

/**
 * Script de Debug - Verificar Dados de Serviços
 * 
 * Este script verifica:
 * 1. Se existem serviços cadastrados no banco
 * 2. Se o filtro por company_id está funcionando
 * 3. Se há dados de teste para a empresa do usuário logado
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://nexus_user:nexus_password@localhost:5432/nexus_db?schema=nexus_services"
    }
  }
});

async function debugServicesData() {
  console.log('🔍 INICIANDO DEBUG DOS DADOS DE SERVIÇOS...\n');

  try {
    // 1. Verificar total de serviços na tabela
    const totalServices = await prisma.service.count();
    console.log(`📊 Total de serviços na tabela: ${totalServices}`);

    if (totalServices === 0) {
      console.log('❌ PROBLEMA ENCONTRADO: Não há serviços cadastrados no banco de dados!');
      console.log('\n💡 SOLUÇÕES:');
      console.log('1. Criar serviços de teste');
      console.log('2. Verificar se há dados seed');
      console.log('3. Criar serviços pela interface');
      
      // Criar um serviço de teste
      console.log('\n🔧 Criando serviço de teste...');
      
      const testService = await prisma.service.create({
        data: {
          companyId: '550e8400-e29b-41d4-a716-446655440001', // UUID de exemplo
          name: 'Corte de Cabelo',
          description: 'Corte de cabelo tradicional',
          price: 25.00,
          duration: 30,
          category: 'Cabelo',
          status: 'ACTIVE'
        }
      });
      
      console.log('✅ Serviço de teste criado:', testService.name);
    }

    // 2. Listar serviços por empresa
    const servicesByCompany = await prisma.service.groupBy({
      by: ['companyId'],
      _count: {
        id: true
      }
    });

    console.log('\n📋 Serviços por empresa:');
    for (const group of servicesByCompany) {
      console.log(`  - Company ID: ${group.companyId} | Serviços: ${group._count.id}`);
    }

    // 3. Verificar serviços ativos
    const activeServices = await prisma.service.count({
      where: {
        status: 'ACTIVE'
      }
    });
    console.log(`\n✅ Serviços ativos: ${activeServices}`);

    // 4. Simular consulta do controller
    const testCompanyId = '550e8400-e29b-41d4-a716-446655440001';
    console.log(`\n🧪 Testando consulta para company_id: ${testCompanyId}`);
    
    const servicesForCompany = await prisma.service.findMany({
      where: {
        companyId: testCompanyId
      },
      select: {
        id: true,
        name: true,
        price: true,
        status: true,
        createdAt: true
      }
    });

    console.log(`📊 Serviços encontrados para a empresa: ${servicesForCompany.length}`);
    
    if (servicesForCompany.length > 0) {
      console.log('\n📄 Dados dos serviços:');
      servicesForCompany.forEach((service, index) => {
        console.log(`  ${index + 1}. ${service.name} - R$ ${service.price} - ${service.status}`);
      });
    } else {
      console.log('⚠️  Nenhum serviço encontrado para esta empresa');
    }

    // 5. Verificar estrutura da tabela
    console.log('\n🔍 Verificando estrutura da tabela...');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Service' AND table_schema = 'nexus_services'
    `;
    console.log('Colunas da tabela Service:', tableInfo);

  } catch (error) {
    console.error('❌ Erro durante o debug:', error);
    
    if (error.code === 'P2002') {
      console.log('💡 Erro de constraint única - serviço já existe');
    } else if (error.code === 'P2021') {
      console.log('💡 Tabela não existe - verificar migrations');
    } else if (error.code === 'P1001') {
      console.log('💡 Erro de conexão com banco de dados');
      console.log('   - Verificar se o container PostgreSQL está rodando');
      console.log('   - Verificar URL de conexão');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Executar debug
debugServicesData()
  .then(() => {
    console.log('\n✅ Debug concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Falha no debug:', error);
    process.exit(1);
  });