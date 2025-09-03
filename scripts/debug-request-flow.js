#!/usr/bin/env node

/**
 * Script para Debug do Fluxo de Requisição
 * 
 * Este script simula uma requisição para /api/services
 * para verificar se os headers estão sendo passados corretamente
 */

const https = require('http'); // usando http pois é localhost

async function debugRequestFlow() {
  console.log('🔍 DEBUGGING REQUEST FLOW PARA /api/services...\n');

  // Primeiro, vamos fazer uma requisição direta ao API Gateway
  console.log('🌐 Fazendo requisição ao API Gateway...');
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/services',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test-token', // Token de teste
      'Accept': 'application/json',
      'User-Agent': 'Debug-Script/1.0',
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log('📊 Status da resposta:', res.statusCode);
      console.log('📋 Headers de resposta:');
      
      Object.entries(res.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('\n📄 Corpo da resposta:');
        try {
          const parsedData = JSON.parse(data);
          console.log(JSON.stringify(parsedData, null, 2));
        } catch (error) {
          console.log(data);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error.message);
      reject(error);
    });

    req.setTimeout(10000, () => {
      console.error('⏰ Timeout na requisição');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Executar debug
debugRequestFlow()
  .then(() => {
    console.log('\n✅ Debug do fluxo de requisição concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha no debug:', error.message);
    process.exit(1);
  });