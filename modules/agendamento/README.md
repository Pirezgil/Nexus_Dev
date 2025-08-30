# 📅 Nexus ERP - Agendamento Module

Sistema completo de agendamentos com calendário, notificações WhatsApp, gestão de disponibilidade e relatórios avançados.

## 🌟 Features

### ✅ Funcionalidades Principais
- **CRUD Completo de Agendamentos** - Criar, listar, atualizar e cancelar agendamentos
- **Sistema de Calendário** - Visualização por dia/semana/mês com drag & drop
- **Disponibilidade Inteligente** - Cálculo automático de horários disponíveis
- **Bloqueio de Horários** - Férias, feriados, manutenção e bloqueios personalizados
- **Lista de Espera** - Gerenciamento de fila para horários indisponíveis
- **Reagendamentos** - Histórico completo de alterações
- **Status Avançados** - Agendado, confirmado, concluído, cancelado, falta

### 📱 Notificações Multi-Canal
- **WhatsApp Business API** - Confirmações, lembretes e atualizações
- **SMS via Twilio** - Notificações por mensagem de texto
- **Email SMTP** - Confirmações e relatórios por email
- **Templates Customizáveis** - Sistema de templates com variáveis
- **Agendamento de Envio** - Lembretes automáticos configuráveis

### 🔄 Integrações
- **User Management** - Autenticação JWT compartilhada
- **CRM** - Busca e validação de clientes
- **Services** - Profissionais, serviços e preços
- **Google Calendar** - Sincronização bidirecional (opcional)

### 📊 Relatórios e Analytics
- **Relatório Mensal** - Faturamento, ocupação e performance
- **Relatório de Faltas** - Controle de no-shows por cliente
- **Estatísticas em Tempo Real** - Dashboard com métricas principais
- **Exportação** - Dados em CSV/PDF

## 🏗️ Arquitetura

### Stack Tecnológica
- **Runtime**: Node.js 18+ com TypeScript
- **Framework**: Express.js com middlewares de segurança
- **Banco de Dados**: PostgreSQL com Prisma ORM
- **Cache**: Redis para performance e pub/sub
- **Validação**: Zod schemas para validação robusta
- **Logging**: Winston com logs estruturados
- **Containers**: Docker multi-stage builds

### Estrutura do Projeto
```
modules/agendamento/
├── src/
│   ├── app.ts                     # Aplicação Express principal
│   ├── controllers/               # Controllers da API REST
│   │   ├── appointmentController.ts
│   │   ├── calendarController.ts
│   │   ├── notificationController.ts
│   │   └── healthController.ts
│   ├── services/                  # Lógica de negócio
│   │   ├── appointmentService.ts
│   │   ├── availabilityService.ts
│   │   ├── notificationService.ts
│   │   ├── calendarService.ts
│   │   └── integrationService.ts
│   ├── middleware/                # Middlewares customizados
│   │   ├── auth.ts               # Autenticação JWT
│   │   ├── validation.ts         # Validações Zod
│   │   └── error.ts             # Tratamento de erros
│   ├── integrations/             # Integrações externas
│   │   └── whatsappService.ts   # WhatsApp Business API
│   ├── routes/                   # Definição das rotas
│   │   ├── appointmentRoutes.ts
│   │   ├── calendarRoutes.ts
│   │   ├── notificationRoutes.ts
│   │   └── reportRoutes.ts
│   ├── types/                    # Tipos TypeScript
│   │   └── index.ts
│   └── utils/                    # Utilitários
│       ├── config.ts            # Configurações
│       ├── database.ts          # Conexão Prisma
│       ├── logger.ts           # Sistema de logs
│       └── redis.ts            # Cache e pub/sub
├── prisma/
│   ├── schema.prisma           # Schema do banco de dados
│   └── migrations/             # Migrations
├── Dockerfile                  # Container Docker
├── package.json               # Dependências npm
├── tsconfig.json             # Configuração TypeScript
└── .env.example              # Template de variáveis
```

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- npm ou pnpm

### 1. Instalação das Dependências
```bash
cd modules/agendamento
npm install
# ou
pnpm install
```

### 2. Configuração do Ambiente
```bash
# Copiar template de configuração
cp .env.example .env

# Editar configurações necessárias
nano .env
```

### 3. Configuração do Banco de Dados
```bash
# Gerar cliente Prisma
npm run db:generate

# Executar migrations
npm run db:migrate

# (Opcional) Popular dados iniciais
npm run db:seed
```

### 4. Configurações Essenciais

#### Database
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus_erp?schema=nexus_agendamento
```

#### Redis
```env
REDIS_URL=redis://localhost:6379/3
```

#### JWT (deve coincidir com User Management)
```env
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
```

#### Integrações com Outros Módulos
```env
USER_MANAGEMENT_URL=http://localhost:5002
CRM_URL=http://localhost:5004
SERVICES_URL=http://localhost:5006
```

### 5. Configuração do WhatsApp (Opcional)
```env
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=your-facebook-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-token
```

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
# Desenvolvimento com hot-reload
npm run dev

# Build para produção
npm run build

# Iniciar produção
npm start

# Testes
npm test

# Linting
npm run lint

# Verificação de tipos
npm run type-check

# Prisma Studio
npm run db:studio
```

### Estrutura do Banco de Dados

#### Tabelas Principais
- **appointments** - Agendamentos principais
- **schedule_blocks** - Bloqueios de horário
- **appointment_notifications** - Log de notificações
- **waiting_list** - Lista de espera
- **message_templates** - Templates de mensagem
- **business_hours** - Horários de funcionamento
- **agendamento_config** - Configurações por empresa

## 📡 API Endpoints

### Agendamentos
```http
GET    /api/appointments              # Listar agendamentos
POST   /api/appointments              # Criar agendamento
GET    /api/appointments/:id          # Buscar agendamento
PUT    /api/appointments/:id          # Atualizar agendamento
DELETE /api/appointments/:id          # Cancelar agendamento
PUT    /api/appointments/:id/status   # Alterar status
```

### Calendário
```http
GET    /api/calendar                  # Dados do calendário
GET    /api/calendar/availability     # Horários disponíveis
POST   /api/calendar/block           # Bloquear horários
GET    /api/calendar/professional/:id # Agenda do profissional
```

### Notificações
```http
POST   /api/notifications/send       # Enviar notificação
POST   /api/notifications/whatsapp   # Webhook WhatsApp
GET    /api/notifications/templates  # Listar templates
POST   /api/notifications/test       # Testar envio
```

### Relatórios
```http
GET    /api/reports/monthly          # Relatório mensal
GET    /api/reports/no-shows         # Relatório de faltas
GET    /api/reports/occupancy        # Taxa de ocupação
```

### Health Check
```http
GET    /health                       # Status do serviço
GET    /health/detailed              # Status detalhado
```

## 🔐 Autenticação e Autorização

### Headers Obrigatórios
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Permissões por Role
- **USER**: Visualizar próprios agendamentos
- **STAFF**: CRUD de agendamentos, enviar notificações
- **MANAGER**: Todas as operações, relatórios, configurações
- **ADMIN**: Acesso total, incluindo logs e integrações

## 📋 Exemplos de Uso

### Criar Agendamento
```bash
curl -X POST http://localhost:5007/api/appointments \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "uuid-do-cliente",
    "professional_id": "uuid-do-profissional",
    "service_id": "uuid-do-servico",
    "appointment_date": "2024-12-20",
    "appointment_time": "14:30",
    "notes": "Cliente preferiu horário da tarde",
    "send_confirmation": true,
    "send_reminder": true
  }'
```

### Verificar Disponibilidade
```bash
curl -X GET "http://localhost:5007/api/calendar/availability?professional_id=uuid&service_id=uuid&date=2024-12-20" \
  -H "Authorization: Bearer {token}"
```

### Enviar Notificação
```bash
curl -X POST http://localhost:5007/api/notifications/send \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": "uuid-do-agendamento",
    "type": "reminder",
    "channel": "whatsapp"
  }'
```

## 🐳 Docker

### Build da Imagem
```bash
# Build para desenvolvimento
docker build -t nexus-agendamento:dev --target development .

# Build para produção
docker build -t nexus-agendamento:prod --target production .
```

### Executar Container
```bash
# Desenvolvimento
docker run -p 5007:5007 --env-file .env nexus-agendamento:dev

# Produção
docker run -p 5007:5007 --env-file .env nexus-agendamento:prod
```

### Docker Compose
```yaml
version: '3.8'
services:
  agendamento:
    build:
      context: .
      target: production
    ports:
      - "5007:5007"
    environment:
      - NODE_ENV=production
      - PORT=5007
    depends_on:
      - postgres
      - redis
    networks:
      - nexus-network
```

## 🔧 Configurações Avançadas

### Cron Jobs (Automações)
```env
# Lembretes automáticos (8h da manhã)
REMINDER_CRON_SCHEDULE=0 8 * * *

# Limpeza de dados antigos (2h da madrugada)
CLEANUP_CRON_SCHEDULE=0 2 * * *
```

### Cache Redis
```env
# TTL para diferentes tipos de dados
CACHE_TTL_APPOINTMENTS=300      # 5 minutos
CACHE_TTL_AVAILABILITY=1800     # 30 minutos
CACHE_TTL_PROFESSIONALS=3600    # 1 hora
```

### Rate Limiting
```env
# 100 requests por janela de 15 minutos
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Monitoramento

### Logs
- **Arquivo**: `./logs/agendamento.log`
- **Formato**: JSON estruturado
- **Níveis**: error, warn, info, debug
- **Rotação**: Automática por tamanho

### Métricas
- Tempo de resposta das APIs
- Status das integrações
- Taxa de sucesso das notificações
- Performance do banco de dados

### Health Checks
```http
GET /health
{
  "success": true,
  "data": {
    "service": "Nexus Agendamento",
    "status": "running",
    "uptime": 3600,
    "features": {
      "whatsapp": true,
      "email": true,
      "calendar": true
    }
  }
}
```

## 🚨 Troubleshooting

### Problemas Comuns

#### Erro de Conexão com Database
```bash
# Verificar se PostgreSQL está rodando
pg_isready -h localhost -p 5432

# Testar conexão manualmente
psql postgresql://user:pass@localhost:5432/nexus_erp
```

#### Cache Redis Indisponível
```bash
# Verificar Redis
redis-cli ping

# Limpar cache se necessário
redis-cli FLUSHDB
```

#### WhatsApp API Failure
```bash
# Verificar token de acesso
curl -X GET "https://graph.facebook.com/v18.0/me" \
  -H "Authorization: Bearer {access_token}"

# Verificar webhook
curl -X GET "https://yourapp.com/api/notifications/whatsapp?hub.mode=subscribe&hub.challenge=test&hub.verify_token={verify_token}"
```

### Logs Importantes
```bash
# Ver logs em tempo real
tail -f logs/agendamento.log

# Filtrar apenas erros
grep "level\":\"error\"" logs/agendamento.log

# Logs de integrações
grep "integration" logs/agendamento.log
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Padrões de Código
- TypeScript strict mode
- ESLint + Prettier
- Conventional Commits
- Testes unitários obrigatórios
- Documentação atualizada

## 📝 Changelog

### v1.0.0 - Inicial
- Sistema completo de agendamentos
- Integrações com User Management, CRM e Services
- Notificações WhatsApp, SMS e Email
- Sistema de calendário com disponibilidade
- Relatórios e analytics básicos
- Containerização Docker

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- **Documentação**: [docs.nexuserp.com](https://docs.nexuserp.com)
- **Issues**: [GitHub Issues](https://github.com/nexus-erp/agendamento/issues)
- **Chat**: [Discord](https://discord.gg/nexuserp)
- **Email**: suporte@nexuserp.com

---

Desenvolvido com ❤️ pela equipe [Nexus ERP](https://nexuserp.com)