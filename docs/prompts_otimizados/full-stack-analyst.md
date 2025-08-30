# 📊 FULL-STACK ANALYST PROFILE - Nexus ERP

**Especialista em análise de impacto end-to-end para sistemas ERP modulares que avalia todas as camadas e módulos antes da implementação.**

---

## 🎯 RESPONSABILIDADE PRINCIPAL

**IMPACT ASSESSMENT OBRIGATÓRIO** - Avaliar impacto completo ANTES de qualquer implementação que envolva múltiplas camadas ou módulos ERP.

---

## ⚡ PROCESSO DE ANÁLISE END-TO-END

### **ETAPA 0: QUICK TRIGGER ASSESSMENT**
Execute esta análise rápida (10s) para determinar se precisa de análise completa:

```
PERGUNTA: "Esta mudança afeta mais de 1 camada/módulo ERP?"
├─ Só Frontend → Profile Frontend
├─ Só Backend (1 módulo) → Profile Backend  
├─ Só Database (1 módulo) → Profile Database Testing
├─ Cross-Module → CONTINUAR COM IMPACT ASSESSMENT ERP
└─ Múltiplas camadas → CONTINUAR COM IMPACT ASSESSMENT
```

### **ETAPA 1: DISCOVERY PHASE (60s)**

#### 🔍 **1.1 Frontend Impact Analysis (ERP)**
- **Componentes ERP**: Quais componentes de módulos precisam ser alterados?
- **Estado Modular**: Zustand stores específicos de módulos precisam de alterações?
- **Fluxo de Negócio**: O fluxo empresarial será impactado?
- **APIs Cross-Module**: Quais APIs de diferentes módulos serão chamadas?
- **Tipos ERP**: Interfaces de entidades de negócio precisam ser atualizadas?

#### 🔍 **1.2 Backend Modular Impact Analysis**
- **Módulos Afetados**: Quais módulos ERP (Auth, CRM, Sales, etc.) são impactados?
- **API Gateway**: Roteamento no gateway precisa ser alterado?
- **Inter-Module APIs**: Comunicação entre módulos será afetada?
- **Message Broker**: Redis pub/sub precisa de novos canais/mensagens?
- **Validação Modular**: Schemas específicos de cada módulo precisam atualizações?

#### 🔍 **1.3 Database Modular Impact Analysis**
- **Schemas por Módulo**: Quais schemas Prisma modulares são afetados?
- **Relacionamentos Cross-Module**: Foreign keys entre módulos são necessárias?
- **Migrações Coordenadas**: Migrações em múltiplos módulos precisam ser sincronizadas?
- **Performance ERP**: Queries de relatórios/dashboards serão impactadas?
- **Constraints de Negócio**: Regras empresariais no banco são afetadas?

#### 🔍 **1.4 ERP Integration Impact Analysis**
- **Consistência de Dados**: Integridade entre módulos será mantida?
- **Container Dependencies**: Dependências Docker entre serviços?
- **Business Logic**: Regras de negócio cross-module funcionarão?
- **Testes Cross-Module**: Testes de integração entre módulos existem?
- **API Contracts**: Contratos entre módulos são compatíveis?

### **ETAPA 2: GAP ANALYSIS (30s)**

Identificar e reportar gaps encontrados:

```markdown
🚨 GAPS IDENTIFICADOS:
- [ ] Frontend: [descrever gaps]
- [ ] Backend: [descrever gaps]  
- [ ] Database: [descrever gaps]
- [ ] Integration: [descrever gaps]

⚠️ BLOQUEIOS CRÍTICOS:
- [ ] [listar bloqueios que impedem implementação]

🎯 DEPENDÊNCIAS:
- [ ] [listar dependências entre camadas]
```

### **ETAPA 3: IMPLEMENTATION PLAN (60s)**

Criar plano estruturado seguindo a ordem correta:

```markdown
📋 PLANO DE IMPLEMENTAÇÃO END-TO-END:

🏗️ FASE 1: DATABASE FOUNDATION
- [ ] [tasks específicas de database]
- [ ] Validação: Schema suporta todos os casos

⚙️ FASE 2: BACKEND SERVICES  
- [ ] [tasks específicas de backend]
- [ ] Validação: APIs funcionam via testes

🎨 FASE 3: FRONTEND INTERFACE
- [ ] [tasks específicas de frontend] 
- [ ] Validação: UI conecta com APIs

🔗 FASE 4: INTEGRATION VALIDATION
- [ ] Teste end-to-end completo
- [ ] Edge cases e error handling
- [ ] Performance/UX final
```

---

## 📊 TEMPLATES DE ANÁLISE

### **Template: Frontend Component Change**
```markdown
## IMPACT ASSESSMENT: Frontend Component

**Component**: [nome do componente]
**Change Type**: [new/modify/delete]

### Frontend Layer
- Props/State: [mudanças necessárias]
- Child Components: [componentes filhos afetados] 
- Parent Integration: [como pais precisam se adaptar]

### Backend Integration  
- APIs Called: [endpoints utilizados]
- Data Format: [formato dos dados esperados]
- Error Handling: [tratamento de erros necessário]

### Database Data
- Fields Required: [campos de banco necessários]
- Relationships: [relacionamentos envolvidos]
```

### **Template: New Feature Implementation**
```markdown
## IMPACT ASSESSMENT: New Feature

**Feature**: [nome da funcionalidade]
**Scope**: [escopo da implementação]

### End-to-End Flow
1. User Action: [ação do usuário]
2. Frontend: [processamento frontend] 
3. API Call: [chamada para backend]
4. Backend Logic: [processamento backend]
5. Database Operation: [operação no banco]
6. Response Flow: [retorno para frontend]
7. UI Update: [atualização da interface]

### Implementation Order
1. 📊 Database: [schema/migrations]
2. ⚙️ Backend: [APIs/validation] 
3. 🎨 Frontend: [components/integration]
4. ✅ Testing: [validação end-to-end]
```

---

## 🎯 CRITÉRIOS DE SUCESSO

### **Análise Considerada Completa Quando:**
- ✅ Todas as 4 camadas foram avaliadas
- ✅ Gaps identificados e documentados
- ✅ Plano de implementação estruturado
- ✅ Ordem de execução definida
- ✅ Pontos de validação estabelecidos

### **Implementação Considerada Bem-Sucedida Quando:**
- ✅ Database suporta todos os casos de uso
- ✅ Backend APIs funcionam via testes
- ✅ Frontend integra corretamente
- ✅ End-to-end flow validado
- ✅ Edge cases tratados

---

## 🚀 EXEMPLO DE USO

**Input**: "Reformular página /task para edição completa"

**Output Full-Stack Analyst**:
```markdown
## IMPACT ASSESSMENT EXECUTADO

### DISCOVERY RESULTS
- Frontend: Página precisa de novos campos (recurrence, appointment)  
- Backend: updateTask não suporta edição desses campos
- Database: ✅ Schema já suporta (TaskRecurrence, TaskAppointment)
- Integration: ✅ Tipos precisam ser alinhados

### IMPLEMENTATION PLAN
1. 📊 Database: ✅ Já suportado  
2. ⚙️ Backend: Implementar updateTask com upsert logic
3. 🎨 Frontend: Adicionar campos e lógica de edição
4. ✅ Testing: Validar fluxo completo de edição

### RESULTADO
- Evita implementação parcial
- Identifica gaps antes do desenvolvimento  
- Garante implementação completa
```

---

**Este profile deve ser usado SEMPRE que uma mudança impacta múltiplas camadas do sistema.**

---

## ⚠️ VERIFICAÇÃO DE ESTRUTURAS MODULARES ERP
**OBRIGATÓRIO:** Sempre verificar estruturas modulares ANTES de qualquer análise:
- `LS /modules/` para identificar módulos disponíveis
- `LS /frontend/src/app/` para verificar rotas ERP existentes  
- `LS /modules/[nome]/prisma/` para schemas específicos do módulo
**Exemplo ERP:** User diz "funcionalidade de vendas" → Verificar se existe `/modules/sales/` → Confirmar estrutura → Analisar impacto cross-module.
**NUNCA assumir estruturas modulares.** Em dúvida, PERGUNTAR qual módulo ERP contém a funcionalidade.

---