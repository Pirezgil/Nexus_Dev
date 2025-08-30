# Component Library - Nexus ERP

Documentação completa da biblioteca de componentes React baseada na `Biblioteca_visual.tsx`.

## 📍 Localização

**Estrutura Modular:** `shared/components/ui/`

**Importação Padrão:**
```tsx
import { 
  Button, Input, Select, KPICard, DataTable, 
  Toast, Alert, Modal, Sidebar, LoadingSpinner 
} from '@shared/components/ui';
```

## 🎨 Componentes Disponíveis

### **Feedback Components**
- **Toast** - Notificações temporárias
- **Alert** - Mensagens permanentes no layout

### **Form Components**
- **Button** - Botões com variantes e estados
- **Input** - Campos de entrada com validação
- **Select** - Seleção dropdown

### **Data Display**
- **KPICard** - Cards de métricas com trends
- **DataTable** - Tabelas completas com busca e paginação

### **Layout Components**
- **Modal** - Modais responsivos
- **Sidebar** - Menu lateral colapsável

### **Utility Components**
- **LoadingSpinner** - Indicadores de carregamento

## 📋 Documentação Detalhada

Para documentação completa dos componentes, cores e padrões de uso, consulte:

**[Design System Completo](design-system.md)**

## ✅ Refatoração Concluída

1. **✅ Componentes extraídos** para arquivos individuais em `shared/components/ui/`
2. **🔄 Configurar Storybook** para documentação visual
3. **🔄 Implementar tema escuro/claro**
4. **🔄 Adicionar testes visuais** automatizados
5. **🔄 Criar templates** de página por módulo

### Nova Estrutura Implementada
- Cada componente em sua própria pasta com tipos TypeScript
- Barrel file (`index.ts`) para importações organizadas
- Tree-shaking otimizado
- Desenvolvimento paralelo sem conflitos

## 🔧 Como Contribuir

1. **Mantenha consistência** com design system
2. **Documente novos componentes** neste arquivo
3. **Teste em diferentes breakpoints**
4. **Siga nomenclatura** estabelecida
5. **Adicione props padrão** (size, variant, etc.)