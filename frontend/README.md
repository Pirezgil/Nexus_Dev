# ERP Nexus - Frontend

Sistema de gestão empresarial - Interface Next.js 14

## 🚀 Status do Desenvolvimento

✅ **SEMANA 1 COMPLETA** - Setup Frontend MVP  
🎯 **Próximo:** Integração com APIs Backend

## 📋 Funcionalidades Implementadas

### ✅ Estrutura Base
- **Next.js 14** com App Router e Turbopack
- **TypeScript** com configurações strictas
- **Tailwind CSS** com design system customizado
- **Estrutura modular** seguindo filosofia LEGO

### ✅ Sistema de Autenticação
- **Login Form** integrado com User Management API
- **Zustand Store** para gerenciamento de estado auth
- **JWT Tokens** com refresh automático
- **Proteção de rotas** baseada em autenticação

### ✅ Componentes UI Base
- **Button, Input, Card, Toast** components
- **Design System** baseado no Biblioteca_visual.tsx
- **Responsivo** mobile-first
- **Dark/Light theme** preparado

### ✅ Layout Principal
- **Sidebar navegação** com 4 módulos (CRM, Services, Agendamento, Relatórios)
- **Dashboard Layout** com header e área de conteúdo
- **Navegação inteligente** com estados ativos
- **Perfil do usuário** integrado

### ✅ Dashboard MVP
- **KPI Cards** com métricas principais
- **Ações rápidas** para funcionalidades principais
- **Atividade recente** e próximos agendamentos
- **Gráficos de performance** em progresso

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20+ LTS
- npm ou yarn
- **Backend ERP Nexus rodando** (portas 5003-5007)

### Comandos
```bash
# Instalar dependências
npm install

# Desenvolvimento (porta 5000)
npm run dev

# Build para produção
npm run build

# Executar produção
npm run start

# Type checking
npm run type-check

# Lint
npm run lint
```

### Acesso Local
- **Frontend:** http://localhost:5000
- **Redirecionamento automático:** / → /login ou /dashboard

## 🧪 Credenciais de Teste

**Para desenvolvimento com backend local:**
```
Admin:   admin@demo.com / 123456789
Manager: manager@demo.com / 123456789  
User:    usuario1@demo.com / 123456789
```

## 🏗️ Arquitetura Implementada

### Stack Tecnológica
- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Styling utilitário
- **Zustand** - Gerenciamento de estado global
- **React Query** - Data fetching e cache
- **React Hook Form + Zod** - Formulários e validação
- **Axios** - Cliente HTTP para APIs
- **Lucide React** - Ícones SVG

### Estrutura de Pastas
```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/          # Dashboard principal
│   ├── login/             # Página de login
│   └── layout.tsx         # Layout root
├── components/
│   ├── ui/                # Componentes base reutilizáveis
│   ├── layout/            # Layouts (Sidebar, DashboardLayout)
│   ├── modules/           # Componentes específicos por módulo
│   └── providers/         # React Query e outros providers
├── lib/
│   └── api.ts            # Configuração Axios + APIs backend
├── stores/               # Zustand stores
│   ├── auth.ts          # Estado de autenticação
│   └── ui.ts            # Estado da UI
├── types/
│   └── index.ts         # Types TypeScript integrados
└── utils/
    └── index.ts         # Funções utilitárias
```

## 🔗 Integração com Backend

### APIs Configuradas
```typescript
// URLs configuradas (.env.local)
NEXT_PUBLIC_USER_MANAGEMENT_API=http://localhost:5003  # Auth
NEXT_PUBLIC_CRM_API=http://localhost:5004              # Clientes
NEXT_PUBLIC_SERVICES_API=http://localhost:5005         # Serviços
NEXT_PUBLIC_AGENDAMENTO_API=http://localhost:5007      # Agenda
```

### Cliente API (Axios)
- **Auto-configuração** JWT tokens
- **Refresh tokens** automático
- **Error handling** centralizado
- **Health checks** para todas as APIs

## 📱 Páginas Implementadas

### ✅ Funcionais
- `/` - Home (redireciona baseado em auth)
- `/login` - Página de login com validação
- `/dashboard` - Dashboard principal com KPIs

### 🔄 Próximas (Semana 2-3)
- `/crm/*` - Módulo de clientes
- `/services/*` - Módulo de serviços  
- `/scheduling/*` - Módulo de agendamento
- `/reports` - Relatórios
- `/settings/*` - Configurações

## 🎯 Status Atual

**✅ MVP Frontend Base COMPLETO**  
- Interface funcional em http://localhost:5000
- Sistema de auth integrado com backend
- Layout responsivo e navegação
- Dashboard com KPIs básicos
- Pronto para desenvolvimento dos módulos

**🔄 Próximo Milestone: Semana 2**  
- Integração completa CRM + Services
- CRUD funcional para clientes
- Formulários avançados validados

---

**Desenvolvido em:** Agosto 2025  
**Framework:** Next.js 14 + TypeScript  
**Status:** Semana 1 Completa ✅  
**URL Local:** http://localhost:5000
