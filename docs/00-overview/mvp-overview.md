# MVP Nexus ERP - Visão Geral

**Produto Mínimo Viável** focado em **gestão de clientes com agendamento inteligente**, validando o conceito de arquitetura modular e multi-tenant antes da expansão completa.

## 🎯 Objetivo do MVP

### **Validar 3 Pilares Fundamentais:**
1. **Arquitetura Modular:** Comprovar que módulos independentes funcionam integrados
2. **Multi-tenant Seguro:** Garantir isolamento total entre empresas
3. **Value Proposition:** Demonstrar valor real para pequenos negócios

### **Público-Alvo MVP:**
- **Clínicas médicas/odontológicas**
- **Salões de beleza/estética** 
- **Consultórios diversos**
- **Prestadores de serviços com agenda**

## 📦 Módulos do MVP

### 1. **Módulo User Management** 
**Responsabilidade:** Autenticação e gestão de usuários

| Funcionalidade | Prioridade | Complexidade |
|:---------------|:----------|:-------------|
| Login/Logout multi-tenant | CRÍTICA | Média |
| Cadastro de usuários da empresa | CRÍTICA | Baixa |
| Roles básicos (Admin, User) | ALTA | Média |
| Recuperação de senha | MÉDIA | Baixa |
| Auditoria básica de login | BAIXA | Baixa |

**Tecnologias:**
- Container: `nexus-user-management:5001`
- Database: Schema `nexus_auth`
- JWT + Company isolation

### 2. **Módulo CRM**
**Responsabilidade:** Gestão completa de clientes

| Funcionalidade | Prioridade | Complexidade |
|:---------------|:----------|:-------------|
| CRUD clientes (nome, telefone, email) | CRÍTICA | Baixa |
| Histórico de contatos | ALTA | Média |
| Histórico de atendimentos (via Services) | ALTA | Média |
| Segmentação básica (tags) | MÉDIA | Baixa |
| Busca avançada de clientes | MÉDIA | Média |
| Importação CSV clientes | BAIXA | Alta |

**Tecnologias:**
- Container: `nexus-crm:5002`
- Database: Schema `nexus_crm`
- APIs REST para Services/Agendamento

### 3. **Módulo Services** ⭐ **NOVO**
**Responsabilidade:** Gestão de serviços, profissionais e atendimentos

| Funcionalidade | Prioridade | Complexidade |
|:---------------|:----------|:-------------|
| CRUD Serviços (procedimentos, duração, preço) | CRÍTICA | Baixa |
| CRUD Profissionais (equipe, especialidades) | CRÍTICA | Baixa |
| Registro de Atendimento Realizado | CRÍTICA | Média |
| Histórico por Cliente | ALTA | Média |
| Agenda por Profissional | ALTA | Alta |
| Controle Financeiro Básico (pagamentos) | ALTA | Média |
| Relatório Diário (atendimentos + faturamento) | MÉDIA | Média |

**Tecnologias:**
- Container: `nexus-services:5003`
- Database: Schema `nexus_services`
- Integração: CRM + Agendamento + User Management

### 4. **Módulo Agendamento**
**Responsabilidade:** Gestão de agenda e compromissos

| Funcionalidade | Prioridade | Complexidade |
|:---------------|:----------|:-------------|
| Criar/editar/cancelar agendamentos | CRÍTICA | Média |
| Calendário visual por profissional | CRÍTICA | Alta |
| Associar agendamento a cliente + serviço | CRÍTICA | Média |
| Seleção de profissional disponível | CRÍTICA | Média |
| Notificação WhatsApp/SMS | ALTA | Alta |
| Bloqueio de horários | ALTA | Baixa |
| Relatório mensal de agendamentos | MÉDIA | Média |

**Tecnologias:**
- Container: `nexus-agendamento:5007`  
- Database: Schema `nexus_agendamento`
- Integração: WhatsApp Business API + Services

## 🔄 Fluxos Operacionais Completos

### **📞 Fluxo 1: Cliente Liga para Agendar**
```
1. Login (User Management) 
   ↓
2. Busca cliente existente (CRM)
   ↓  
3. Vê serviços disponíveis (Services)
   ↓
4. Escolhe profissional especializado (Services)
   ↓
5. Verifica agenda do profissional (Services + Agendamento)
   ↓
6. Cria agendamento com serviço + profissional (Agendamento)
   ↓
7. Sistema envia confirmação WhatsApp automática
```

### **🏃‍♀️ Fluxo 2: Cliente Chega para Atendimento**
```
1. Profissional vê agendamento do dia (Agendamento)
   ↓
2. Acessa ficha completa do cliente (CRM)
   ↓
3. Revisa histórico de procedimentos anteriores (Services)
   ↓
4. Realiza o procedimento
   ↓
5. Registra atendimento realizado (Services):
   - Anota observações do procedimento
   - Registra se pagamento foi efetuado
   - Upload fotos antes/depois (opcional)
   ↓
6. Agenda próxima sessão se necessário (Agendamento)
```

### **💡 Fluxo 3: Relatórios de Gestão**
```
1. Gestor acessa dashboard (Services)
   ↓
2. Visualiza atendimentos realizados no dia
   ↓
3. Analisa faturamento por profissional
   ↓
4. Identifica serviços mais procurados
   ↓
5. Avalia performance da equipe
```

### **APIs de Integração Cross-Module:**
| Origem | Destino | Endpoint | Finalidade |
|:-------|:--------|:---------|:-----------|
| Services | CRM | `GET /crm/customers/:id` | Buscar dados do cliente para atendimento |
| Services | CRM | `POST /crm/customers/:id/notes` | Salvar observações do atendimento |
| Agendamento | Services | `GET /services/professionals` | Listar profissionais disponíveis |
| Agendamento | Services | `GET /services/procedures` | Listar serviços para agendamento |
| Agendamento | Services | `POST /services/appointments/:id/complete` | Marcar agendamento como realizado |
| Services | User Management | `GET /auth/validate` | Validar permissões |
| CRM | User Management | `GET /auth/validate` | Validar permissões |
| Agendamento | User Management | `GET /auth/validate` | Validar permissões |

## 🏗️ Arquitetura MVP com 4 Módulos

### **Infraestrutura Atualizada:**
```yaml
# docker-compose.yml MVP
services:
  nexus-user-management:
    ports: ["5001:5000"]
    resources: { cpu: 0.5, memory: 1GB }
    
  nexus-crm:
    ports: ["5002:5000"]  
    resources: { cpu: 0.5, memory: 1GB }
    
  nexus-services:           # ⭐ NOVO
    ports: ["5003:5000"]
    resources: { cpu: 1.0, memory: 2GB }  # Processa fotos e relatórios
    
  nexus-agendamento:
    ports: ["5007:5000"]
    resources: { cpu: 1.0, memory: 2GB }  # Calendário + integração Services
    
  postgres:
    ports: ["5433:5432"]
    
  redis:
    ports: ["6379:6379"]    # Cache + sessões
```

### **Schemas PostgreSQL MVP:**
```sql
-- Schemas essenciais MVP
CREATE SCHEMA nexus_auth;           -- Usuários e empresas
CREATE SCHEMA nexus_crm;            -- Clientes  
CREATE SCHEMA nexus_services;       -- ⭐ Serviços, profissionais, atendimentos
CREATE SCHEMA nexus_agendamento;    -- Agenda e compromissos
CREATE SCHEMA nexus_shared;         -- Logs e auditoria básica
```

### **Estrutura Database Services:**
```sql
-- Módulo Services - Tabelas essenciais
CREATE TABLE nexus_services.services (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,        -- "Limpeza de Pele"
  duration_minutes INTEGER NOT NULL, -- 60 minutos
  price DECIMAL(10,2),              -- 150.00
  active BOOLEAN DEFAULT true
);

CREATE TABLE nexus_services.professionals (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID,                     -- Link para nexus_auth.users
  name VARCHAR(255) NOT NULL,
  specialties TEXT[],               -- ["estética", "massagem"]
  work_schedule JSONB,              -- Horários de trabalho
  active BOOLEAN DEFAULT true
);

CREATE TABLE nexus_services.appointments_completed (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL,        -- Referencia nexus_crm.customers
  professional_id UUID REFERENCES nexus_services.professionals(id),
  service_id UUID REFERENCES nexus_services.services(id),
  appointment_date DATE NOT NULL,
  notes TEXT,                       -- Observações do atendimento
  photos TEXT[],                    -- URLs fotos antes/depois
  payment_status VARCHAR(20),       -- paid, pending, partial
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR(50)        -- cash, card, pix
);
```

### **Stack Tecnológica Atualizada:**
| Componente | MVP | Versão Completa |
|:-----------|:----|:----------------|
| **Containers** | 4 módulos | 6 módulos |
| **Database** | PostgreSQL com 5 schemas | Multi-schema otimizado |
| **Cache** | Redis básico | Redis + estratégias avançadas |
| **Integração** | REST APIs cross-module | REST + Message Broker |
| **Monitoramento** | Logs básicos | IA Monitor completo |
| **Deploy** | Manual/Docker Compose | CI/CD automatizado |

## 💼 Proposta de Valor MVP

### **Para o Cliente Final:**
- ✅ **Gestão Completa:** Clientes + Serviços + Profissionais + Agenda em um sistema
- ✅ **Histórico Detalhado:** Toda evolução do cliente documentada
- ✅ **Agenda por Profissional:** Cada especialista tem sua agenda individual
- ✅ **Controle Financeiro:** Registra pagamentos e gera relatórios diários
- ✅ **Notificações Automáticas:** WhatsApp/SMS sem esforço manual
- ✅ **Multi-usuário Seguro:** Equipe toda usa, dados isolados por empresa
- ✅ **Profissional:** Sai do papel/Excel/WhatsApp para sistema real

### **Diferenciais MVP:**
- 📋 **Registro de Atendimento:** Anota o que foi feito + fotos antes/depois
- 💰 **Controle de Pagamento:** Sabe quem pagou, quem deve, quanto faturou
- 👩‍⚕️ **Gestão de Equipe:** Agenda separada por profissional especialista
- 📊 **Relatórios Reais:** Faturamento diário, serviço mais vendido, performance

### **Para Validação Técnica:**
- ✅ **Multi-tenant Real:** Cada empresa totalmente isolada (schema separation)
- ✅ **Modularidade Integrada:** 4 módulos independentes mas conectados via APIs
- ✅ **Cross-module Communication:** Testa integrações complexas reais
- ✅ **Escalabilidade Base:** Arquitetura preparada para adicionar Sales, Financial
- ✅ **Performance Real:** Testa carga com calendários + relatórios + uploads

## 📊 Métricas de Sucesso MVP

### **Métricas Técnicas:**
| Métrica | Meta MVP | Como Medir |
|:--------|:---------|:-----------|
| **Uptime** | 99% | Monitoramento básico |
| **Response Time** | < 2s | Logs de performance |
| **Concurrent Users** | 50/empresa | Load testing |
| **Data Isolation** | 100% | Testes de segurança |

### **Métricas de Negócio:**
| Métrica | Meta MVP | Como Medir |
|:--------|:---------|:-----------|
| **Empresas Ativas** | 10 clientes | Dashboard admin |
| **Agendamentos/Mês** | 500+ | Relatórios automáticos |
| **Satisfação Cliente** | NPS > 8 | Pesquisa mensal |
| **Churn Rate** | < 5%/mês | Analytics de uso |

## 🚀 Roadmap de Implementação MVP Atualizado

### **Fase 1 - Fundação (Semana 1-2)**
- [ ] Setup PostgreSQL com 5 schemas MVP
- [ ] Container User Management funcionando
- [ ] Autenticação JWT + multi-tenant + roles básicos
- [ ] Deploy local com Docker Compose

### **Fase 2 - CRM Core (Semana 3-4)**
- [ ] Container CRM funcionando  
- [ ] CRUD clientes completo
- [ ] API integração User Management ↔ CRM
- [ ] Frontend React básico para CRM

### **Fase 3 - Services Core (Semana 5-6)** ⭐ **NOVA FASE**
- [ ] Container Services funcionando
- [ ] CRUD Serviços + Profissionais
- [ ] Registro de Atendimentos Realizados
- [ ] API integração Services ↔ CRM
- [ ] Frontend para gestão de serviços/equipe

### **Fase 4 - Agendamento Integrado (Semana 7-8)**
- [ ] Container Agendamento funcionando
- [ ] Calendário visual por profissional
- [ ] Integração completa: Agendamento ↔ Services ↔ CRM
- [ ] API WhatsApp básica funcionando

### **Fase 5 - Funcionalidades Avançadas (Semana 9-10)**
- [ ] Relatórios financeiros diários
- [ ] Upload e gerenciamento de fotos
- [ ] Histórico completo por cliente
- [ ] Frontend polido e responsivo

### **Fase 6 - Validação Real (Semana 11-12)**
- [ ] Deploy em servidor de produção
- [ ] Onboarding de 3-5 clínicas/salões beta
- [ ] Coleta de feedback operacional
- [ ] Ajustes baseados no uso real

## 🎯 Critérios de Sucesso para Evolução

### **MVP → Versão Completa:**
O MVP será considerado bem-sucedido e pronto para evolução quando:

1. **✅ Estabilidade Técnica:** 30 dias sem crashes críticos
2. **✅ Adoção Real:** 10 empresas usando ativamente
3. **✅ Feedback Positivo:** NPS médio > 8
4. **✅ Escalabilidade Comprovada:** Sistema suporta 500+ agendamentos/mês
5. **✅ Segurança Validada:** Zero incidentes de cross-tenant

### **Próximos Módulos (Pós-MVP):**
1. **Sales** - Vendas e faturamento
2. **Financial** - Controle financeiro  
3. **Inventory** - Gestão de produtos/serviços
4. **Reports** - Relatórios avançados
5. **Notifications** - Central de comunicações

## 💡 Decisões Arquiteturais MVP vs Full

### **Simplificações Temporárias:**
| Aspecto | MVP | Full Version |
|:--------|:----|:-------------|
| **IA Monitoring** | Logs básicos | IA completa com Telegram |
| **Auto-scale** | Manual | Automático baseado em métricas |
| **Rollback** | Manual | IA inteligente |
| **Cache Strategy** | Redis simples | Estratégias por tipo de dado |
| **Testing** | Manual | 500+ testes automatizados |

### **Componentes Mantidos:**
- ✅ Multi-tenant com schema isolation
- ✅ Containerização modular
- ✅ API REST entre módulos  
- ✅ JWT + company isolation
- ✅ Database structure preparada para expansão

## 📋 Próximos Passos

1. **Aprovação do Escopo:** Confirmar funcionalidades do MVP
2. **Setup Ambiente:** PostgreSQL + Docker local
3. **Começar pelo User Management:** Base para tudo
4. **Definir Frontend:** React components baseados na Biblioteca_visual.tsx
5. **Timeline Detalhada:** Planning semanal das implementações