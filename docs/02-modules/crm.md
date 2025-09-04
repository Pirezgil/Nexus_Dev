# Módulo CRM - Nexus ERP

**Responsabilidade Central:** Gestão completa de clientes com histórico detalhado de relacionamento e integração com atendimentos realizados.

## 🎯 Objetivo do Módulo

### **Função Principal:**
Centralizar **todas as informações de clientes** da empresa, mantendo histórico completo de contatos, preferências e evolução do relacionamento, servindo como base para agendamentos e atendimentos.

### **Problemas que Resolve:**
- ✅ **Centralização de Clientes:** Todos os dados em um lugar acessível
- ✅ **Histórico Completo:** Evolução do relacionamento com timeline
- ✅ **Busca Inteligente:** Encontra cliente por qualquer informação
- ✅ **Segmentação:** Organiza clientes por grupos/tags para campanhas
- ✅ **Integração:** Alimenta outros módulos com dados consistentes

## 📊 Funcionalidades Detalhadas

### **Prioridade CRÍTICA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **CRUD Clientes** | Criar, ler, editar, excluir clientes | Baixa | 3 dias |
| **Busca Avançada** | Busca por nome, telefone, email, CPF | Média | 2 dias |
| **Histórico de Contatos** | Timeline de todas as interações | Média | 3 dias |
| **Integração Services** | Recebe dados de atendimentos | Média | 2 dias |

### **Prioridade ALTA** 
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Segmentação/Tags** | Organizar clientes por grupos | Baixa | 2 dias |
| **Campos Customizados** | Empresa define campos extras | Média | 3 dias |
| **Notas/Observações** | Anotações livres sobre cliente | Baixa | 1 dia |
| **Histórico de Atendimentos** | Via integração com Services | Baixa | 1 dia |

### **Prioridade MÉDIA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Relatórios de Cliente** | Estatísticas e análises | Média | 3 dias |
| **Exportação** | Excel/CSV de clientes | Baixa | 1 dia |
| **Importação CSV** | Migração de sistemas antigos | Alta | 4 dias |
| **Foto do Cliente** | Upload e gestão de imagens | Média | 2 dias |

### **Prioridade BAIXA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Aniversários** | Alertas de datas especiais | Baixa | 1 dia |
| **Comunicação Integrada** | WhatsApp/email direto | Alta | 5 dias |
| **Geolocalização** | Mapa de clientes | Média | 3 dias |

## 🗄️ Database Schema

### **Schema: `nexus_crm`**

```sql
-- Tabela principal de clientes
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, -- Multi-tenant isolation
  
  -- Dados básicos
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  secondary_phone VARCHAR(20),
  cpf_cnpj VARCHAR(20),
  rg VARCHAR(20),
  
  -- Endereço
  address_street VARCHAR(255),
  address_number VARCHAR(20),
  address_complement VARCHAR(100),
  address_neighborhood VARCHAR(100),
  address_city VARCHAR(100),
  address_state VARCHAR(2),
  address_zipcode VARCHAR(10),
  
  -- Dados demográficos
  birth_date DATE,
  gender VARCHAR(10), -- M, F, Other
  marital_status VARCHAR(20),
  profession VARCHAR(100),
  
  -- Relacionamento
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, blocked
  source VARCHAR(50), -- website, referral, marketing, walk-in
  tags TEXT[], -- ["VIP", "Fidelizado", "Inadimplente"]
  notes TEXT,
  
  -- Preferências
  preferred_contact VARCHAR(20) DEFAULT 'whatsapp', -- phone, email, whatsapp
  marketing_consent BOOLEAN DEFAULT false,
  
  -- Dados de relacionamento
  first_visit DATE,
  last_visit DATE,
  total_visits INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  average_ticket DECIMAL(10,2) DEFAULT 0,
  
  -- Avatar
  avatar_url TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  updated_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, email),
  UNIQUE(company_id, cpf_cnpj)
);

-- Campos customizados por empresa
CREATE TABLE custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL, -- "Tipo de Pele", "Alergia"
  field_type VARCHAR(20) NOT NULL, -- text, number, date, select, boolean
  options JSONB, -- Para tipo select: ["Oleosa", "Seca", "Mista"]
  required BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, name)
);

-- Valores dos campos customizados
CREATE TABLE customer_custom_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  custom_field_id UUID REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT, -- Valor sempre como texto, converte conforme field_type
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(customer_id, custom_field_id)
);

-- Histórico de interações com cliente
CREATE TABLE customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  
  type VARCHAR(50) NOT NULL, -- phone_call, email, whatsapp, visit, service
  subject VARCHAR(255),
  description TEXT,
  direction VARCHAR(20), -- inbound, outbound
  status VARCHAR(20) DEFAULT 'completed', -- completed, pending, cancelled
  
  -- Dados extras baseados no tipo
  metadata JSONB, -- {"phone": "+5511999999999", "duration": 300}
  
  -- Relacionado a atendimento (se aplicável)
  related_service_id UUID, -- Referência para nexus_services.appointments_completed
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Segmentação de clientes
CREATE TABLE customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color para UI
  criteria JSONB, -- Critérios automáticos de segmentação
  is_auto BOOLEAN DEFAULT false, -- Se aplica critérios automaticamente
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, name)
);

-- Relacionamento cliente-segmento
CREATE TABLE customer_segment_members (
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES customer_segments(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by UUID REFERENCES nexus_auth.users(id),
  
  PRIMARY KEY (customer_id, segment_id)
);

-- Notas dos clientes
CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'GENERAL', -- GENERAL, IMPORTANT, REMINDER, FOLLOW_UP, COMPLAINT, COMPLIMENT
  is_private BOOLEAN DEFAULT false, -- Only creator can see
  created_by UUID NOT NULL, -- User ID who created
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Estatísticas de clientes (para analytics)
CREATE TABLE customer_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL,
  total_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  prospect_customers INTEGER DEFAULT 0,
  total_interactions INTEGER DEFAULT 0,
  total_notes INTEGER DEFAULT 0,
  average_interactions DECIMAL(10,2) DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_customers_company_status ON customers(company_id, status);
CREATE INDEX idx_customers_company_name ON customers(company_id, name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_cpf ON customers(cpf_cnpj);
CREATE INDEX idx_customers_birth_date ON customers(birth_date) WHERE birth_date IS NOT NULL;
CREATE INDEX idx_interactions_customer_date ON customer_interactions(customer_id, created_at DESC);
CREATE INDEX idx_interactions_company_type ON customer_interactions(company_id, type);
CREATE INDEX idx_custom_values_customer ON customer_custom_values(customer_id);
```

## 🔗 APIs REST Detalhadas

### **Base URL:** `http://localhost:5004/api`

### **Endpoints de Clientes**

#### `GET /crm/customers`
**Descrição:** Lista clientes com filtros e busca

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Query Parameters:**
- `page=1` - Página (padrão: 1)
- `limit=20` - Registros por página (padrão: 20)
- `search=joão` - Busca por nome, email, telefone, CPF
- `status=active` - Filtro por status
- `tags[]=VIP&tags[]=Fidelizado` - Filtro por tags
- `segment_id=uuid` - Filtro por segmento
- `sort=name` - Ordenação (name, created_at, last_visit)
- `order=asc` - Direção (asc, desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "customer-uuid",
        "name": "Maria Silva Santos",
        "email": "maria@email.com",
        "phone": "+5511999999999", 
        "cpf_cnpj": "123.456.789-00",
        "status": "active",
        "tags": ["VIP", "Fidelizada"],
        "birth_date": "1985-05-15",
        "first_visit": "2024-01-15",
        "last_visit": "2024-08-20",
        "total_visits": 12,
        "total_spent": 1850.00,
        "average_ticket": 154.17,
        "avatar_url": "https://...",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20, 
      "total": 150,
      "pages": 8
    },
    "filters": {
      "total_active": 140,
      "total_inactive": 10,
      "segments": [
        {"id": "segment-1", "name": "VIP", "count": 25},
        {"id": "segment-2", "name": "Novos", "count": 30}
      ]
    }
  }
}
```

#### `GET /crm/customers/:id`
**Descrição:** Detalhes completos de um cliente

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "customer-uuid",
      "name": "Maria Silva Santos",
      "email": "maria@email.com",
      "phone": "+5511999999999",
      "secondary_phone": "+5511888888888",
      "cpf_cnpj": "123.456.789-00",
      "rg": "12.345.678-9",
      
      "address": {
        "street": "Rua das Flores", 
        "number": "123",
        "complement": "Apto 45",
        "neighborhood": "Centro",
        "city": "São Paulo",
        "state": "SP",
        "zipcode": "01234-567"
      },
      
      "demographics": {
        "birth_date": "1985-05-15",
        "age": 39,
        "gender": "F",
        "marital_status": "married",
        "profession": "Dentista"
      },
      
      "relationship": {
        "status": "active",
        "source": "referral",
        "tags": ["VIP", "Fidelizada"],
        "first_visit": "2024-01-15",
        "last_visit": "2024-08-20",
        "total_visits": 12,
        "total_spent": 1850.00,
        "average_ticket": 154.17,
        "preferred_contact": "whatsapp",
        "marketing_consent": true
      },
      
      "custom_fields": [
        {
          "field_name": "Tipo de Pele",
          "field_type": "select",
          "value": "Oleosa"
        },
        {
          "field_name": "Alergia",
          "field_type": "text", 
          "value": "Níquel"
        }
      ],
      
      "notes": "Cliente muito pontual, prefere horários matutinos.",
      "avatar_url": "https://...",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-08-20T14:20:00Z"
    },
    
    "recent_interactions": [
      {
        "id": "interaction-uuid",
        "type": "service",
        "subject": "Limpeza de Pele Profunda",
        "description": "Procedimento realizado sem intercorrências. Cliente satisfeita.",
        "created_at": "2024-08-20T10:00:00Z",
        "created_by": "Dr. Ana Costa"
      }
    ],
    
    "upcoming_appointments": [
      {
        "id": "appointment-uuid",
        "service": "Hidratação Facial",
        "professional": "Dr. Ana Costa", 
        "date": "2024-08-27",
        "time": "10:00"
      }
    ]
  }
}
```

#### `POST /crm/customers`
**Descrição:** Criar novo cliente

**Request:**
```json
{
  "name": "João Santos",
  "email": "joao@email.com",
  "phone": "+5511999999999",
  "cpf_cnpj": "987.654.321-00",
  "birth_date": "1990-10-20",
  "gender": "M",
  "address": {
    "street": "Av. Paulista",
    "number": "1000",
    "city": "São Paulo",
    "state": "SP",
    "zipcode": "01310-100"
  },
  "source": "website",
  "tags": ["Novo"],
  "custom_fields": [
    {
      "field_id": "custom-field-uuid",
      "value": "Pele Sensível"
    }
  ],
  "marketing_consent": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "new-customer-uuid",
      "name": "João Santos",
      "email": "joao@email.com",
      // ... demais campos
      "created_at": "2024-08-23T15:30:00Z"
    }
  },
  "message": "Cliente criado com sucesso"
}
```

#### `PUT /crm/customers/:id`
**Descrição:** Atualizar cliente existente

#### `DELETE /crm/customers/:id`
**Descrição:** Remover cliente (soft delete)

### **Endpoints de Interações**

#### `GET /crm/customers/:id/interactions`
**Descrição:** Histórico completo de interações com cliente

**Query Parameters:**
- `type=service` - Filtro por tipo
- `limit=50` - Registros por página

**Response (200):**
```json
{
  "success": true,
  "data": {
    "interactions": [
      {
        "id": "interaction-uuid",
        "type": "service",
        "subject": "Limpeza de Pele",
        "description": "Procedimento realizado com sucesso. Pele apresentou boa resposta.",
        "status": "completed",
        "metadata": {
          "service_id": "service-uuid",
          "professional": "Dr. Ana Costa",
          "duration_minutes": 60,
          "photos": ["before.jpg", "after.jpg"]
        },
        "created_by": "user-uuid",
        "created_by_name": "Dr. Ana Costa",
        "created_at": "2024-08-20T10:00:00Z"
      },
      {
        "id": "interaction-uuid-2",
        "type": "phone_call",
        "subject": "Agendamento de Retorno",
        "description": "Cliente solicitou agendamento para próxima semana.",
        "direction": "inbound",
        "status": "completed",
        "metadata": {
          "phone": "+5511999999999",
          "duration": 180
        },
        "created_by": "user-uuid",
        "created_by_name": "Maria Recepcionista",
        "created_at": "2024-08-18T14:30:00Z"
      }
    ],
    "summary": {
      "total_interactions": 25,
      "types": {
        "service": 12,
        "phone_call": 8,
        "whatsapp": 5
      },
      "last_interaction": "2024-08-20T10:00:00Z"
    }
  }
}
```

#### `POST /crm/customers/:id/interactions`
**Descrição:** Registrar nova interação com cliente

**Request:**
```json
{
  "type": "phone_call",
  "subject": "Cliente solicitou informações sobre tratamento",
  "description": "Interessada em peeling químico. Explicou procedimento e valores.",
  "direction": "inbound",
  "status": "completed",
  "metadata": {
    "phone": "+5511999999999",
    "duration": 300
  }
}
```

### **Endpoints de Segmentação**

#### `GET /crm/segments`
**Descrição:** Lista segmentos de clientes

#### `POST /crm/segments`
**Descrição:** Criar novo segmento

#### `PUT /crm/customers/:id/segments`
**Descrição:** Atualizar segmentos do cliente

### **Endpoints para Outros Módulos**

#### `GET /crm/customers/:id/basic` [INTERNAL]
**Descrição:** Dados básicos do cliente (para Agendamento/Services)

**Response (200):**
```json
{
  "id": "customer-uuid",
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "+5511999999999",
  "preferred_contact": "whatsapp"
}
```

#### `POST /crm/customers/:id/visit` [INTERNAL]
**Descrição:** Atualizar dados de visita (chamado pelo Services)

**Request:**
```json
{
  "visit_date": "2024-08-23",
  "service_value": 150.00
}
```

## 🎨 Frontend Components

### **Páginas React**
| Componente | Rota | Descrição | Acesso |
|:----------|:-----|:----------|:-------|
| `CustomersPage` | `/customers` | Lista de clientes | CRM read |
| `CustomerDetailPage` | `/customers/:id` | Detalhes do cliente | CRM read |
| `CustomerCreatePage` | `/customers/new` | Criar cliente | CRM write |
| `CustomerEditPage` | `/customers/:id/edit` | Editar cliente | CRM write |
| `CustomerInteractionsPage` | `/customers/:id/interactions` | Histórico | CRM read |

### **Componentes Base (usando Biblioteca_visual.tsx)**

#### `CustomerTable.tsx`
```tsx
import { DataTable, Button, KPICard } from '@/shared/components/ui';
import { Users, UserCheck, Calendar, DollarSign } from 'lucide-react';

const columns = [
  { 
    key: 'name', 
    label: 'Nome',
    render: (value: string, customer: Customer) => (
      <div className="flex items-center gap-3">
        <img 
          src={customer.avatar_url || '/default-avatar.png'} 
          className="w-8 h-8 rounded-full"
        />
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-textSecondary">{customer.email}</div>
        </div>
      </div>
    )
  },
  { key: 'phone', label: 'Telefone' },
  { 
    key: 'tags', 
    label: 'Tags',
    render: (tags: string[]) => (
      <div className="flex gap-1 flex-wrap">
        {tags.map(tag => (
          <span key={tag} className="px-2 py-1 bg-accent text-white text-xs rounded">
            {tag}
          </span>
        ))}
      </div>
    )
  },
  { 
    key: 'last_visit', 
    label: 'Última Visita',
    render: (date: string) => date ? new Date(date).toLocaleDateString() : 'Nunca'
  },
  { 
    key: 'total_spent', 
    label: 'Total Gasto',
    render: (value: number) => `R$ ${value.toFixed(2)}`
  }
];

export const CustomerTable = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Total Clientes"
          value="150"
          change={5}
          trend="up"
          icon={Users}
        />
        <KPICard
          title="Clientes Ativos"
          value="142"
          change={2}
          trend="up"
          icon={UserCheck}
        />
        <KPICard
          title="Novos (Mês)"
          value="23"
          change={15}
          trend="up"
          icon={Calendar}
        />
        <KPICard
          title="Ticket Médio"
          value="R$ 185"
          change={-3}
          trend="down"
          icon={DollarSign}
        />
      </div>

      {/* Tabela */}
      <DataTable
        data={customers}
        columns={columns}
        loading={loading}
        onView={(customer) => router.push(`/customers/${customer.id}`)}
        onEdit={(customer) => router.push(`/customers/${customer.id}/edit`)}
        onDelete={handleDeleteCustomer}
        searchPlaceholder="Buscar cliente por nome, email ou telefone..."
        exportButton={true}
        exportFilename="clientes.csv"
      />
    </div>
  );
};
```

#### `CustomerForm.tsx`
```tsx
import { Input, Select, Button, Alert } from '@/shared/components/ui';

export const CustomerForm = ({ customer, onSubmit, loading }) => {
  const [formData, setFormData] = useState(customer || {});
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      await onSubmit(formData);
      toast.success('Cliente salvo com sucesso!');
    } catch (error) {
      setErrors(error.validationErrors || {});
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Dados Básicos</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome Completo"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            error={errors.name}
            required
          />
          
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            error={errors.email}
          />
          
          <Input
            label="Telefone"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            error={errors.phone}
            required
          />
          
          <Input
            label="CPF"
            value={formData.cpf_cnpj}
            onChange={(e) => setFormData({...formData, cpf_cnpj: e.target.value})}
            error={errors.cpf_cnpj}
          />
          
          <Input
            label="Data de Nascimento"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
          />
          
          <Select
            label="Sexo"
            value={formData.gender}
            onChange={(e) => setFormData({...formData, gender: e.target.value})}
            options={[
              { value: 'M', label: 'Masculino' },
              { value: 'F', label: 'Feminino' },
              { value: 'Other', label: 'Outro' }
            ]}
          />
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Endereço</h3>
        {/* Campos de endereço... */}
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-4">
        <Button 
          variant="secondary" 
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button 
          type="submit"
          variant="primary"
          loading={loading}
        >
          {customer?.id ? 'Atualizar' : 'Criar'} Cliente
        </Button>
      </div>
    </form>
  );
};
```

## 🧪 Testes Essenciais

### **Testes de Integração**
```typescript
describe('CRM Module Integration', () => {
  describe('POST /crm/customers', () => {
    it('should create customer successfully', async () => {
      const customerData = {
        name: 'João Test',
        email: 'joao@test.com',
        phone: '+5511999999999'
      };

      const response = await request(app)
        .post('/api/crm/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(customerData);

      expect(response.status).toBe(201);
      expect(response.body.data.customer.name).toBe('João Test');
    });

    it('should not allow duplicate email in same company', async () => {
      // Criar primeiro cliente
      await createCustomer('joao@test.com');
      
      // Tentar criar segundo com mesmo email
      const response = await request(app)
        .post('/api/crm/customers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'João Duplicate',
          email: 'joao@test.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('Multi-tenant isolation', () => {
    it('should only return customers from user company', async () => {
      const company1Token = await getCompanyToken('company1');
      const company2Token = await getCompanyToken('company2');
      
      // Criar cliente na company1
      await createCustomerForCompany('company1', 'cliente1@test.com');
      
      // Buscar com token da company2
      const response = await request(app)
        .get('/api/crm/customers')
        .set('Authorization', `Bearer ${company2Token}`);
      
      expect(response.body.data.customers).toHaveLength(0);
    });
  });
});
```

## 🐳 Deploy e Configuração

### **Docker Configuration**
```yaml
# docker-compose.yml
nexus-crm:
  build: ./modules/crm
  ports:
    - "5004:3000"
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://nexus_crm_user:password@postgres:5432/nexus_erp?schema=nexus_crm
    - USER_MANAGEMENT_URL=http://nexus-user-management:5000
    - REDIS_URL=redis://redis:6379/1
    - FILE_UPLOAD_PATH=/uploads/customers
  volumes:
    - customer_uploads:/uploads/customers
  depends_on:
    - postgres
    - redis
    - nexus-user-management
  networks:
    - nexus-network
```

## 🔧 Integrações com Outros Módulos

### **Com User Management**
```typescript
// Middleware de autenticação para todas as rotas
app.use('/api/crm', authMiddleware);
app.use('/api/crm', requirePermission('CRM', 'read'));
```

### **Com Services Module**
```typescript
// Services chama CRM para buscar dados do cliente
export const getCustomerForService = async (customerId: string) => {
  const response = await fetch(`http://nexus-crm:5000/api/crm/customers/${customerId}/basic`);
  return response.json();
};

// CRM recebe callback quando atendimento é realizado
export const updateCustomerVisit = async (customerId: string, visitData: VisitData) => {
  await Customer.update(customerId, {
    last_visit: visitData.date,
    total_visits: { increment: 1 },
    total_spent: { increment: visitData.value }
  });
};
```

### **Com Agendamento Module**
```typescript
// Agendamento busca dados básicos do cliente
app.get('/api/agendamento/customers/search', async (req, res) => {
  const response = await fetch(`http://nexus-crm:5000/api/crm/customers?search=${req.query.q}`);
  const customers = await response.json();
  
  // Retorna apenas dados necessários para agendamento
  res.json(customers.data.customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email
  })));
});
```

## 📝 Próximos Passos

### **Fase 1 - CRUD Básico (Semana 3)**
- [ ] Setup schema nexus_crm
- [ ] CRUD completo de clientes
- [ ] Busca e filtros básicos
- [ ] Frontend lista e formulário

### **Fase 2 - Funcionalidades Avançadas (Semana 4)**  
- [ ] Sistema de tags/segmentação
- [ ] Histórico de interações
- [ ] Campos customizados
- [ ] Upload de avatar

### **Fase 3 - Integração (Semana 5)**
- [ ] APIs para Services e Agendamento
- [ ] Callback de atendimentos realizados
- [ ] Dashboard com KPIs
- [ ] Relatórios básicos