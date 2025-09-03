// Script para decodificar JWT token
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzNTkwNzU5ZC05NzQ5LTRhYjMtYjVkNC0wMjAzMTJlMmZmNjciLCJlbWFpbCI6Im1hbmFnZXJAbmV4dXMuY29tIiwiZmlyc3ROYW1lIjoiTWFuYWdlciIsImxhc3ROYW1lIjoiRGVtbyIsInJvbGUiOiJNQU5BR0VSIiwiY29tcGFueUlkIjoiOWI3ODM2MGMtZWJlOS00ZjBhLTk3OWYtNTU5ODY2ZTNjZDA1IiwiaWF0IjoxNzM2NDUxMjc0LCJleHAiOjE3MzY0NTQ4NzR9";

try {
  // Decodificar a parte do payload (segunda parte após o primeiro ponto)
  const payload = token.split('.')[1];
  const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
  const parsedPayload = JSON.parse(decodedPayload);
  
  console.log('JWT Token Decoded:');
  console.log(JSON.stringify(parsedPayload, null, 2));
} catch (error) {
  console.error('Erro ao decodificar token:', error.message);
}