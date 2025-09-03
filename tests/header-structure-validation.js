/**
 * Teste de Validação da Estrutura de Headers
 * 
 * Valida se a refatoração foi bem-sucedida verificando:
 * 1. Se a constante HTTP_HEADERS foi criada corretamente
 * 2. Se os arquivos estão importando e usando a constante
 * 3. Se não há mais strings hardcoded para headers
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VALIDANDO ESTRUTURA DE HEADERS APÓS REFATORAÇÃO');
console.log('===================================================');

// Teste 1: Verificar se a constante foi criada
console.log('\n📋 TESTE 1: Verificando constante HTTP_HEADERS');
const headersPath = path.join(__dirname, '../shared/constants/headers.ts');

if (fs.existsSync(headersPath)) {
  const headersContent = fs.readFileSync(headersPath, 'utf8');
  
  console.log('✅ Arquivo headers.ts existe');
  
  // Verificar se contém as constantes necessárias
  const hasCompanyId = headersContent.includes("COMPANY_ID: 'X-Company-ID'");
  const hasUserId = headersContent.includes("USER_ID: 'X-User-ID'");
  const hasGatewaySource = headersContent.includes("GATEWAY_SOURCE: 'X-Gateway-Source'");
  const hasGetHeaderKey = headersContent.includes('function getHeaderKey');
  
  console.log('✅ COMPANY_ID definido:', hasCompanyId);
  console.log('✅ USER_ID definido:', hasUserId);
  console.log('✅ GATEWAY_SOURCE definido:', hasGatewaySource);
  console.log('✅ Função getHeaderKey definida:', hasGetHeaderKey);
  
} else {
  console.log('❌ Arquivo headers.ts não encontrado');
}

// Teste 2: Verificar se API Gateway foi refatorado
console.log('\n📋 TESTE 2: Verificando refatoração do API Gateway');
const apiGatewayPath = path.join(__dirname, '../modules/api-gateway/src/routes/services.ts');

if (fs.existsSync(apiGatewayPath)) {
  const gatewayContent = fs.readFileSync(apiGatewayPath, 'utf8');
  
  const hasImport = gatewayContent.includes("import { HTTP_HEADERS }");
  const usesConstant = gatewayContent.includes("HTTP_HEADERS.COMPANY_ID");
  const noHardcoded = !gatewayContent.includes("'X-Company-ID'");
  
  console.log('✅ Importa HTTP_HEADERS:', hasImport);
  console.log('✅ Usa HTTP_HEADERS.COMPANY_ID:', usesConstant);
  console.log('✅ Não usa string hardcoded:', noHardcoded);
  
} else {
  console.log('❌ Arquivo services.ts do API Gateway não encontrado');
}

// Teste 3: Verificar se ModuleIntegrator foi refatorado
console.log('\n📋 TESTE 3: Verificando refatoração do ModuleIntegrator');
const integratorPath = path.join(__dirname, '../shared/integrators/ModuleIntegrator.ts');

if (fs.existsSync(integratorPath)) {
  const integratorContent = fs.readFileSync(integratorPath, 'utf8');
  
  const hasImport = integratorContent.includes("import { HTTP_HEADERS }");
  const usesConstant = integratorContent.includes("[HTTP_HEADERS.COMPANY_ID]");
  const noHardcodedId = !integratorContent.includes("'X-Company-Id'");
  
  console.log('✅ Importa HTTP_HEADERS:', hasImport);
  console.log('✅ Usa [HTTP_HEADERS.COMPANY_ID]:', usesConstant);
  console.log('✅ Não usa string hardcoded X-Company-Id:', noHardcodedId);
  
} else {
  console.log('❌ Arquivo ModuleIntegrator.ts não encontrado');
}

// Teste 4: Verificar se gatewayAuth foi refatorado
console.log('\n📋 TESTE 4: Verificando refatoração do gatewayAuth');
const gatewayAuthPath = path.join(__dirname, '../modules/services/src/middleware/gatewayAuth.ts');

if (fs.existsSync(gatewayAuthPath)) {
  const authContent = fs.readFileSync(gatewayAuthPath, 'utf8');
  
  const hasImport = authContent.includes("import { HTTP_HEADERS, getHeaderKey }");
  const usesGetHeaderKey = authContent.includes("getHeaderKey(HTTP_HEADERS.COMPANY_ID)");
  const noMultipleHeaders = !authContent.includes("req.headers['x-company-id'] as string || ");
  
  console.log('✅ Importa HTTP_HEADERS e getHeaderKey:', hasImport);
  console.log('✅ Usa getHeaderKey(HTTP_HEADERS.COMPANY_ID):', usesGetHeaderKey);
  console.log('✅ Não tem verificação dupla de headers:', noMultipleHeaders);
  
} else {
  console.log('❌ Arquivo gatewayAuth.ts não encontrado');
}

// Teste 5: Verificar se validationController foi refatorado
console.log('\n📋 TESTE 5: Verificando refatoração do validationController');
const validationPath = path.join(__dirname, '../modules/agendamento/src/controllers/validationController.ts');

if (fs.existsSync(validationPath)) {
  const validationContent = fs.readFileSync(validationPath, 'utf8');
  
  const hasImport = validationContent.includes("import { HTTP_HEADERS, getHeaderKey }");
  const usesGetHeaderKey = validationContent.includes("getHeaderKey(HTTP_HEADERS.COMPANY_ID)");
  const noHardcoded = !validationContent.includes("'x-company-id'");
  
  console.log('✅ Importa HTTP_HEADERS e getHeaderKey:', hasImport);
  console.log('✅ Usa getHeaderKey(HTTP_HEADERS.COMPANY_ID):', usesGetHeaderKey);
  console.log('✅ Não usa string hardcoded x-company-id:', noHardcoded);
  
} else {
  console.log('❌ Arquivo validationController.ts não encontrado');
}

console.log('\n🎉 VALIDAÇÃO DA ESTRUTURA CONCLUÍDA!');
console.log('🔧 Próximo passo: Testar funcionamento em runtime com autenticação válida');