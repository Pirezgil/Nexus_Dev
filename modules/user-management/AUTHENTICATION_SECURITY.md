# 🔐 Sistema de Autenticação e Segurança - Nexus ERP

## 📋 Visão Geral

Este documento detalha a implementação completa do sistema de recuperação de senha e verificação de email para o módulo User Management do Nexus ERP, incluindo todas as funcionalidades de segurança implementadas.

## ✅ Funcionalidades Implementadas

### 🔑 Password Reset Flow Completo
- **Forgot Password**: Geração segura de tokens com hash SHA-256
- **Reset Password**: Validação e troca segura de senhas
- **Tokens seguros**: Expiração em 10 minutos, uso único
- **Rate Limiting**: 3 tentativas por IP a cada 15 minutos
- **Auditoria**: Logs completos de todas as operações

### 📧 Email Verification System
- **Registro com verificação**: Novos usuários ficam PENDING até verificar email
- **Templates profissionais**: Emails HTML responsivos e texto simples
- **Tokens seguros**: Expiração em 24 horas, uso único
- **Reenvio controlado**: Rate limiting de 2 tentativas por 5 minutos
- **Redirect inteligente**: Suporte a HTML e JSON responses

### 🛡️ Rate Limiting Avançado
- **Login**: 5 tentativas por IP/email a cada 15 minutos
- **Password Reset**: 3 tentativas por IP/email a cada 15 minutos
- **Email Verification**: 2 reenvios por IP/email a cada 5 minutos
- **Registration**: 2 registros por IP por hora
- **Token Validation**: 60 validações por minuto
- **Change Password**: 3 mudanças por usuário a cada 30 minutos

### 📨 Sistema de Email Robusto
- **Templates HTML**: Design responsivo e profissional
- **Fallback de texto**: Versões em texto simples
- **Configuração flexível**: Suporte a diferentes provedores SMTP
- **Error handling**: Logs detalhados sem falhar operações críticas

## 🚀 Como Usar

### 1. Configuração de Environment Variables

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@nexuserp.com
EMAIL_FROM_NAME=Nexus ERP

# URLs para links nos emails
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:5000
```

### 2. Instalação de Dependências

```bash
cd modules/user-management
npm install
```

### 3. Executar Migrações do Banco

```bash
npm run db:generate
npm run db:migrate
```

### 4. Executar Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Executar testes com coverage
npm test -- --coverage
```

## 🔗 Endpoints Implementados

### Password Reset Flow

#### `POST /auth/forgot-password`
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Se o email existir, você receberá instruções para redefinir sua senha"
}
```

#### `POST /auth/reset-password`
```json
{
  "token": "secure-token-from-email",
  "password": "newSecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Senha redefinida com sucesso"
}
```

### Email Verification Flow

#### `GET /auth/verify-email/:token`
- **HTML Request**: Redireciona para frontend com status
- **JSON Request**: Retorna resposta JSON

**Success Response:**
```json
{
  "success": true,
  "message": "Email verificado com sucesso! Sua conta foi ativada."
}
```

#### `POST /auth/resend-verification`
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Se o email existir e não estiver verificado, você receberá um novo link"
}
```

## 🔒 Recursos de Segurança

### Token Security
- **Geração**: `crypto.randomBytes(32).toString('hex')`
- **Armazenamento**: Hash SHA-256 no banco de dados
- **Uso único**: Tokens invalidados após uso
- **Expiração**: 10min (password) / 24h (email verification)

### Rate Limiting
- **Baseado em IP + Email**: Prevenção de ataques targeted
- **Headers padrão**: `X-RateLimit-*` headers
- **Logs de segurança**: Todas as violações são logadas
- **Retry-After**: Informação de quando tentar novamente

### Audit Trail
- **Password Reset**: Log completo com timestamp
- **Email Verification**: Rastreamento de todas as verificações
- **Rate Limit Violations**: Logs de tentativas suspeitas
- **Session Management**: Revogação automática de sessões

## 📊 Estrutura do Banco de Dados

### PasswordResetRequest
```sql
CREATE TABLE password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR NOT NULL,
  token VARCHAR UNIQUE NOT NULL, -- Hash SHA-256
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### EmailVerification
```sql
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR NOT NULL,
  token VARCHAR UNIQUE NOT NULL, -- Token original
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🧪 Testes Implementados

### Password Reset Tests
- ✅ Geração de token seguro
- ✅ Envio de email
- ✅ Validação de token
- ✅ Reset de senha
- ✅ Rate limiting
- ✅ Fluxo completo

### Email Verification Tests
- ✅ Registro com verificação
- ✅ Verificação de email
- ✅ Ativação de conta
- ✅ Reenvio de verificação
- ✅ Rate limiting
- ✅ Fluxo completo

### Rate Limiting Tests
- ✅ Todos os endpoints protegidos
- ✅ Limites corretos
- ✅ Headers apropriados
- ✅ Logs de segurança

### Coverage Mínimo
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 95%+
- **Lines**: 90%+

## 📈 Monitoramento e Logs

### Logs de Segurança
```typescript
// Exemplo de log de password reset
logger.info('Password reset token generated', {
  userId: user.id,
  email: user.email,
  expiresAt: resetTokenExpires,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});
```

### Métricas Importantes
- **Rate limit violations**: Número de violações por endpoint
- **Failed authentication attempts**: Tentativas de login falhadas
- **Password reset requests**: Frequência de solicitações
- **Email verification success rate**: Taxa de verificações bem-sucedidas

## ⚠️ Considerações de Produção

### Configuração de Email
- **Gmail**: Usar App Passwords ao invés da senha principal
- **SendGrid**: Configurar API key nas variáveis de ambiente
- **AWS SES**: Configurar credenciais IAM apropriadas

### Rate Limiting em Produção
```typescript
// Para alta disponibilidade, usar Redis como store
const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  // ... outras configurações
});
```

### Logs de Produção
- **Structured logging**: JSON format para análise
- **Log aggregation**: Usar Elasticsearch, CloudWatch, etc.
- **Alertas**: Configurar alertas para violações de segurança

## 🚨 Alerts e Monitoramento

### Alertas Críticos
- **Multiple password reset attempts**: > 50 por hora
- **High rate limit violations**: > 100 por minuto
- **Failed email sending**: > 10% de falha na entrega
- **Unusual authentication patterns**: Detecção de anomalias

### Health Checks
```typescript
// Verificar conectividade SMTP
await emailService.verifyConnection();

// Verificar rate limiting
await redis.ping();

// Verificar banco de dados
await prisma.$queryRaw`SELECT 1`;
```

## 📚 Referencias e Padrões

### Security Standards
- **OWASP Authentication Cheat Sheet**
- **NIST Password Guidelines**
- **JWT Best Practices**
- **Rate Limiting Strategies**

### Code Standards
- **TypeScript Strict Mode**: Tipagem segura
- **ESLint Security Rules**: Regras de segurança
- **Prettier**: Formatação consistente
- **Jest Testing**: Coverage mínimo de 90%

## 🎯 Próximos Passos

### Melhorias Futuras
- [ ] **2FA Integration**: Autenticação de dois fatores
- [ ] **OAuth2 Support**: Login social (Google, Microsoft)
- [ ] **Device Management**: Controle de dispositivos confiáveis
- [ ] **Advanced Audit**: Logs mais detalhados com geolocalização
- [ ] **Machine Learning**: Detecção de comportamento suspeito

### Otimizações de Performance
- [ ] **Connection Pooling**: Pool de conexões para email
- [ ] **Caching Strategy**: Cache de tokens e rate limits
- [ ] **Background Jobs**: Queue para envio de emails
- [ ] **Database Indexing**: Índices otimizados para queries

---

## 📞 Suporte

Para questões sobre a implementação ou problemas de segurança, entre em contato com a equipe de desenvolvimento:

- **Email**: dev@nexuserp.com
- **Discord**: #nexus-dev
- **Issues**: GitHub Issues

---

*Documentação gerada automaticamente pelo Claude Code - Última atualização: $(date)*