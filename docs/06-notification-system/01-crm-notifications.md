# Sistema de Notificações - Módulo CRM
## Plano de Implementação Completo

### 📋 **VISÃO GERAL**

Sistema completo de avisos e notificações para o módulo CRM do ERP Nexus, focado em melhorar a experiência do usuário através de feedback claro e contextualizado.

---

## 🎯 **1. MAPEAMENTO DE CENÁRIOS**

### **1.1 Operações de Cliente**

#### **🟢 Cenários de Sucesso**
- ✅ Cliente criado com sucesso
- ✅ Cliente atualizado com sucesso  
- ✅ Cliente removido com sucesso
- ✅ Tags adicionadas ao cliente
- ✅ Tags removidas do cliente
- ✅ Dados importados de CSV
- ✅ Dados exportados com sucesso

#### **🔴 Cenários de Erro**
- ❌ Cliente com documento já existe (409)
- ❌ Cliente não encontrado (404)
- ❌ Dados inválidos (400)
- ❌ Sem permissão para operação (403)
- ❌ Token expirado/inválido (401)
- ❌ Erro interno do servidor (500)
- ❌ Falha na conexão com banco
- ❌ Arquivo CSV inválido
- ❌ Limite de clientes atingido

#### **🟡 Cenários de Aviso**
- ⚠️ Cliente sem interações há X dias
- ⚠️ Dados incompletos no cadastro
- ⚠️ Email/telefone inválido
- ⚠️ Duplicata potencial detectada

### **1.2 Operações de Interação**
- ✅ Interação registrada
- ✅ Interação atualizada
- ❌ Falha ao registrar interação
- ⚠️ Interação pendente há X dias

### **1.3 Operações de Notas**
- ✅ Nota adicionada
- ✅ Nota atualizada/removida
- ❌ Falha ao salvar nota
- ⚠️ Nota muito longa

---

## 🎨 **2. CATÁLOGO DE MENSAGENS**

### **2.1 Mensagens de Sucesso**

```javascript
const SUCCESS_MESSAGES = {
  CUSTOMER_CREATED: {
    title: "Cliente cadastrado!",
    message: "O cliente {customerName} foi cadastrado com sucesso.",
    action: "Ver perfil do cliente",
    icon: "✅",
    duration: 4000
  },
  CUSTOMER_UPDATED: {
    title: "Dados atualizados!",
    message: "As informações do cliente foram salvas.",
    icon: "💾",
    duration: 3000
  },
  CUSTOMER_DELETED: {
    title: "Cliente removido",
    message: "O cliente foi removido permanentemente do sistema.",
    icon: "🗑️",
    duration: 3000
  },
  DATA_EXPORTED: {
    title: "Exportação concluída!",
    message: "Arquivo com {count} clientes foi gerado.",
    action: "Baixar arquivo",
    icon: "📊",
    duration: 5000
  }
}
```

### **2.2 Mensagens de Erro**

```javascript
const ERROR_MESSAGES = {
  DUPLICATE_DOCUMENT: {
    title: "Cliente já existe",
    message: "Já existe um cliente cadastrado com este CPF/CNPJ.",
    suggestion: "Verifique se o cliente já não está cadastrado ou use um documento diferente.",
    action: "Buscar cliente existente",
    icon: "🔍",
    type: "error"
  },
  CUSTOMER_NOT_FOUND: {
    title: "Cliente não encontrado",
    message: "Não foi possível localizar este cliente.",
    suggestion: "Verifique se o cliente não foi removido ou se você tem permissão para visualizá-lo.",
    action: "Voltar à lista",
    icon: "❌",
    type: "error"
  },
  INVALID_DATA: {
    title: "Dados inválidos",
    message: "Alguns campos contêm informações inválidas.",
    suggestion: "Corrija os campos destacados e tente novamente.",
    icon: "⚠️",
    type: "error"
  },
  PERMISSION_DENIED: {
    title: "Sem permissão",
    message: "Você não tem permissão para realizar esta operação.",
    suggestion: "Entre em contato com o administrador do sistema.",
    icon: "🔒",
    type: "error"
  },
  TOKEN_EXPIRED: {
    title: "Sessão expirada",
    message: "Sua sessão expirou por segurança.",
    suggestion: "Faça login novamente para continuar.",
    action: "Fazer login",
    icon: "🔐",
    type: "error"
  }
}
```

### **2.3 Mensagens de Aviso**

```javascript
const WARNING_MESSAGES = {
  INCOMPLETE_DATA: {
    title: "Dados incompletos",
    message: "Este cliente possui informações incompletas.",
    suggestion: "Complete o cadastro para melhor acompanhamento.",
    action: "Completar dados",
    icon: "📝",
    type: "warning"
  },
  NO_RECENT_INTERACTIONS: {
    title: "Cliente inativo",
    message: "Sem interações há {days} dias.",
    suggestion: "Entre em contato para manter o relacionamento.",
    action: "Registrar interação",
    icon: "📞",
    type: "warning"
  }
}
```

---

## 🔧 **3. ESPECIFICAÇÃO TÉCNICA**

### **3.1 Componente de Notificação**

```typescript
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  suggestion?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: string;
  duration?: number; // ms, 0 = manual dismiss
  persistent?: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}
```

### **3.2 Sistema de Triggers**

```typescript
// Hook para notificações automáticas
const useNotifyOnApiResponse = () => {
  const { addNotification } = useNotifications();
  
  const notifyApiResponse = (response: AxiosResponse, operation: string) => {
    const status = response.status;
    
    if (status >= 200 && status < 300) {
      addNotification(getSuccessMessage(operation, response.data));
    } else if (status >= 400 && status < 500) {
      addNotification(getErrorMessage(status, response.data));
    } else if (status >= 500) {
      addNotification(getServerErrorMessage());
    }
  };
  
  return { notifyApiResponse };
};
```

### **3.3 Integração com APIs**

```typescript
// Interceptor Axios para notificações automáticas
axios.interceptors.response.use(
  (response) => {
    // Verifica se deve notificar sucesso
    if (shouldNotifySuccess(response.config)) {
      notifySuccess(response);
    }
    return response;
  },
  (error) => {
    // Notifica erros automaticamente
    notifyError(error.response);
    return Promise.reject(error);
  }
);
```

---

## 📱 **4. INTERFACE DO USUÁRIO**

### **4.1 Posicionamento**
- **Desktop:** Canto superior direito, empilhado
- **Mobile:** Topo da tela, full-width
- **Z-index:** 9999 (sobre modals)

### **4.2 Animações**
- **Entrada:** Slide-in da direita (200ms)
- **Saída:** Fade-out + slide-out (150ms)
- **Hover:** Leve scale (1.02x)

### **4.3 Cores por Tipo**
- **Sucesso:** Verde (#10B981)
- **Erro:** Vermelho (#EF4444)
- **Aviso:** Amarelo (#F59E0B)
- **Info:** Azul (#3B82F6)

---

## 🚀 **5. PLANO DE IMPLEMENTAÇÃO**

### **Fase 1: Fundação (Semana 1)**
- [ ] Criar componente base de notificação
- [ ] Implementar contexto React
- [ ] Definir tipos TypeScript
- [ ] Criar hook de uso

### **Fase 2: Mensagens Core (Semana 2)**
- [ ] Implementar catálogo de mensagens CRM
- [ ] Criar sistema de internacionalização
- [ ] Integrar com operações de cliente
- [ ] Testes unitários

### **Fase 3: Integração API (Semana 3)**
- [ ] Interceptors Axios
- [ ] Mapeamento automático de códigos
- [ ] Tratamento de erros específicos
- [ ] Validação de formulários

### **Fase 4: UX Avançado (Semana 4)**
- [ ] Animações e transições
- [ ] Ações inline (botões)
- [ ] Persistência entre sessões
- [ ] Modo escuro

### **Fase 5: Otimização (Semana 5)**
- [ ] Performance e lazy loading
- [ ] Acessibilidade (ARIA)
- [ ] Testes E2E
- [ ] Documentação final

---

## 📊 **6. MÉTRICAS DE SUCESSO**

### **6.1 Métricas Técnicas**
- Tempo de renderização < 50ms
- Bundle size < 5kb (gzip)
- 0 reflows/repaints desnecessários

### **6.2 Métricas UX**
- 90% dos usuários entendem mensagens de erro
- Redução de 50% em tickets de suporte
- Aumento de 30% na conclusão de tarefas

---

## 🧪 **7. ESTRATÉGIA DE TESTES**

### **7.1 Testes Automatizados**
```javascript
describe('CRM Notifications', () => {
  it('should show success notification on customer creation', () => {
    // Test implementation
  });
  
  it('should show duplicate error with action button', () => {
    // Test implementation
  });
});
```

### **7.2 Testes de Usabilidade**
- [ ] Card sorting das mensagens
- [ ] A/B testing de posicionamento
- [ ] Testes de compreensão de linguagem

---

## 📋 **8. MANUTENÇÃO E EXTENSIBILIDADE**

### **8.1 Adição de Novas Mensagens**
1. Definir no catálogo apropriado
2. Adicionar tipos TypeScript
3. Criar testes
4. Documentar contexto de uso

### **8.2 Internacionalização**
- Estrutura preparada para múltiplos idiomas
- Fallback para português brasileiro
- Formatação de números/datas por locale

---

**Próximos passos:** Validação do plano e início da Fase 1 de implementação.