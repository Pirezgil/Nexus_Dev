# Nexus ERP - Services Module

## Visão Geral

O **Services Module** é o módulo responsável pelo gerenciamento de serviços profissionais no Nexus ERP. Este módulo permite o cadastro e controle de procedimentos/serviços, profissionais da equipe, registro de atendimentos realizados, controle de pagamentos e geração de relatórios analíticos.

## Funcionalidades

### 🏥 Gestão de Serviços/Procedimentos
- ✅ CRUD completo de serviços
- ✅ Categorização de serviços
- ✅ Controle de preços e duração
- ✅ Busca e filtros avançados
- ✅ Estatísticas de performance
- ✅ Atualização de preços em lote

### 👨‍⚕️ Gestão de Profissionais
- ✅ CRUD completo de profissionais
- ✅ Especialidades e qualificações
- ✅ Horários de trabalho configuráveis
- ✅ Controle de disponibilidade
- ✅ Relatórios de performance individual
- ✅ Integração com User Management

### 📋 Registro de Atendimentos
- ✅ Registro de atendimentos completados
- ✅ Controle de status e pagamentos
- ✅ Upload de fotos (antes/depois)
- ✅ Observações e anotações
- ✅ Histórico completo de atendimentos

### 📊 Relatórios e Analytics
- ✅ Relatórios diários automatizados
- ✅ Performance por profissional
- ✅ Análise financeira detalhada
- ✅ Métricas de dashboard
- ✅ Exportação de dados (JSON/CSV)

### 🔗 Integrações Cross-Module
- ✅ Integração com CRM (busca de clientes)
- ✅ Criação automática de notas no CRM
- ✅ Validação via User Management
- ✅ Sincronização de dados de profissionais

## Tecnologias Utilizadas

- **Runtime**: Node.js 18+ com TypeScript
- **Framework**: Express.js com middleware personalizado
- **Database**: PostgreSQL com Prisma ORM
- **Cache**: Redis para performance
- **Upload**: Multer + Sharp para processamento de imagens
- **Validação**: Zod para validação de schemas
- **Logging**: Winston para logging estruturado
- **Autenticação**: JWT com middleware personalizado
- **Containerização**: Docker com multi-stage build

## Estrutura do Projeto

```
modules/services/
├── src/
│   ├── app.ts              # Configuração principal do Express
│   ├── controllers/        # Controllers da API REST
│   │   ├── serviceController.ts
│   │   ├── professionalController.ts
│   │   ├── appointmentController.ts
│   │   ├── reportController.ts
│   │   ├── integrationController.ts
│   │   └── healthController.ts
│   ├── services/           # Lógica de negócio
│   │   ├── serviceService.ts
│   │   ├── professionalService.ts
│   │   ├── appointmentService.ts
│   │   ├── reportService.ts
│   │   └── integrationService.ts
│   ├── middleware/         # Middleware personalizado
│   │   ├── auth.ts         # Autenticação e autorização
│   │   ├── upload.ts       # Upload de arquivos
│   │   ├── validation.ts   # Validação e sanitização
│   │   └── error.ts        # Tratamento de erros
│   ├── routes/            # Definição de rotas
│   │   ├── index.ts       # Roteador principal
│   │   ├── serviceRoutes.ts
│   │   ├── professionalRoutes.ts
│   │   ├── appointmentRoutes.ts
│   │   ├── reportRoutes.ts
│   │   ├── integrationRoutes.ts
│   │   └── healthRoutes.ts
│   ├── types/             # Definições TypeScript
│   │   └── index.ts       # Tipos, interfaces e schemas
│   └── utils/             # Utilitários
│       ├── config.ts      # Configurações
│       ├── database.ts    # Conexão e helpers DB
│       ├── logger.ts      # Sistema de logging
│       └── redis.ts       # Conexão e cache Redis
├── prisma/
│   ├── schema.prisma      # Schema do banco de dados
│   └── migrations/        # Migrações do banco
├── uploads/               # Diretório para uploads
├── Dockerfile             # Configuração Docker
├── tsconfig.json          # Configuração TypeScript
├── package.json           # Dependências e scripts
└── .env.example           # Exemplo de variáveis de ambiente
```

## Configuração e Instalação

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

### 2. Instalação de Dependências

```bash
npm install
```

### 3. Configuração do Banco de Dados

```bash
# Gerar Prisma Client
npm run db:generate

# Executar migrações
npm run db:migrate

# (Opcional) Popular com dados de exemplo
npm run db:seed
```

### 4. Executar em Desenvolvimento

```bash
npm run dev
```

### 5. Build para Produção

```bash
npm run build
npm start
```

## API Endpoints

### Serviços
- `GET /api/services` - Listar serviços
- `POST /api/services` - Criar serviço
- `GET /api/services/:id` - Detalhes do serviço
- `PUT /api/services/:id` - Atualizar serviço
- `DELETE /api/services/:id` - Deletar serviço
- `GET /api/services/search` - Buscar serviços
- `GET /api/services/popular` - Serviços populares

### Profissionais
- `GET /api/professionals` - Listar profissionais
- `POST /api/professionals` - Criar profissional
- `GET /api/professionals/:id` - Detalhes do profissional
- `PUT /api/professionals/:id` - Atualizar profissional
- `DELETE /api/professionals/:id` - Deletar profissional
- `GET /api/professionals/available` - Profissionais disponíveis
- `PUT /api/professionals/:id/schedule` - Atualizar horário

### Atendimentos
- `GET /api/appointments/completed` - Listar atendimentos
- `POST /api/appointments/completed` - Registrar atendimento
- `GET /api/appointments/:id` - Detalhes do atendimento
- `PUT /api/appointments/:id` - Atualizar atendimento
- `POST /api/appointments/:id/photos` - Upload de fotos
- `GET /api/appointments/today` - Atendimentos de hoje

### Relatórios
- `GET /api/reports/daily` - Relatório diário
- `GET /api/reports/weekly` - Relatório semanal
- `GET /api/reports/monthly` - Relatório mensal
- `GET /api/reports/dashboard` - Métricas do dashboard
- `GET /api/reports/professional/:id` - Performance do profissional
- `GET /api/reports/financial` - Relatório financeiro

### Integrações
- `GET /api/integrations/customers/:id` - Buscar cliente no CRM
- `POST /api/integrations/customers/:id/notes` - Criar nota no CRM
- `GET /api/integrations/health/modules` - Status dos módulos

### Health Check
- `GET /health` - Verificação básica de saúde
- `GET /health/detailed` - Verificação detalhada
- `GET /health/ready` - Probe de prontidão (Kubernetes)
- `GET /health/live` - Probe de vitalidade (Kubernetes)

## Schema do Banco de Dados

### Tabelas Principais

1. **services** - Cadastro de serviços/procedimentos
2. **professionals** - Cadastro da equipe profissional
3. **appointments_completed** - Registro de atendimentos realizados
4. **service_photos** - Fotos dos atendimentos (antes/depois)
5. **service_stats** - Estatísticas agregadas

### Relacionamentos

- Um serviço pode ter vários atendimentos
- Um profissional pode realizar vários atendimentos
- Um atendimento pode ter várias fotos
- Todas as entidades são isoladas por `companyId`

## Autenticação e Autorização

### Roles Suportadas
- **admin** - Acesso completo a todas as funcionalidades
- **manager** - Acesso a relatórios e gestão
- **staff** - Acesso operacional aos atendimentos

### Middleware de Segurança
- ✅ Validação JWT
- ✅ Rate limiting
- ✅ Sanitização de entrada
- ✅ Proteção contra SQL injection
- ✅ Proteção contra XSS
- ✅ CORS configurado

## Deploy com Docker

### Build da Imagem

```bash
# Development
docker build --target development -t nexus-services:dev .

# Production
docker build --target production -t nexus-services:prod .
```

### Executar Container

```bash
docker run -d \
  --name nexus-services \
  -p 5005:5005 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/nexus_services" \
  -e REDIS_URL="redis://redis:6379" \
  -v $(pwd)/uploads:/app/uploads \
  nexus-services:prod
```

## Monitoramento

### Health Checks
- `/health` - Status básico do serviço
- `/health/detailed` - Status com dependências
- `/health/metrics` - Métricas do sistema

### Logging
- Logs estruturados com Winston
- Níveis: error, warn, info, debug
- Logs de segurança para eventos suspeitos
- Logs de performance para operações lentas

### Performance
- Cache Redis para dados frequentes
- Paginação otimizada
- Índices de banco otimizados
- Rate limiting por usuário

## Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev          # Executar em desenvolvimento
npm run build        # Build para produção
npm run start        # Executar produção
npm run test         # Executar testes
npm run lint         # Verificar código
npm run format       # Formatar código
npm run db:generate  # Gerar Prisma client
npm run db:migrate   # Executar migrações
npm run db:studio    # Abrir Prisma Studio
```

### Padrões de Código
- TypeScript strict mode
- ESLint + Prettier
- Nomenclatura consistente
- Documentação inline
- Tratamento de erros padronizado

## Integração com outros Módulos

### User Management (Porta 5003)
- Validação de tokens JWT
- Busca de perfis de usuário
- Sincronização de dados de profissionais

### CRM (Porta 5004)
- Busca de clientes
- Criação de notas automatizadas
- Notificações de atendimentos

## Próximas Funcionalidades

- [ ] Agendamento de serviços
- [ ] Notificações push
- [ ] Integração com pagamentos
- [ ] Dashboard analítico avançado
- [ ] App mobile para profissionais
- [ ] Relatórios personalizáveis

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do container/aplicação
2. Consulte a documentação da API em `/api/docs`
3. Teste os endpoints de health check
4. Verifique as configurações de ambiente

## Licença

Este projeto é parte do Nexus ERP e está sob licença MIT.