# Design System - Nexus ERP

## Visão Geral
Sistema de design unificado baseado na `Biblioteca_visual.tsx`, garantindo consistência visual e experiência de usuário padronizada em todos os módulos do Nexus ERP.

## 🎨 Paleta de Cores

### Cores Principais
```tsx
const customColors = {
  primary: '#2563EB',        // Azul Corporativo - Ações principais
  secondary: '#334155',      // Grafite Escuro - Elementos secundários
  accent: '#3B82F6'          // Azul Vibrante - Destaques
};
```

### Cores de Feedback
```tsx
const feedbackColors = {
  success: '#16A34A',        // Verde Esperança - Sucesso
  error: '#DC2626',          // Vermelho Alerta - Erros
  warning: '#F59E0B'         // Amarelo Cautela - Avisos
};
```

### Cores de Background e Texto
```tsx
const neutralColors = {
  bgLight: '#F8FAFC',        // Branco Gelo - Fundo claro
  bgDark: '#0F172A',         // Azul Ardósia - Fundo escuro
  textPrimary: '#020617',    // Grafite Intenso - Texto principal
  textSecondary: '#64748B'   // Cinza Médio - Texto secundário
};
```

## 📐 Componentes Base

### Button
**Arquivo de Referência:** `Biblioteca_visual.tsx:75-119`

#### Variantes Disponíveis
- `primary` - Ações principais (salvar, criar)
- `secondary` - Ações secundárias (cancelar, voltar)
- `success` - Confirmações (aprovar, finalizar)
- `warning` - Ações de atenção (editar, alterar)
- `error` - Ações de risco (excluir, remover)
- `ghost` - Ações sutis (filtros, opções)

#### Tamanhos
- `sm` - Pequeno (px-3 py-1.5)
- `md` - Médio (px-4 py-2) - Padrão
- `lg` - Grande (px-6 py-3)

#### Props Especiais
- `loading` - Estado de carregamento com spinner
- `icon` - Ícone do Lucide React
- `disabled` - Estado desabilitado

### Input
**Arquivo de Referência:** `Biblioteca_visual.tsx:122-169`

#### Características
- Label com indicador obrigatório (*)
- Ícone opcional (esquerda)
- Validação visual de erro
- Focus states customizados
- Suporte a placeholder

#### Estados Visuais
- **Normal:** Border cinza, background branco gelo
- **Focus:** Border azul primário com shadow
- **Error:** Border vermelho com mensagem

### Select
**Arquivo de Referência:** `Biblioteca_visual.tsx:172-208`

#### Funcionalidades
- Opções via array `{value, label}`
- Estados de erro idênticos ao Input
- Label e required indicator
- Focus states consistentes

## 📊 Componentes de Dados

### KPICard
**Arquivo de Referência:** `Biblioteca_visual.tsx:211-248`

#### Elementos
- **Ícone:** Com background colorido (15% opacity)
- **Valor:** Título grande em destaque
- **Mudança:** Percentual com cores de trend
- **Título:** Descrição do KPI
- **Loading:** Skeleton com animação

#### Trends
- `up` - Verde (positivo)
- `down` - Vermelho (negativo) 
- `neutral` - Cinza (sem mudança)

### DataTable
**Arquivo de Referência:** `Biblioteca_visual.tsx:370-520`

#### Funcionalidades Completas
- **Pesquisa:** Input com ícone de busca
- **Paginação:** Controles de navegação
- **Ações:** View, Edit, Delete por linha
- **Export:** Botão de exportação
- **Loading:** Estado de carregamento
- **Custom Renders:** Formatação customizada por coluna

#### Estrutura de Colunas
```tsx
const columns = [
  { 
    key: 'campo', 
    label: 'Nome da Coluna',
    render: (value, row) => <CustomComponent /> // Opcional
  }
];
```

## 🔔 Componentes de Feedback

### Toast
**Arquivo de Referência:** `Biblioteca_visual.tsx:26-59`

#### Tipos
- `info` - Informação (azul)
- `success` - Sucesso (verde)
- `warning` - Aviso (amarelo)
- `error` - Erro (vermelho)

#### Características
- Auto-dismiss (4s padrão)
- Posição fixa (top-right)
- Ícone por tipo
- Botão de fechamento manual

### Alert
**Arquivo de Referência:** `Biblioteca_visual.tsx:251-306`

#### Diferença do Toast
- Permanente (sem auto-dismiss)
- Integrado no layout
- Título opcional
- Conteúdo em children

## 🏗️ Componentes de Layout

### Sidebar
**Arquivo de Referência:** `Biblioteca_visual.tsx:337-367`

#### Estados
- **Expandido:** 224px (w-56) com labels
- **Colapsado:** 64px (w-16) apenas ícones
- **Transição:** 300ms duration

#### Estrutura de Items
```tsx
const sidebarItems = [
  { 
    icon: Home, 
    label: 'Dashboard', 
    active: true, // Estado ativo
    href: '/dashboard' 
  }
];
```

### Modal
**Arquivo de Referência:** `Biblioteca_visual.tsx:309-334`

#### Tamanhos Disponíveis
- `sm` - 448px (max-w-md)
- `md` - 512px (max-w-lg) - Padrão
- `lg` - 672px (max-w-2xl)
- `xl` - 896px (max-w-4xl)

#### Características
- Overlay escuro (bg-black bg-opacity-50)
- Header com título e botão fechar
- Body com scroll automático
- Z-index 50 para sobreposição

## 🎯 Utilitários

### LoadingSpinner
**Arquivo de Referência:** `Biblioteca_visual.tsx:62-72`

#### Tamanhos
- `sm` - 16px (w-4 h-4)
- `md` - 24px (w-6 h-6)
- `lg` - 32px (w-8 h-8)

#### Cores
- Definida via props `color`
- Animação spin padrão Tailwind

## 📱 Responsividade

### Breakpoints Padrão (Tailwind)
- `sm` - 640px+
- `md` - 768px+
- `lg` - 1024px+
- `xl` - 1280px+

### Padrões de Grid
- **KPIs:** `grid-cols-1 md:grid-cols-4`
- **Cards:** `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3`
- **Tabelas:** Scroll horizontal em telas pequenas

## 🎨 Padrões de Interface ERP

### Dashboard Layout
1. **Header:** Título + busca + notificações + perfil
2. **KPIs:** Grid de 4 colunas responsivo
3. **Alertas:** Informações importantes
4. **Ações:** Botões de ação principal
5. **Dados:** Tabela com funcionalidades completas

### Cores por Módulo (Sugestão)
- **Auth:** `primary` (azul corporativo)
- **CRM:** `success` (verde)
- **Sales:** `accent` (azul vibrante)
- **Inventory:** `warning` (amarelo)
- **Financial:** `secondary` (grafite)

## 🔧 Implementação nos Módulos

### Importação Padrão
```tsx
import { 
  Button, Input, Select, KPICard, DataTable, 
  Toast, Alert, Modal, Sidebar, LoadingSpinner 
} from '@/shared/components/ui';
```

### Estrutura de Diretório
```
shared/
├── components/
│   ├── ui/           # Componentes da biblioteca
│   ├── forms/        # Componentes de formulário
│   ├── data/         # Componentes de dados
│   └── layout/       # Componentes de layout
├── styles/
│   ├── colors.ts     # Paleta de cores
│   └── theme.ts      # Configurações tema
└── utils/
    └── design.ts     # Utilitários visuais
```

## 📋 Checklist de Consistência

### Para Cada Nova Tela
- [ ] Usar paleta de cores definida
- [ ] Aplicar componentes base (Button, Input, etc.)
- [ ] Seguir padrão de layout (Header + Content)
- [ ] Implementar estados de loading
- [ ] Adicionar feedback visual (Toast/Alert)
- [ ] Garantir responsividade
- [ ] Testar acessibilidade básica

### Para Cada Novo Componente
- [ ] Seguir nomenclatura consistente
- [ ] Implementar props padrão (size, variant)
- [ ] Adicionar estados (loading, error, disabled)
- [ ] Documentar props e exemplos
- [ ] Testar em diferentes breakpoints

## 🚀 Próximos Passos
1. Extrair componentes para módulo `shared/`
2. Configurar Storybook para documentação visual
3. Implementar tema escuro/claro
4. Adicionar testes visuais automatizados
5. Criar templates de página por módulo