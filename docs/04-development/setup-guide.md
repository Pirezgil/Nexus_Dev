# Setup Guide - Nexus ERP

Guia completo para configurar ambiente de desenvolvimento local.

## 🛠️ Pré-requisitos

### **Software Necessário**
- **Node.js** >= 18.x
- **Docker** >= 20.x
- **Docker Compose** >= 2.x
- **Git** >= 2.x
- **VSCode** (recomendado)

### **Extensões VSCode Recomendadas**
- TypeScript and JavaScript
- Prisma
- Docker
- GitLens
- ES7+ React/Redux/React-Native snippets

## 🚀 Setup Inicial

### **1. Clone do Repositório**
```bash
git clone https://github.com/your-org/nexus-erp.git
cd nexus-erp
```

### **2. Setup Docker Environment**
```bash
# Copiar arquivo de ambiente
cp .env.example .env

# Subir infraestrutura (PostgreSQL + Redis)
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Verificar se containers estão rodando
docker-compose ps
```

### **3. Setup Módulos**

#### **User Management**
```bash
cd modules/user-management
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
**URL:** http://localhost:5001

#### **CRM**
```bash
cd modules/crm
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
**URL:** http://localhost:5004

#### **Services**
```bash
cd modules/services
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
**URL:** http://localhost:5003

#### **Agendamento**
```bash
cd modules/agendamento
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
**URL:** http://localhost:5008

### **4. Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```
**URL:** http://localhost:5000 (Docker) ou http://localhost:3000 (Local Dev)

## ⚙️ Configuração de Ambiente

### **Arquivo .env Principal**
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/nexus_erp

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Ambiente
NODE_ENV=development
```

### **Portas por Módulo**
| Serviço | Porta | URL |
|:--------|:-----:|:----|
| Frontend (Docker) | 5000 | http://localhost:5000 |
| Frontend (Local Dev) | 3000 | http://localhost:3000 |
| User Management | 5003 | http://localhost:5003 |
| CRM | 5004 | http://localhost:5004 |
| Services | 5005 | http://localhost:5005 |
| Agendamento | 5008 | http://localhost:5008 |
| PostgreSQL | 5433 | localhost:5433 |
| Redis | 6379 | localhost:6379 |

## 🗄️ Database Setup

### **Estrutura Multi-Schema**
```sql
-- Schemas criados automaticamente pelas migrations
nexus_auth           -- User Management
nexus_crm            -- CRM
nexus_services       -- Services  
nexus_agendamento    -- Agendamento
nexus_shared         -- Logs e auditoria
```

### **Comandos Úteis**
```bash
# Reset completo do banco
npm run db:reset

# Seed com dados de teste
npm run db:seed

# Ver estrutura do banco
npm run db:studio
```

## 🧪 Executar Testes

### **Todos os Módulos**
```bash
# Testes unitários
npm run test

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e

# Coverage
npm run test:coverage
```

### **Módulo Específico**
```bash
cd modules/user-management
npm run test
npm run test:watch
```

## 🐳 Docker Development

### **Subir Todos os Serviços**
```bash
# Ambiente completo
docker-compose up -d

# Apenas infraestrutura
docker-compose up -d postgres redis

# Ver logs
docker-compose logs -f
```

### **Rebuild Containers**
```bash
# Rebuild específico
docker-compose build user-management

# Rebuild todos
docker-compose build --no-cache
```

## 🔧 Troubleshooting

### **Problemas Comuns**

#### **Porta já está em uso**
```bash
# Encontrar processo usando a porta
lsof -ti:5003

# Matar processo
kill -9 $(lsof -ti:5003)
```

#### **Database connection error**
```bash
# Verificar se PostgreSQL está rodando
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Ver logs do PostgreSQL
docker-compose logs postgres
```

#### **Prisma schema out of sync**
```bash
# Reset e regenerar
npm run prisma:reset
npm run prisma:generate
npm run prisma:migrate
```

#### **Node modules issues**
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install

# Para todos os módulos
npm run clean:install
```

### **Logs Úteis**
```bash
# Ver logs em tempo real
docker-compose logs -f

# Logs específicos de um serviço
docker-compose logs -f user-management

# Últimas 100 linhas
docker-compose logs --tail=100
```

## 📊 Health Check

### **Verificar se Tudo Está Funcionando**
```bash
# Script de verificação automática
npm run health:check

# Ou verificação manual:
curl http://localhost:5003/health  # User Management
curl http://localhost:5004/health  # CRM
curl http://localhost:5005/health  # Services
curl http://localhost:5008/health  # Agendamento
```

### **Resposta Esperada**
```json
{
  "status": "ok",
  "timestamp": "2024-08-23T10:30:00Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

## 🚀 Próximos Passos

Após setup completo:

1. **Leia a documentação** dos módulos em [../02-modules/](../02-modules/)
2. **Entenda o fluxo** de desenvolvimento em [coding-guidelines.md](coding-guidelines.md)
3. **Execute os testes** para garantir que tudo funciona
4. **Comece com User Management** - base para todos os outros módulos

## 📞 Suporte

**Problemas de setup?**
1. Verifique se todas as portas estão livres
2. Confirme versões do Node.js e Docker
3. Execute health checks
4. Consulte logs dos containers

**Ainda com problemas?**
- Consulte [troubleshooting completo](../README.md#troubleshooting)
- Verifique [issues conhecidos](https://github.com/project/issues)