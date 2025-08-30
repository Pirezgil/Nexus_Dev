# Template - Novo Módulo Nexus ERP

**Use este template para documentar novos módulos do sistema.**

---

# Módulo [NOME_MODULO] - Nexus ERP

**Responsabilidade Central:** [Descrição em uma frase do que o módulo faz]

## 🎯 Objetivo do Módulo

### **Função Principal:**
[Explicação detalhada da responsabilidade do módulo no contexto do sistema]

### **Problemas que Resolve:**
- ✅ **Problema 1:** Descrição do problema
- ✅ **Problema 2:** Descrição do problema  
- ✅ **Problema 3:** Descrição do problema

## 📊 Funcionalidades Detalhadas

### **Prioridade CRÍTICA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Funcionalidade 1** | Descrição detalhada | Baixa/Média/Alta | X dias |
| **Funcionalidade 2** | Descrição detalhada | Baixa/Média/Alta | X dias |

### **Prioridade ALTA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Funcionalidade 3** | Descrição detalhada | Baixa/Média/Alta | X dias |

### **Prioridade MÉDIA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Funcionalidade 4** | Descrição detalhada | Baixa/Média/Alta | X dias |

### **Prioridade BAIXA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Funcionalidade 5** | Descrição detalhada | Baixa/Média/Alta | X dias |

## 🗄️ Database Schema

### **Schema: `nexus_[nome_modulo]`**

```sql
-- Tabela principal
CREATE TABLE [nome_tabela] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, -- Multi-tenant obrigatório
  
  -- Campos específicos do módulo
  campo1 VARCHAR(255) NOT NULL,
  campo2 INTEGER,
  campo3 TIMESTAMP,
  
  -- Auditoria padrão
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_[nome_tabela]_company ON [nome_tabela](company_id);
CREATE INDEX idx_[nome_tabela]_campo1 ON [nome_tabela](campo1);
```

## 🔗 APIs REST Detalhadas

### **Base URL:** `http://localhost:[PORTA]/api`

### **Endpoints Principais**

#### `GET /[modulo]/[recurso]`
**Descrição:** [Descrição do endpoint]

**Query Parameters:**
- `page=1` - Página
- `limit=20` - Registros por página
- `search=termo` - Busca

**Response (200):**
```json
{
  "success": true,
  "data": {
    "[recurso]": [
      {
        "id": "uuid",
        "campo1": "valor",
        "campo2": 123,
        "created_at": "2024-08-23T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### `POST /[modulo]/[recurso]`
**Descrição:** [Descrição do endpoint]

**Request:**
```json
{
  "campo1": "valor",
  "campo2": 123,
  "campo3": "2024-08-23"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "[recurso_singular]": {
      "id": "uuid",
      "campo1": "valor",
      "campo2": 123,
      "created_at": "2024-08-23T10:30:00Z"
    }
  },
  "message": "[Recurso] criado com sucesso"
}
```

#### `PUT /[modulo]/[recurso]/:id`
**Descrição:** [Descrição do endpoint]

#### `DELETE /[modulo]/[recurso]/:id`
**Descrição:** [Descrição do endpoint]

### **Endpoints para Outros Módulos**

#### `GET /[modulo]/[recurso]/list` [INTERNAL]
**Descrição:** Lista simplificada para outros módulos

**Response (200):**
```json
{
  "[recurso]": [
    {
      "id": "uuid",
      "name": "Nome",
      "active": true
    }
  ]
}
```

## 🎨 Frontend Components

### **Páginas React**
| Componente | Rota | Descrição | Acesso |
|:----------|:-----|:----------|:-------|
| `[Recurso]Page` | `/[recurso]` | Lista de recursos | [MODULO] read |
| `[Recurso]DetailPage` | `/[recurso]/:id` | Detalhes do recurso | [MODULO] read |
| `[Recurso]CreatePage` | `/[recurso]/new` | Criar recurso | [MODULO] write |
| `[Recurso]EditPage` | `/[recurso]/:id/edit` | Editar recurso | [MODULO] write |

### **Componentes Base**

#### `[Recurso]Table.tsx`
```tsx
import { DataTable, Button, KPICard } from '@/shared/components/ui';
import { [IconName] } from 'lucide-react';

const columns = [
  { 
    key: 'campo1', 
    label: 'Campo 1',
    render: (value: string) => (
      <div className="font-medium">{value}</div>
    )
  },
  { 
    key: 'campo2', 
    label: 'Campo 2',
    render: (value: number) => value.toLocaleString()
  }
];

export const [Recurso]Table = () => {
  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Total [Recursos]"
          value="100"
          icon={[IconName]}
        />
      </div>

      {/* Tabela */}
      <DataTable
        data={recursos}
        columns={columns}
        loading={loading}
        onView={(item) => router.push(`/[recurso]/${item.id}`)}
        onEdit={(item) => router.push(`/[recurso]/${item.id}/edit`)}
        searchPlaceholder="Buscar [recurso]..."
      />
    </div>
  );
};
```

#### `[Recurso]Form.tsx`
```tsx
import { Input, Select, Button } from '@/shared/components/ui';

export const [Recurso]Form = ({ [recurso], onSubmit, loading }) => {
  const [formData, setFormData] = useState([recurso] || {
    campo1: '',
    campo2: '',
    campo3: ''
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Dados do [Recurso]</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Campo 1"
            value={formData.campo1}
            onChange={(e) => setFormData({...formData, campo1: e.target.value})}
            required
          />
          
          <Input
            label="Campo 2"
            type="number"
            value={formData.campo2}
            onChange={(e) => setFormData({...formData, campo2: e.target.value})}
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button variant="primary" loading={loading} type="submit">
          {[recurso]?.id ? 'Atualizar' : 'Criar'} [Recurso]
        </Button>
      </div>
    </form>
  );
};
```

## 🧪 Testes Essenciais

### **Testes de Integração**
```typescript
describe('[Modulo] Module Integration', () => {
  describe('POST /[modulo]/[recurso]', () => {
    it('should create [recurso] successfully', async () => {
      const [recurso]Data = {
        campo1: 'valor teste',
        campo2: 123
      };

      const response = await request(app)
        .post('/api/[modulo]/[recurso]')
        .set('Authorization', `Bearer ${authToken}`)
        .send([recurso]Data);

      expect(response.status).toBe(201);
      expect(response.body.data.[recurso_singular].campo1).toBe('valor teste');
    });

    it('should enforce multi-tenant isolation', async () => {
      const company1Token = await getCompanyToken('company1');
      const company2Token = await getCompanyToken('company2');
      
      // Criar recurso na company1
      await create[Recurso]ForCompany('company1', 'recurso1');
      
      // Buscar com token da company2
      const response = await request(app)
        .get('/api/[modulo]/[recurso]')
        .set('Authorization', `Bearer ${company2Token}`);
      
      expect(response.body.data.[recurso]).toHaveLength(0);
    });
  });
});
```

## 🐳 Deploy e Configuração

### **Docker Configuration**
```yaml
# docker-compose.yml
nexus-[nome-modulo]:
  build: ./modules/[nome-modulo]
  ports:
    - "[PORTA]:5000"
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://nexus_[nome_modulo]_user:password@postgres:5432/nexus_erp?schema=nexus_[nome_modulo]
    - USER_MANAGEMENT_URL=http://nexus-user-management:5000
    - REDIS_URL=redis://redis:6379/[NUMERO]
  depends_on:
    - postgres
    - redis
    - nexus-user-management
  networks:
    - nexus-network
```

### **Environment Variables**
```env
# .env
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://nexus_[nome_modulo]_user:password@localhost:5433/nexus_erp?schema=nexus_[nome_modulo]

# Integração com outros módulos
USER_MANAGEMENT_URL=http://localhost:5001
[OUTRO_MODULO]_URL=http://localhost:[PORTA]

# Redis
REDIS_URL=redis://localhost:6379/[NUMERO]
```

## 🔧 Integrações com Outros Módulos

### **Com User Management**
```typescript
// Middleware de autenticação para todas as rotas
app.use('/api/[modulo]', authMiddleware);
app.use('/api/[modulo]', requirePermission('[MODULO]', 'read'));
```

### **Com [Outro Módulo]**
```typescript
// Buscar dados de outro módulo
export const get[Recurso]From[OutroModulo] = async (id: string) => {
  const response = await fetch(`http://nexus-[outro-modulo]:5000/api/[outro-modulo]/[recurso]/${id}/basic`);
  return response.json();
};

// Notificar outro módulo sobre mudanças
export const notify[OutroModulo]Change = async (data: any) => {
  await fetch(`http://nexus-[outro-modulo]:5000/api/[outro-modulo]/webhook/[evento]`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};
```

## 📝 Próximos Passos

### **Fase 1 - MVP (Semana X-Y)**
- [ ] Setup schema nexus_[nome_modulo]
- [ ] CRUD completo de [recurso principal]
- [ ] Integração básica com User Management
- [ ] Frontend básico

### **Fase 2 - Funcionalidades Avançadas (Semana Y+1)**
- [ ] [Funcionalidade avançada 1]
- [ ] [Funcionalidade avançada 2]
- [ ] Relatórios e dashboards
- [ ] Integração com outros módulos

### **Futuras Melhorias**
- [ ] [Funcionalidade futura 1]
- [ ] [Funcionalidade futura 2]
- [ ] [Otimização específica]

---

## 📋 Checklist de Documentação

### **Ao Criar Novo Módulo:**
- [ ] **Copiar este template** e renomear
- [ ] **Definir responsabilidades** claras do módulo
- [ ] **Mapear integrações** com outros módulos
- [ ] **Projetar schema** de banco multi-tenant
- [ ] **Definir APIs** com requests/responses
- [ ] **Planejar testes** críticos
- [ ] **Estimar tempo** de desenvolvimento
- [ ] **Documentar configurações** Docker

### **Durante Desenvolvimento:**
- [ ] **Manter documentação** atualizada
- [ ] **Documentar mudanças** de API
- [ ] **Atualizar exemplos** de código
- [ ] **Revisar integrações** implementadas

### **Pós Implementação:**
- [ ] **Validar documentação** com código real
- [ ] **Adicionar troubleshooting** comum
- [ ] **Documentar deploy** em produção
- [ ] **Criar guias** de uso