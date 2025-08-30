## 🚀 AMBIENTE DE DESENVOLVIMENTO - NEXUS ERP

**Sistema:** ERP Modular baseado em arquitetura LEGO  
**Stack Principal:** PostgreSQL + Docker + React + Node.js + Express + TypeScript + Prisma  
**Estrutura:** Módulos independentes com comunicação via APIs e Message Broker (Redis)

### Portas de Desenvolvimento (Docker Compose)
- **Frontend:** http://localhost:5000 (Next.js)  
- **Backend API Gateway:** http://localhost:5001 (Express)  
- **Módulo Auth:** http://localhost:5002  
- **Módulo User Management:** http://localhost:5003  
- **Módulo CRM:** http://localhost:5004  
- **Módulo Sales:** http://localhost:5005  
- **Módulo Inventory:** http://localhost:5006  
- **Módulo Financial:** http://localhost:5007  
- **Database:** PostgreSQL:5433  
- **Redis:** localhost:6379  
- **Nginx:** http://localhost:80 (Proxy Reverso)

⚠️ **IMPORTANTE:** Sistema containerizado com Docker Compose. Use `docker-compose up -d` para inicializar todos os serviços.

HIERARQUIA DE ECONOMIA DE TOKENS

Níveis de Prioridade , começe do nivel 1 e vai subindo se precisar.

NÍVEL 1 (Mínimo gasto):** Use Glob para encontrar arquivos por padrão específico se você souber exatamente o que procura

NÍVEL 2 (Gasto baixo):** Use Grep com padrões específicos em tipos de arquivo conhecidos (ex: glob="*.ts", pattern="função específica")

NÍVEL 3 (Gasto médio):** Use Read em arquivos específicos quando você já sabe qual arquivo contém o que precisa

NÍVEL 4 (Gasto alto - só quando necessário):** Use Task tool para buscas complexas que precisam de múltiplas tentativas ou exploração ampla do código

## 📁 ESTRUTURA DE PASTAS - NEXUS ERP

### Arquitetura Modular
```
nexus-erp/
├── modules/                    # Módulos do ERP (filosofia LEGO)
│   ├── auth/                  # Autenticação e autorização
│   ├── user-management/       # Gestão de usuários
│   ├── crm/                   # Customer Relationship Management
│   ├── sales/                 # Vendas e pedidos
│   ├── inventory/             # Controle de estoque
│   └── financial/             # Gestão financeira
├── shared/                    # Recursos compartilhados
│   ├── database/              # Schemas e migrations Prisma
│   ├── types/                 # Tipos TypeScript globais
│   ├── utils/                 # Utilitários comuns
│   └── middleware/            # Middlewares compartilhados
├── frontend/                  # Interface React/Next.js
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   ├── components/       # Componentes React
│   │   ├── hooks/            # Custom hooks
│   │   ├── stores/           # Zustand stores
│   │   └── lib/              # Utilities frontend
└── infrastructure/           # Docker e deployment
    ├── docker/               # Dockerfiles
    ├── nginx/                # Configurações proxy
    └── monitoring/           # Prometheus/Grafana
```

### Padrões de Arquivo por Módulo
- `module/[nome]/src/routes/` - Rotas da API REST
- `module/[nome]/src/controllers/` - Controllers Express
- `module/[nome]/src/services/` - Lógica de negócio
- `module/[nome]/src/models/` - Modelos de dados
- `module/[nome]/prisma/` - Schema e migrations específicas
- `module/[nome]/tests/` - Testes unitários e integração

## 🔍 HIERARQUIA DE ECONOMIA DE TOKENS

Níveis de Prioridade, começe do nível 1 e vai subindo se precisar.

**NÍVEL 1 (Mínimo gasto):** Use Glob para encontrar arquivos por padrão específico se você souber exatamente o que procura

**NÍVEL 2 (Gasto baixo):** Use Grep com padrões específicos em tipos de arquivo conhecidos (ex: glob="*.ts", pattern="função específica")

**NÍVEL 3 (Gasto médio):** Use Read em arquivos específicos quando você já sabe qual arquivo contém o que precisa

**NÍVEL 4 (Gasto alto - só quando necessário):** Use Task tool para buscas complexas que precisam de múltiplas tentativas ou exploração ampla do código

## 🐳 COMANDOS DOCKER - NEXUS ERP

### Desenvolvimento
```bash
# Inicializar todos os serviços
docker-compose up -d

# Ver logs de um módulo específico
docker-compose logs -f [nome-do-modulo]

# Rebuild um módulo específico
docker-compose build [nome-do-modulo]

# Parar todos os serviços
docker-compose down
```

### Database (Prisma)
```bash
# Aplicar migrations (no container)
docker-compose exec [modulo] npx prisma migrate deploy

# Gerar cliente Prisma
docker-compose exec [modulo] npx prisma generate

# Visualizar database
docker-compose exec [modulo] npx prisma studio
```

## 📝 PROCESSO DE COMMIT GIT

Se a solicitação for para realizar o processo de commit do projeto:

1. **git status** - Verificar status atual do repositório
2. **git add .** - Adicionar todas as mudanças ao staging  
3. **git commit -m "Mensagem do commit"** - Criar commit com mensagem informada pelo usuário. Se o usuário não fornecer uma mensagem, peça para ele informar antes de prosseguir
4. **git push origin main** - Enviar mudanças para o repositório remoto

### Padrão de Mensagens de Commit
- `feat(module): descrição` - Nova funcionalidade
- `fix(module): descrição` - Correção de bug  
- `refactor(module): descrição` - Refatoração
- `docs: descrição` - Documentação
- `docker: descrição` - Mudanças na infraestrutura

## 🗄️ BANCO DE DADOS - CONSULTAS E ALTERAÇÕES
**Schemas existentes:** `nexus_auth`, `nexus_crm`, `nexus_services`, `nexus_agendamento`. **ENUMs:** Cast obrigatório `'ADMIN'::nexus_auth."UserRole"`  
**Consultas:** `prisma.$queryRaw` para SELECT com JOIN. **Alterações:** `prisma.$executeRaw` para INSERT/UPDATE/DELETE  
**Scripts:** Criar `.js` na pasta `scripts/` usando Prisma client. **Usuários demo:** admin@demo.com, manager@demo.com, usuario1@demo.com (123456789)
