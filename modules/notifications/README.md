# 📧 Módulo de Notificações - ERP Nexus

Sistema unificado e escalável de notificações multi-canal para o ERP Nexus, oferecendo entrega em tempo real através de múltiplos canais de comunicação.

## 🌟 Características

### ✅ Multi-Canal
- **App**: Notificações em tempo real via WebSocket
- **Email**: Envio via SMTP com templates personalizados
- **SMS**: Integração com Twilio
- **Push**: Notificações push via Firebase (FCM) e Apple (APNS)
- **Slack**: Integração com webhooks e bot
- **WhatsApp**: Mensagens via Twilio WhatsApp API

### ✅ Recursos Avançados
- 🚀 **Tempo Real**: WebSocket para notificações instantâneas
- 📊 **Analytics**: Métricas detalhadas de entrega e engagement
- 🔄 **Retry Logic**: Tentativas automáticas para falhas
- 📝 **Templates**: Sistema flexível com Mustache
- ⚡ **Filas**: Processamento assíncrono com Bull/Redis
- 🛡️ **Rate Limiting**: Controle de taxa por usuário/canal
- 🎯 **Segmentação**: Notificações direcionadas
- 📱 **Multi-tenancy**: Isolamento por empresa
- 🔐 **Segurança**: Autenticação HMAC entre serviços

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│  Notifications  │────│   Redis Queue   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
            ┌───────▼───┐ ┌────▼────┐ ┌───▼───┐
            │   Email   │ │   SMS   │ │ Push  │
            │ Service   │ │Service  │ │Service│
            └───────────┘ └─────────┘ └───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼───┐ ┌────▼────┐ ┌───▼──────┐
              │  Slack  │ │WhatsApp │ │WebSocket │
              │Service  │ │Service  │ │ Server   │
              └─────────┘ └─────────┘ └──────────┘
```

## 🚀 Instalação e Configuração

### 1. Pré-requisitos
```bash
# Instalar dependências
npm install

# PostgreSQL e Redis devem estar rodando
```

### 2. Configuração de Ambiente
```bash
# Copiar exemplo de configuração
cp .env.example .env

# Editar variáveis necessárias
nano .env
```

### 3. Configuração do Banco de Dados
```bash
# Gerar cliente Prisma
npm run db:generate

# Executar migrações
npm run db:migrate

# Popular com dados iniciais
npm run db:seed
```

### 4. Inicialização
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build && npm start
```

## 🔧 Configuração de Canais

### Email (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### SMS/WhatsApp (Twilio)
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

### Push (Firebase)
```env
FCM_SERVER_KEY=your-server-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Slack
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
```

## 📡 API Endpoints

### Notificações
```http
POST /api/notifications
GET /api/notifications
GET /api/notifications/:id
PUT /api/notifications/:id/read
DELETE /api/notifications/:id
```

### Templates
```http
GET /api/templates
POST /api/templates
PUT /api/templates/:id
DELETE /api/templates/:id
```

### Analytics
```http
GET /api/analytics/stats
GET /api/analytics/delivery-rates
GET /api/analytics/engagement
```

### Health Check
```http
GET /health
GET /api/notifications/health
```

## 📝 Uso Básico

### Enviando uma Notificação
```javascript
const response = await fetch('/api/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    companyId: 'company-uuid',
    userId: 'user-uuid',
    type: 'INFO',
    priority: 'MEDIUM',
    title: 'Título da Notificação',
    message: 'Mensagem da notificação',
    channels: ['app', 'email'],
    data: {
      customProperty: 'valor'
    }
  })
});
```

### WebSocket (Tempo Real)
```javascript
const socket = io('ws://localhost:5007');

socket.on('notification', (notification) => {
  console.log('Nova notificação:', notification);
  // Processar notificação em tempo real
});

socket.on('notification:read', (notificationId) => {
  console.log('Notificação lida:', notificationId);
});
```

### Templates com Mustache
```javascript
// Template
const template = "Olá {{name}}, você tem {{count}} nova(s) mensagem(ns)";

// Dados
const data = { name: "João", count: 3 };

// Resultado: "Olá João, você tem 3 nova(s) mensagem(ns)"
```

## 🔗 Integração com Módulos

### CRM
```javascript
import { notificationClient } from './notificationClient';

// Novo cliente criado
await notificationClient.notifyCustomerCreated(
  companyId,
  userId,
  customerName,
  customerId
);
```

### User Management
```javascript
// Login bem-sucedido
await notificationClient.notifySuccessfulLogin(
  companyId,
  userId,
  userEmail,
  ipAddress
);
```

## 📊 Monitoramento

### Métricas Disponíveis
- Taxa de entrega por canal
- Tempo médio de processamento
- Erros e tentativas de retry
- Engagement (lidas/não lidas)
- Volume por módulo/tipo

### Health Checks
```bash
# Verificar saúde do serviço
curl http://localhost:5006/health

# Verificar status dos canais
curl http://localhost:5006/api/notifications/health
```

## 🎨 Customização

### Criando Templates Personalizados
1. Acesse `/api/templates`
2. Defina variáveis com `{{variableName}}`
3. Configure canais permitidos
4. Ative/desative conforme necessário

### Adicionando Novos Canais
1. Implemente interface `INotificationChannel`
2. Registre no `ChannelService`
3. Configure no banco de dados
4. Teste integração

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar com watch
npm run test:watch

# Cobertura
npm run test:coverage
```

## 🚀 Deploy

### Docker
```bash
# Build da imagem
docker build -t nexus-notifications .

# Executar container
docker run -p 5006:5006 nexus-notifications
```

### Docker Compose
```yaml
nexus-notifications:
  build: ./modules/notifications
  ports:
    - "5006:5006"
  environment:
    - NODE_ENV=production
    - DATABASE_URL=${DATABASE_URL}
    - REDIS_URL=${REDIS_URL}
  depends_on:
    - postgres
    - redis
```

## 🔒 Segurança

- ✅ Autenticação HMAC entre serviços
- ✅ Validação JWT para usuários
- ✅ Rate limiting por usuário/IP
- ✅ Sanitização de dados
- ✅ Headers de segurança (Helmet)
- ✅ Isolamento multi-tenant
- ✅ Logs de auditoria

## 📈 Performance

- ✅ Redis para cache e filas
- ✅ Processamento assíncrono
- ✅ Connection pooling
- ✅ Compression gzip
- ✅ Rate limiting inteligente
- ✅ Cleanup automático de dados antigos

## 🐛 Troubleshooting

### Problemas Comuns

**Notificações não chegam:**
1. Verificar configuração dos canais
2. Checar logs de erro
3. Validar conectividade com serviços externos
4. Verificar rate limits

**Performance lenta:**
1. Verificar Redis
2. Monitorar uso de CPU/memória
3. Verificar concorrência das filas
4. Otimizar queries do banco

**Erro de autenticação:**
1. Verificar GATEWAY_HMAC_SECRET
2. Validar tokens JWT
3. Checar headers necessários

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**ERP Nexus** - Sistema de gestão empresarial completo e modular.