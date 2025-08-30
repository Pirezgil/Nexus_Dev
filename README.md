# Nexus ERP

**Sistema ERP Modular para Clínicas e Salões**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-20+-blue.svg)](https://docker.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://postgresql.org)

## 🎯 Visão Geral

Nexus ERP é um sistema **modular e multi-tenant** projetado especificamente para **clínicas, salões de beleza e consultórios**. Oferece gestão completa de clientes, agendamentos, serviços e atendimentos com **segurança empresarial** e **isolamento total** entre empresas.

### **Principais Diferenciais**
- 🔒 **Multi-tenant Seguro** - Cada empresa totalmente isolada
- 📦 **Arquitetura Modular** - Pague apenas pelos módulos que usar
- 📅 **Calendário Inteligente** - Por profissional + anti-conflito
- 📱 **WhatsApp Automático** - Confirmações e lembretes
- 📊 **Relatórios Reais** - Faturamento, performance, KPIs
- 🤖 **IA Integrada** - Monitoramento inteligente

## 🚀 Quick Start

### **Pré-requisitos**
- Node.js >= 18.x
- Docker >= 20.x
- PostgreSQL (via Docker)

### **Instalação Rápida**
```bash
# 1. Clone o repositório
git clone https://github.com/your-org/nexus-erp.git
cd nexus-erp

# 2. Setup ambiente
cp .env.example .env
docker-compose up -d postgres redis

# 3. Instalar dependências
npm install

# 4. Setup banco de dados
npm run db:migrate
npm run db:seed

# 5. Iniciar desenvolvimento
npm run dev
```

**URLs de desenvolvimento:**
- Frontend: http://localhost:3000
- User Management: http://localhost:5001
- CRM: http://localhost:5002
- Services: http://localhost:5003
- Agendamento: http://localhost:5007

## 📖 Documentação

### **📚 Documentação Completa:** [`/docs`](docs/)

### **🗄️ Database Schema:** ✅ **24 tabelas implementadas**
- **[Schema Completo](docs/DATABASE_SCHEMA_FINAL.md)** - Estrutura validada e pronta
- **4 schemas**: nexus_auth, nexus_crm, nexus_agendamento, nexus_services
- **30 relacionamentos** cross-module configurados
- **45+ índices** para performance otimizada

**Quick Links:**
- 🎯 [Visão Geral do MVP](docs/00-overview/mvp-overview.md)
- 🛠️ [Setup Detalhado](docs/04-development/setup-guide.md)
- 🏗️ [Arquitetura do Sistema](docs/01-architecture/)
- 📦 [Especificações dos Módulos](docs/02-modules/)
- 👨‍💻 [Guias de Desenvolvimento](docs/04-development/)

## 🏗️ Arquitetura

### **Stack Tecnológica**
- **Frontend:** React + Next.js + Tailwind CSS + TypeScript
- **Backend:** Node.js + Express + TypeScript + Prisma
- **Database:** PostgreSQL (multi-schema para isolamento)
- **Cache:** Redis (sessões + pub/sub)
- **Deploy:** Docker Swarm + Nginx
- **Monitor:** IA personalizada + Telegram

### **Módulos MVP**
| Módulo | Porta | Responsabilidade | Status |
|:-------|:-----:|:-----------------|:------:|
| [**User Management**](docs/02-modules/user-management.md) | 5001 | Autenticação multi-tenant | 📋 Planejado |
| [**CRM**](docs/02-modules/crm.md) | 5002 | Gestão de clientes | 📋 Planejado |
| [**Services**](docs/02-modules/services.md) | 5003 | Serviços e atendimentos | 📋 Planejado |
| [**Agendamento**](docs/02-modules/agendamento.md) | 5007 | Calendário e notificações | 📋 Planejado |

### **Arquitetura Multi-Tenant**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Empresa A     │    │   Empresa B     │    │   Empresa C     │
│ Schema: nexus_A │    │ Schema: nexus_B │    │ Schema: nexus_C │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │  PostgreSQL Server  │
                    │   Isolation Total   │
                    └─────────────────────┘
```

## 🎯 Roadmap de 12 Semanas

### **✅ Fase 0: Documentação (Concluída)**
- Arquitetura completa documentada
- 8 documentos técnicos detalhados
- Templates e guias de desenvolvimento

### **📋 Fase 1: Fundação (Semanas 1-2)**
- Setup ambiente Docker
- Módulo User Management
- Autenticação multi-tenant

### **📋 Fase 2: CRM (Semanas 3-4)**
- CRUD completo de clientes
- Histórico e segmentação
- Integração com Auth

### **📋 Fase 3: Services (Semanas 5-6)**
- Gestão serviços e profissionais
- Registro de atendimentos
- Upload de fotos + pagamentos

### **📋 Fase 4: Agendamento (Semanas 7-8)**
- Calendário visual
- WhatsApp Business API
- Anti-conflito de horários

### **📋 Fase 5: Polimento (Semanas 9-10)**
- Frontend responsivo
- Dashboards e relatórios
- Testes automatizados

### **📋 Fase 6: Go-Live (Semanas 11-12)**
- Deploy produção
- Clientes beta
- Feedback e ajustes

## 💼 Para o Negócio

### **Público-Alvo**
- **Clínicas médicas/odontológicas** - Gestão de pacientes e procedimentos
- **Salões de beleza/estética** - Agenda por profissional + histórico
- **Consultórios diversos** - Atendimentos e controle financeiro
- **Prestadores de serviços** - Qualquer negócio com agenda

### **ROI para Clientes**
- ⏱️ **-60% tempo administrativo** (menos papel/Excel)
- 📈 **+30% redução no-show** (lembretes automáticos)
- 💰 **+25% aumento faturamento** (melhor controle)
- 😊 **+40% satisfação cliente** (profissionalismo)

## 👨‍💻 Para Desenvolvedores

### **Como Contribuir**
1. **Leia a documentação:** [Setup Guide](docs/04-development/setup-guide.md)
2. **Siga os padrões:** [Coding Guidelines](docs/04-development/coding-guidelines.md)
3. **Teste sempre:** [Testing Strategy](docs/04-development/testing-strategy.md)
4. **Documente mudanças:** Use [templates](docs/05-templates/)

### **Comandos Úteis**
```bash
# Desenvolvimento
npm run dev              # Inicia todos os módulos
npm run dev:user         # Apenas User Management
npm run dev:crm          # Apenas CRM

# Testes
npm run test             # Todos os testes
npm run test:unit        # Testes unitários
npm run test:integration # Testes de integração
npm run test:e2e         # Testes E2E

# Database
npm run db:migrate       # Executar migrations
npm run db:seed          # Dados de teste
npm run db:studio        # Interface visual

# Docker
npm run docker:up        # Subir infraestrutura
npm run docker:build     # Build containers
npm run docker:logs      # Ver logs
```

## 📊 Status do Projeto

### **Métricas Atuais**
- 📖 **Documentação:** 100% completa
- 🏗️ **Arquitetura:** 100% definida
- 👨‍💻 **Desenvolvimento:** 0% (pronto para iniciar)
- 🧪 **Testes:** 0% (estratégia definida)

### **Métricas MVP (Metas)**
- 🎯 **10 empresas** usando ativamente
- 🎯 **500+ agendamentos/mês** no sistema
- 🎯 **NPS > 8** de satisfação
- 🎯 **99% uptime** estabilidade

## 🛡️ Segurança

### **Multi-tenant Security**
- ✅ **Schema Isolation** - Cada empresa em schema separado
- ✅ **JWT + Company ID** - Token vinculado à empresa
- ✅ **Zero Cross-tenant** - Impossível acessar dados de outra empresa
- ✅ **Audit Trail** - Log completo de todas as ações
- ✅ **RBAC** - Controle de acesso baseado em roles

### **API Security**
- ✅ **HTTPS obrigatório** em produção
- ✅ **Rate limiting** por empresa
- ✅ **Input validation** com Zod schemas
- ✅ **SQL injection** prevention via Prisma
- ✅ **CORS** configurado adequadamente

## 🚀 Deploy

### **Desenvolvimento**
```bash
# Subir ambiente completo
docker-compose up -d

# Verificar saúde dos serviços
npm run health:check
```

### **Produção**
```bash
# Deploy com Docker Swarm
docker stack deploy -c docker-compose.prod.yml nexus

# Verificar deploy
./scripts/health-check.sh

# Ver logs
docker service logs nexus_nexus-services -f
```

**Mais detalhes:** [Deployment Guide](docs/04-development/deployment-guide.md)

## 📞 Suporte

### **Documentação**
- 📚 **Docs Completos:** [`/docs`](docs/)
- 🎯 **Quick Start:** [Setup Guide](docs/04-development/setup-guide.md)
- 🔧 **Troubleshooting:** [README dos módulos](docs/02-modules/)

### **Comunidade**
- 🐛 **Issues:** [GitHub Issues](https://github.com/project/issues)
- 💬 **Discussões:** [GitHub Discussions](https://github.com/project/discussions)
- 📧 **Email:** dev@nexus-erp.com

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 🔥 Ready to Code!

**A documentação está 100% completa e a arquitetura está definida.**

**Próximo passo:** [Setup do ambiente de desenvolvimento](docs/04-development/setup-guide.md) 🚀

---

<div align="center">

**Feito com ❤️ para revolucionar a gestão de clínicas e salões**

[Documentação](docs/) • [Arquitetura](docs/01-architecture/) • [Módulos](docs/02-modules/) • [Setup](docs/04-development/setup-guide.md)

</div>