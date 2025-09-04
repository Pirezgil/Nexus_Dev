# Nexus ERP - Documentação

Sistema ERP modular para clínicas e salões com arquitetura multi-tenant segura e IA integrada.

## 🚀 Quick Start

**Para começar rapidamente:**
1. 📖 [Visão Geral do MVP](00-overview/mvp-overview.md) - Entenda o produto em 5 minutos
2. 🛠️ [Setup do Ambiente](04-development/setup-guide.md) - Configure sua máquina
3. 👨‍💻 [Guia de Desenvolvimento](04-development/coding-guidelines.md) - Padrões do projeto

**Para entender a arquitetura:**
1. 🏗️ [Stack Tecnológica](00-overview/tech-stack.md) - Tecnologias escolhidas
2. 🗄️ **[Database Schema Completo](DATABASE_SCHEMA_FINAL.md) - ✅ 24 Tabelas Implementadas**
3. 🔐 [Sistema de Autenticação](01-architecture/authentication-system.md) - Multi-tenant seguro
4. 🔗 [APIs e Integrações](01-architecture/apis-integration.md) - Comunicação entre módulos

## 📚 Navegação por Área

### 🎯 [00-overview/](00-overview/) - Visão Geral
- **MVP Overview** - Produto mínimo viável detalhado
- **Tech Stack** - Tecnologias e justificativas  
- **Project Philosophy** - Filosofia e metodologia

### 🏗️ [01-architecture/](01-architecture/) - Arquitetura Técnica
- **Authentication System** - Multi-tenant + RBAC + audit
- **APIs Integration** - REST + Message Broker híbrido
- **Database Strategy** - PostgreSQL multi-schema
- **DevOps Deployment** - Docker + IA monitoring

### 📦 [02-modules/](02-modules/) - Especificações dos Módulos
- **User Management** - Autenticação e usuários
- **CRM** - Gestão de clientes
- **Services** - Serviços, profissionais e atendimentos
- **Agendamento** - Calendário e notificações

### 🎨 [03-frontend/](03-frontend/) - Design e Interface
- **Design System** - Paleta, componentes e padrões
- **Component Library** - Biblioteca visual documentada

### 👨‍💻 [04-development/](04-development/) - Guias de Desenvolvimento
- **Coding Guidelines** - Padrões de código e estrutura
- **Setup Guide** - Como configurar ambiente local
- **Testing Strategy** - Estratégias de teste
- **Deployment Guide** - Como fazer deploy

### 📝 [05-templates/](05-templates/) - Templates de Documentação
- **Deep Dive Template** - Para documentos técnicos detalhados
- **Project Manifest Template** - Para visões gerais de projeto
- **Module Template** - Para especificação de novos módulos

## 🏗️ Arquitetura do Sistema

### **Multi-Tenant Architecture**
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

### **Módulos e Integrações**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     Auth     │◄──►│     CRM      │◄──►│   Services   │◄──►│ Agendamento  │
│   :5003      │    │    :5004     │    │    :5005     │    │    :5008     │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
         │                   │                   │                   │
         └───────────────────┼───────────────────┼───────────────────┘
                             │                   │
                    ┌─────────────────┐ ┌─────────────────┐
                    │  PostgreSQL     │ │  Redis Cache    │
                    │   Multi-Schema  │ │  + Pub/Sub      │
                    └─────────────────┘ └─────────────────┘
```

## 📊 Status do Projeto

| Componente | Status | Progresso |
|:-----------|:------:|:---------:|
| 📖 **Documentação** | ✅ Completo | 100% |
| 🏗️ **Arquitetura** | ✅ Definido | 100% |
| 👨‍💻 **Development Setup** | 🔄 Em andamento | 0% |
| 🔐 **User Management** | 📋 Planejado | 0% |
| 👥 **CRM Module** | 📋 Planejado | 0% |
| 🔧 **Services Module** | 📋 Planejado | 0% |
| 📅 **Agendamento Module** | 📋 Planejado | 0% |

## 🚀 Roadmap de Desenvolvimento

### **Fase 1: Fundação (Semanas 1-2)**
- [x] Documentação completa
- [ ] Setup ambiente Docker
- [ ] Módulo User Management
- [ ] Autenticação multi-tenant

### **Fase 2: CRM (Semanas 3-4)**
- [ ] Módulo CRM completo
- [ ] CRUD clientes
- [ ] Integração com Auth
- [ ] Frontend React

### **Fase 3: Services (Semanas 5-6)**
- [ ] Gestão de serviços e profissionais
- [ ] Registro de atendimentos
- [ ] Upload de fotos
- [ ] Integração CRM

### **Fase 4: Agendamento (Semanas 7-8)**
- [ ] Calendário visual
- [ ] Notificações WhatsApp
- [ ] Integração Services
- [ ] Anti-conflito de horários

### **Fase 5: Polimento (Semanas 9-10)**
- [ ] Frontend completo
- [ ] Relatórios e dashboards
- [ ] Testes automatizados
- [ ] IA Monitor básico

### **Fase 6: Validação (Semanas 11-12)**
- [ ] Deploy produção
- [ ] Onboarding clientes beta
- [ ] Feedback e ajustes
- [ ] Documentação final

## 🎯 MVP - Resumo Executivo

**Objetivo:** Sistema completo para clínicas e salões gerenciarem clientes, serviços e agendamentos.

**Público-Alvo:** 
- Clínicas médicas/odontológicas
- Salões de beleza/estética
- Consultórios diversos
- Prestadores de serviços com agenda

**Diferenciais:**
- ✅ **Multi-tenant seguro** - Cada empresa isolada
- ✅ **Modular** - Só paga pelos módulos que usa
- ✅ **Calendário inteligente** - Por profissional + anti-conflito
- ✅ **WhatsApp automático** - Confirmações e lembretes
- ✅ **Registro completo** - Histórico + fotos antes/depois
- ✅ **Relatórios reais** - Faturamento, performance, KPIs

**Métricas de Sucesso:**
- 10 empresas usando ativamente
- 500+ agendamentos/mês no sistema  
- NPS > 8
- 30 dias sem crashes críticos

## 📞 Como Contribuir

1. **Leia a documentação** relevante antes de começar
2. **Siga os padrões** em [04-development/coding-guidelines.md](04-development/coding-guidelines.md)
3. **Teste tudo** - cada módulo tem estratégia de teste específica
4. **Documente mudanças** - use templates em [05-templates/](05-templates/)

## 🔗 Links Úteis

- 📋 [Kanban Board](https://github.com/project/issues) - Tarefas e progresso
- 🐳 [Docker Setup](04-development/setup-guide.md) - Ambiente local
- 🧪 [Testing Guide](04-development/testing-strategy.md) - Como testar
- 🚀 [Deploy Guide](04-development/deployment-guide.md) - Como fazer deploy

---

**💡 Dica:** Use Ctrl+F para buscar rapidamente por tópicos específicos nesta documentação.

**🆘 Precisa de ajuda?** Consulte o arquivo específico do módulo em [02-modules/](02-modules/) ou a arquitetura em [01-architecture/](01-architecture/).