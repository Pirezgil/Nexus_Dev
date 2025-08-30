# User Management Module - Nexus ERP

Sistema de autenticação JWT multi-tenant para o Nexus ERP.

## 🔧 Funcionalidades

### Autenticação
- Login/Logout com JWT
- Refresh Token
- Recuperação de senha
- Validação de token para outros módulos
- Registro de empresa com usuário admin

### Gerenciamento de Usuários
- CRUD completo de usuários
- Roles (Admin, Manager, User, Viewer)
- Status (Active, Inactive, Pending, Suspended)
- Multi-tenant (isolamento por empresa)
- Auditoria completa

### Segurança
- Senhas hasheadas com bcrypt
- Rate limiting
- Sessões gerenciadas via Redis
- Logs de auditoria
- Headers de segurança (Helmet)

## 🚀 Tecnologias

- **Node.js** + **TypeScript**
- **Express.js**
- **Prisma ORM** + **PostgreSQL**
- **JWT** para autenticação
- **Redis** para cache e sessões
- **Zod** para validação
- **Winston** para logging
- **Docker** para containerização

## 📁 Estrutura

```
src/
├── controllers/     # Controllers Express
├── services/        # Lógica de negócio
├── routes/          # Rotas da API
├── middleware/      # Middlewares
├── types/           # Tipos TypeScript
└── utils/           # Utilitários
```

## 🔗 Endpoints Principais

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `POST /auth/refresh` - Renovar token
- `GET /auth/validate` - Validar token
- `GET /auth/me` - Dados do usuário atual
- `POST /auth/register` - Registrar empresa
- `POST /auth/forgot-password` - Solicitar redefinição
- `POST /auth/reset-password` - Redefinir senha

### Usuários
- `GET/POST /users` - Listar/Criar usuários
- `GET/PUT/DELETE /users/:id` - Operações específicas
- `GET/PUT /users/profile` - Perfil do usuário
- `GET /users/stats` - Estatísticas
- `POST /users/:id/activate` - Ativar usuário
- `POST /users/:id/deactivate` - Desativar usuário

### Health Check
- `GET /health` - Status do serviço
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## 🏗️ Setup de Desenvolvimento

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar ambiente:**
```bash
cp .env.example .env
# Editar .env com suas configurações
```

3. **Setup do banco:**
```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

4. **Executar em desenvolvimento:**
```bash
npm run dev
```

## 🐳 Docker

**Build:**
```bash
docker build -t nexus-user-management .
```

**Run:**
```bash
docker run -p 5000:5000 --env-file .env nexus-user-management
```

## 🔒 Variáveis de Ambiente

Consulte `.env.example` para todas as variáveis disponíveis.

### Essenciais:
- `DATABASE_URL` - URL do PostgreSQL
- `REDIS_URL` - URL do Redis
- `JWT_SECRET` - Chave secreta JWT (mínimo 32 caracteres)

## 👥 Usuários Demo

Após executar `npm run db:seed`:

- **Admin:** admin@nexuserp.com / 123456789
- **Manager:** manager@nexuserp.com / 123456789
- **User:** usuario1@nexuserp.com / 123456789

## 📊 Multi-Tenant

O sistema isola dados por `companyId`:
- Usuários só acessam dados de sua empresa
- Middleware `enforceCompanyAccess` garante isolamento
- JWT inclui `companyId` no payload

## 🔐 Roles e Permissões

- **ADMIN:** Acesso total ao sistema
- **MANAGER:** Gerenciar usuários e dados
- **USER:** Acesso básico às funcionalidades
- **VIEWER:** Apenas visualização

## 📝 Logs e Auditoria

- **Winston** para logs estruturados
- **Audit Logs** para ações críticas
- Logs incluem contexto da requisição
- Retenção configurável

## 🎯 Health Check

O módulo expõe endpoints de saúde para monitoramento:
- Conexão com banco de dados
- Conexão com Redis
- Métricas de performance
- Status geral do serviço

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm run start        # Executar build de produção
npm run db:generate  # Gerar cliente Prisma
npm run db:migrate   # Executar migrations
npm run db:seed      # Popular banco com dados demo
npm run db:studio    # Abrir Prisma Studio
npm run test         # Executar testes
npm run lint         # Linting
npm run format       # Formatação
```

## 🌐 Integração com Outros Módulos

Este módulo fornece autenticação centralizada via:
- Header `Authorization: Bearer <token>`
- Endpoint `/auth/validate` para validação
- Payload JWT com `userId`, `companyId`, `role`

Exemplo de uso em outros módulos:
```typescript
const response = await fetch('http://user-management:5000/auth/validate', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const user = await response.json();
```