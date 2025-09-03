// Script para verificar token JWT
const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzNTkwNzU5ZC05NzQ5LTRhYjMtYjVkNC0wMjAzMTJlMmZmNjciLCJlbWFpbCI6Im1hbmFnZXJAbmV4dXMuY29tIiwiZmlyc3ROYW1lIjoiTWFuYWdlciIsImxhc3ROYW1lIjoiRGVtbyIsInJvbGUiOiJNQU5BR0VSIiwiY29tcGFueUlkIjoiOWI3ODM2MGMtZWJlOS00ZjBhLTk3OWYtNTU5ODY2ZTNjZDA1IiwiaWF0IjoxNzM2NDUxMjc0LCJleHAiOjE3MzY0NTQ4NzR9";
const secret = 'your-super-secret-jwt-key-change-in-production';

try {
  const decoded = jwt.verify(token, secret);
  console.log('✅ Token válido!');
  console.log('Dados decodificados:');
  console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
  console.log('❌ Token inválido:', error.message);
  
  // Tentar com outros possíveis secrets
  const possibleSecrets = [
    'nexus-jwt-secret',
    'super-secret-key',
    'development-secret',
    'jwt-secret-key'
  ];
  
  console.log('\nTentando outros possíveis secrets...');
  
  for (const testSecret of possibleSecrets) {
    try {
      const decoded = jwt.verify(token, testSecret);
      console.log(`✅ Token válido com secret: "${testSecret}"`);
      console.log('Dados decodificados:');
      console.log(JSON.stringify(decoded, null, 2));
      break;
    } catch (err) {
      console.log(`❌ Não funciona com: "${testSecret}"`);
    }
  }
}