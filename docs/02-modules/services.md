# Módulo Services - Nexus ERP

**Responsabilidade Central:** Gestão de serviços, profissionais e registro completo de atendimentos realizados com controle financeiro básico.

## 🎯 Objetivo do Módulo

### **Função Principal:**
Gerenciar o **catálogo de serviços**, **equipe de profissionais** e **registro detalhado dos atendimentos** realizados, servindo como ponte entre agendamento e realização, com controle básico de pagamentos.

### **Problemas que Resolve:**
- ✅ **Catálogo Organizado:** Todos os serviços com preços e durações definidas
- ✅ **Gestão de Equipe:** Profissionais com especialidades e horários
- ✅ **Registro de Atendimento:** Documentação do que foi realizado + fotos
- ✅ **Controle Financeiro:** Pagamentos registrados e relatórios diários
- ✅ **Histórico Profissional:** Evolução do cliente documentada

## 📊 Funcionalidades Detalhadas

### **Prioridade CRÍTICA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **CRUD Serviços** | Cadastro de procedimentos com preço/duração | Baixa | 2 dias |
| **CRUD Profissionais** | Cadastro de equipe com especialidades | Baixa | 2 dias |
| **Registro de Atendimento** | Documentar atendimento realizado | Média | 4 dias |
| **Integração CRM** | Buscar dados do cliente | Média | 2 dias |

### **Prioridade ALTA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Histórico por Cliente** | Timeline de todos os atendimentos | Média | 3 dias |
| **Agenda por Profissional** | Calendário individual de cada um | Alta | 4 dias |
| **Controle de Pagamentos** | Status e forma de pagamento | Média | 3 dias |
| **Upload de Fotos** | Antes/depois dos procedimentos | Média | 3 days |

### **Prioridade MÉDIA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Relatórios Diários** | Atendimentos + faturamento | Média | 3 dias |
| **Performance Profissional** | Estatísticas por profissional | Média | 3 dias |
| **Comissões** | Cálculo de comissão por atendimento | Alta | 4 dias |
| **Templates de Observações** | Textos padrão para procedimentos | Baixa | 2 dias |

### **Prioridade BAIXA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Assinatura Digital** | Cliente assina termo de consentimento | Alta | 5 dias |
| **Integração Estoque** | Produtos usados no procedimento | Média | 3 dias |
| **Avaliação do Cliente** | Rating do atendimento | Baixa | 2 dias |

## 🗄️ Database Schema

### **Schema: `nexus_services`**

```sql
-- Catálogo de serviços/procedimentos
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, -- Multi-tenant
  
  -- Dados básicos
  name VARCHAR(255) NOT NULL, -- "Limpeza de Pele Profunda"
  description TEXT,
  category VARCHAR(100), -- "Estética Facial", "Capilar", "Corporal"
  
  -- Configurações do serviço
  duration_minutes INTEGER NOT NULL, -- 60
  price DECIMAL(10,2), -- 150.00
  price_max DECIMAL(10,2), -- 200.00 (para faixa de preço)
  
  -- Configurações avançadas
  requires_preparation BOOLEAN DEFAULT false,
  preparation_notes TEXT, -- "Cliente deve estar em jejum"
  aftercare_notes TEXT, -- "Evitar exposição solar por 7 dias"
  
  -- Restrições
  age_min INTEGER, -- 18
  age_max INTEGER, -- 65
  contraindications TEXT[], -- ["gravidez", "lactação", "pele lesionada"]
  
  -- Configurações de agendamento
  allow_online_booking BOOLEAN DEFAULT true,
  advance_booking_days INTEGER DEFAULT 1, -- Mínimo 1 dia de antecedência
  max_booking_days INTEGER DEFAULT 60, -- Máximo 60 dias no futuro
  
  -- Status
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profissionais/especialistas
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Dados pessoais
  user_id UUID, -- Referência para nexus_auth.users (se profissional usar sistema)
  name VARCHAR(255) NOT NULL,
  professional_registration VARCHAR(100), -- CRO, CRM, etc.
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Profissionais
  specialties TEXT[], -- ["estética facial", "peeling", "botox"]
  bio TEXT, -- Biografia/apresentação
  photo_url TEXT,
  
  -- Configurações de trabalho
  work_schedule JSONB, -- {"monday": {"start": "08:00", "end": "18:00", "lunch": {"start": "12:00", "end": "13:00"}}}
  break_between_services INTEGER DEFAULT 15, -- Minutos entre atendimentos
  allow_online_booking BOOLEAN DEFAULT true,
  
  -- Configurações financeiras
  commission_type VARCHAR(20) DEFAULT 'percentage', -- percentage, fixed
  commission_value DECIMAL(5,2), -- 30.00 (30% ou R$ 30,00)
  
  -- Status
  active BOOLEAN DEFAULT true,
  available_for_new_appointments BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Relacionamento profissional-serviço (quem pode fazer o quê)
CREATE TABLE professional_services (
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  can_perform BOOLEAN DEFAULT true,
  custom_price DECIMAL(10,2), -- Preço específico deste profissional para este serviço
  notes TEXT, -- Observações específicas
  created_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (professional_id, service_id)
);

-- Atendimentos realizados (core do módulo)
CREATE TABLE appointments_completed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Referências
  customer_id UUID NOT NULL, -- Referência para nexus_crm.customers
  professional_id UUID REFERENCES professionals(id),
  service_id UUID REFERENCES services(id),
  appointment_id UUID, -- Referência para nexus_agendamento.appointments (se veio de agendamento)
  
  -- Dados do atendimento
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  actual_start_time TIME,
  actual_end_time TIME,
  actual_duration_minutes INTEGER,
  
  -- Status do atendimento
  status VARCHAR(20) DEFAULT 'completed', -- completed, cancelled, no_show, in_progress
  
  -- Observações técnicas
  pre_procedure_notes TEXT, -- Estado inicial do cliente
  procedure_notes TEXT, -- O que foi realizado
  post_procedure_notes TEXT, -- Orientações pós-procedimento
  client_satisfaction INTEGER, -- 1-5 (se preenchido)
  
  -- Fotos do procedimento
  photos_before TEXT[], -- URLs das fotos antes
  photos_after TEXT[], -- URLs das fotos depois
  photos_during TEXT[], -- URLs das fotos durante (opcional)
  
  -- Dados financeiros
  service_price DECIMAL(10,2) NOT NULL, -- Preço cobrado
  discount_percentage DECIMAL(5,2) DEFAULT 0, -- 10.50 = 10.5%
  discount_amount DECIMAL(10,2) DEFAULT 0, -- R$ 20,00
  final_amount DECIMAL(10,2) NOT NULL, -- Valor final após desconto
  
  -- Pagamento
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, partial, cancelled
  payment_method VARCHAR(50), -- cash, credit_card, debit_card, pix, bank_transfer
  payment_date DATE,
  payment_notes TEXT,
  
  -- Próximos agendamentos sugeridos
  next_appointment_suggested DATE,
  next_appointment_notes TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Índices para performance
  INDEX idx_appointments_company_date (company_id, appointment_date DESC),
  INDEX idx_appointments_customer (customer_id, appointment_date DESC),
  INDEX idx_appointments_professional_date (professional_id, appointment_date DESC)
);

-- Relacionamento profissional-serviço (N:N)
CREATE TABLE professional_services (
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  can_perform BOOLEAN DEFAULT true,
  custom_price DECIMAL(10,2), -- Preço específico deste profissional para este serviço
  notes TEXT, -- Observações específicas
  created_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (professional_id, service_id)
);

-- Produtos/materiais usados no atendimento
CREATE TABLE appointment_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments_completed(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  service_id UUID REFERENCES services(id), -- Serviço ao qual o material pertence
  material_name VARCHAR(255) NOT NULL,
  quantity_used DECIMAL(10,3) NOT NULL, -- 2.5ml, 1 unidade, etc.
  unit VARCHAR(20) NOT NULL, -- ml, g, unidade, etc.
  cost DECIMAL(10,2), -- Custo do material usado
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Templates de observações rápidas para procedimentos
CREATE TABLE procedure_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  service_id UUID REFERENCES services(id), -- Template específico para um serviço
  template_name VARCHAR(100) NOT NULL, -- "Limpeza Padrão", "Primeira Sessão"
  template_type VARCHAR(20) NOT NULL, -- PRE_PROCEDURE, PROCEDURE, POST_PROCEDURE, GENERAL
  template_text TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0, -- Quantas vezes foi usado
  created_by UUID, -- Usuário que criou o template
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Fotos dos atendimentos (antes/depois)
CREATE TABLE service_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments_completed(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL, -- BEFORE, AFTER, DURING, DOCUMENTATION
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NOT NULL,
  filesize INTEGER NOT NULL, -- File size in bytes
  mime_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Estatísticas de serviços (para analytics/reports)
CREATE TABLE service_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL,
  total_services INTEGER DEFAULT 0,
  active_services INTEGER DEFAULT 0,
  total_professionals INTEGER DEFAULT 0,
  active_professionals INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  completed_appointments INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  average_ticket DECIMAL(10,2) DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT NOW()
);

-- Índices adicionais para performance
CREATE INDEX idx_services_company_active ON services(company_id, active);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_professionals_company_active ON professionals(company_id, active);
CREATE INDEX idx_professional_services_professional ON professional_services(professional_id);
CREATE INDEX idx_appointments_payment_status ON appointments_completed(payment_status);
CREATE INDEX idx_appointments_date_range ON appointments_completed(appointment_date, appointment_time);
```

## 🔗 APIs REST Detalhadas

### **Base URL:** `http://localhost:5003/api`

### **Endpoints de Serviços**

#### `GET /services`
**Descrição:** Lista serviços da empresa

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Query Parameters:**
- `category=estética` - Filtro por categoria
- `active=true` - Apenas serviços ativos
- `professional_id=uuid` - Serviços que o profissional pode realizar

**Response (200):**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "service-uuid",
        "name": "Limpeza de Pele Profunda",
        "description": "Procedimento completo de limpeza com extração e hidratação",
        "category": "Estética Facial",
        "duration_minutes": 60,
        "price": 150.00,
        "price_max": 180.00,
        "active": true,
        "contraindications": ["gravidez", "pele lesionada"],
        "aftercare_notes": "Evitar exposição solar por 24h",
        "professionals_count": 3
      }
    ],
    "categories": ["Estética Facial", "Estética Corporal", "Capilar"],
    "total": 25
  }
}
```

#### `POST /services`
**Descrição:** Criar novo serviço

**Request:**
```json
{
  "name": "Peeling Químico",
  "description": "Renovação celular com ácidos",
  "category": "Estética Facial",
  "duration_minutes": 45,
  "price": 200.00,
  "contraindications": ["gravidez", "lactação", "uso de ácidos"],
  "aftercare_notes": "Usar protetor solar fator 60+. Não exposição solar por 7 dias.",
  "requires_preparation": true,
  "preparation_notes": "Suspender uso de ácidos 7 dias antes"
}
```

#### `PUT /services/:id`
**Descrição:** Atualizar serviço

#### `DELETE /services/:id`
**Descrição:** Desativar serviço

### **Endpoints de Profissionais**

#### `GET /professionals`
**Descrição:** Lista profissionais da empresa

**Response (200):**
```json
{
  "success": true,
  "data": {
    "professionals": [
      {
        "id": "prof-uuid",
        "name": "Dr. Ana Costa",
        "professional_registration": "CRO-SP 12345",
        "email": "ana@clinica.com",
        "phone": "+5511999999999",
        "specialties": ["estética facial", "peeling", "microagulhamento"],
        "photo_url": "https://...",
        "active": true,
        "available_for_new_appointments": true,
        "work_schedule": {
          "monday": {"start": "08:00", "end": "18:00"},
          "tuesday": {"start": "08:00", "end": "18:00"}
        },
        "services_count": 15,
        "appointments_this_month": 45
      }
    ]
  }
}
```

#### `POST /professionals`
**Descrição:** Cadastrar novo profissional

**Request:**
```json
{
  "name": "Dr. Carlos Silva",
  "professional_registration": "CRM-SP 54321",
  "email": "carlos@clinica.com",
  "phone": "+5511888888888",
  "specialties": ["dermatologia", "estética"],
  "bio": "Especialista em dermatologia estética com 10 anos de experiência",
  "work_schedule": {
    "monday": {"start": "09:00", "end": "17:00", "lunch": {"start": "12:00", "end": "13:00"}},
    "tuesday": {"start": "09:00", "end": "17:00"}
  },
  "commission_type": "percentage",
  "commission_value": 40.00
}
```

#### `GET /professionals/:id/services`
**Descrição:** Serviços que o profissional pode realizar

#### `PUT /professionals/:id/services`
**Descrição:** Atualizar serviços do profissional

### **Endpoints de Atendimentos**

#### `POST /appointments/complete`
**Descrição:** Registrar atendimento realizado

**Request:**
```json
{
  "customer_id": "customer-uuid",
  "professional_id": "prof-uuid", 
  "service_id": "service-uuid",
  "appointment_id": "appointment-uuid", // Opcional, se veio de agendamento
  
  "appointment_date": "2024-08-23",
  "appointment_time": "10:00",
  "actual_start_time": "10:05",
  "actual_end_time": "11:10",
  
  "pre_procedure_notes": "Cliente com pele oleosa, alguns comedões na zona T",
  "procedure_notes": "Realizada limpeza profunda com vapor, extração manual e aplicação de máscara calmante. Cliente tolerou bem o procedimento.",
  "post_procedure_notes": "Orientada sobre cuidados pós-procedimento. Recomendado retorno em 30 dias.",
  
  "photos_before": ["photo1.jpg", "photo2.jpg"],
  "photos_after": ["photo3.jpg", "photo4.jpg"],
  
  "service_price": 150.00,
  "discount_percentage": 10.00,
  "final_amount": 135.00,
  "payment_status": "paid",
  "payment_method": "pix",
  
  "next_appointment_suggested": "2024-09-23",
  "next_appointment_notes": "Manutenção da limpeza",
  
  "client_satisfaction": 5
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "appointment-completed-uuid",
      "customer": {
        "id": "customer-uuid",
        "name": "Maria Silva",
        "phone": "+5511999999999"
      },
      "professional": {
        "id": "prof-uuid", 
        "name": "Dr. Ana Costa"
      },
      "service": {
        "id": "service-uuid",
        "name": "Limpeza de Pele Profunda"
      },
      "appointment_date": "2024-08-23",
      "final_amount": 135.00,
      "payment_status": "paid",
      "created_at": "2024-08-23T11:15:00Z"
    }
  },
  "message": "Atendimento registrado com sucesso"
}
```

#### `GET /appointments/completed`
**Descrição:** Lista atendimentos realizados

**Query Parameters:**
- `date_from=2024-08-01` - Data inicial
- `date_to=2024-08-31` - Data final
- `professional_id=uuid` - Filtro por profissional
- `customer_id=uuid` - Filtro por cliente
- `payment_status=pending` - Filtro por status pagamento
- `service_id=uuid` - Filtro por serviço

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "appointment-uuid",
        "customer_name": "Maria Silva",
        "professional_name": "Dr. Ana Costa", 
        "service_name": "Limpeza de Pele",
        "appointment_date": "2024-08-23",
        "appointment_time": "10:00",
        "final_amount": 135.00,
        "payment_status": "paid",
        "payment_method": "pix",
        "client_satisfaction": 5
      }
    ],
    "pagination": {...},
    "summary": {
      "total_appointments": 156,
      "total_revenue": 23480.00,
      "average_ticket": 150.51,
      "payment_pending": 2340.00
    }
  }
}
```

#### `GET /appointments/completed/:id`
**Descrição:** Detalhes completos do atendimento

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "appointment-uuid",
      "customer": {
        "id": "customer-uuid",
        "name": "Maria Silva Santos", 
        "phone": "+5511999999999",
        "email": "maria@email.com"
      },
      "professional": {
        "id": "prof-uuid",
        "name": "Dr. Ana Costa",
        "registration": "CRO-SP 12345"
      },
      "service": {
        "id": "service-uuid", 
        "name": "Limpeza de Pele Profunda",
        "category": "Estética Facial"
      },
      "appointment_date": "2024-08-23",
      "appointment_time": "10:00",
      "actual_duration_minutes": 65,
      
      "procedure_details": {
        "pre_procedure_notes": "...",
        "procedure_notes": "...",
        "post_procedure_notes": "..."
      },
      
      "photos": {
        "before": [
          {"url": "https://...", "uploaded_at": "..."},
          {"url": "https://...", "uploaded_at": "..."}
        ],
        "after": [
          {"url": "https://...", "uploaded_at": "..."}
        ]
      },
      
      "financial": {
        "service_price": 150.00,
        "discount_percentage": 10.00,
        "discount_amount": 15.00,
        "final_amount": 135.00,
        "payment_status": "paid",
        "payment_method": "pix",
        "payment_date": "2024-08-23"
      },
      
      "follow_up": {
        "next_appointment_suggested": "2024-09-23",
        "next_appointment_notes": "Manutenção da limpeza",
        "client_satisfaction": 5
      },
      
      "created_by": "user-uuid",
      "created_at": "2024-08-23T11:15:00Z"
    }
  }
}
```

### **Endpoints de Relatórios**

#### `GET /reports/daily`
**Descrição:** Relatório diário de atendimentos e faturamento

**Query Parameters:**
- `date=2024-08-23` - Data específica (padrão: hoje)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "date": "2024-08-23",
    "summary": {
      "total_appointments": 12,
      "total_revenue": 1850.00,
      "average_ticket": 154.17,
      "payment_received": 1620.00,
      "payment_pending": 230.00
    },
    
    "by_professional": [
      {
        "professional_id": "prof-uuid",
        "professional_name": "Dr. Ana Costa",
        "appointments_count": 7,
        "revenue": 1200.00,
        "commission_earned": 480.00
      }
    ],
    
    "by_service": [
      {
        "service_id": "service-uuid",
        "service_name": "Limpeza de Pele",
        "appointments_count": 5,
        "revenue": 750.00
      }
    ],
    
    "by_payment_method": {
      "pix": 800.00,
      "credit_card": 650.00,
      "cash": 170.00,
      "pending": 230.00
    },
    
    "appointments": [
      {
        "time": "09:00",
        "customer_name": "Maria Silva",
        "professional_name": "Dr. Ana Costa",
        "service_name": "Limpeza de Pele",
        "amount": 135.00,
        "payment_status": "paid"
      }
    ]
  }
}
```

#### `GET /reports/professional/:id`
**Descrição:** Relatório de performance do profissional

### **Endpoints para Outros Módulos**

#### `GET /services/list` [INTERNAL]
**Descrição:** Lista simples de serviços para Agendamento

**Response (200):**
```json
{
  "services": [
    {
      "id": "service-uuid",
      "name": "Limpeza de Pele",
      "duration_minutes": 60,
      "price": 150.00,
      "category": "Estética Facial"
    }
  ]
}
```

#### `GET /professionals/list` [INTERNAL] 
**Descrição:** Lista profissionais disponíveis para Agendamento

**Response (200):**
```json
{
  "professionals": [
    {
      "id": "prof-uuid",
      "name": "Dr. Ana Costa",
      "specialties": ["estética facial"],
      "available_for_booking": true
    }
  ]
}
```

#### `GET /professionals/:id/availability` [INTERNAL]
**Descrição:** Horários disponíveis do profissional

**Query Parameters:**
- `date=2024-08-23` - Data para verificar disponibilidade
- `service_id=uuid` - Serviço que será agendado

## 🎨 Frontend Components

### **Páginas React**
| Componente | Rota | Descrição | Acesso |
|:----------|:-----|:----------|:-------|
| `ServicesPage` | `/services` | Catálogo de serviços | SERVICES read |
| `ServiceCreatePage` | `/services/new` | Criar serviço | SERVICES write |
| `ProfessionalsPage` | `/professionals` | Gestão de profissionais | SERVICES read |
| `ProfessionalDetailPage` | `/professionals/:id` | Detalhes + agenda | SERVICES read |
| `AppointmentCompletePage` | `/appointments/complete` | Registrar atendimento | SERVICES write |
| `AppointmentsPage` | `/appointments` | Lista atendimentos | SERVICES read |
| `ReportsPage` | `/reports` | Relatórios e dashboards | SERVICES read |

### **Componentes Base**

#### `ServiceCatalog.tsx`
```tsx
import { DataTable, Button, KPICard } from '@/shared/components/ui';
import { Scissors, Clock, DollarSign, Users } from 'lucide-react';

const columns = [
  { 
    key: 'name', 
    label: 'Serviço',
    render: (value: string, service: Service) => (
      <div>
        <div className="font-medium">{value}</div>
        <div className="text-sm text-textSecondary">{service.category}</div>
      </div>
    )
  },
  { 
    key: 'duration_minutes', 
    label: 'Duração',
    render: (minutes: number) => `${minutes} min`
  },
  { 
    key: 'price', 
    label: 'Preço',
    render: (price: number, service: Service) => 
      service.price_max 
        ? `R$ ${price.toFixed(2)} - R$ ${service.price_max.toFixed(2)}`
        : `R$ ${price.toFixed(2)}`
  },
  { 
    key: 'professionals_count', 
    label: 'Profissionais',
    render: (count: number) => `${count} disponível${count !== 1 ? 'eis' : ''}`
  }
];

export const ServiceCatalog = () => {
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({});

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Total Serviços"
          value={stats.total_services}
          icon={Scissors}
        />
        <KPICard
          title="Duração Média"
          value={`${stats.avg_duration} min`}
          icon={Clock}
        />
        <KPICard
          title="Ticket Médio"
          value={`R$ ${stats.avg_price}`}
          icon={DollarSign}
        />
        <KPICard
          title="Profissionais"
          value={stats.total_professionals}
          icon={Users}
        />
      </div>

      {/* Tabela */}
      <DataTable
        data={services}
        columns={columns}
        onView={(service) => router.push(`/services/${service.id}`)}
        onEdit={(service) => router.push(`/services/${service.id}/edit`)}
        searchPlaceholder="Buscar serviço..."
      />
    </div>
  );
};
```

#### `AppointmentCompleteForm.tsx`
```tsx
import { Input, Select, Button, Alert, Modal } from '@/shared/components/ui';
import { Upload, Camera } from 'lucide-react';

export const AppointmentCompleteForm = () => {
  const [formData, setFormData] = useState({
    customer_id: '',
    professional_id: '',
    service_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '',
    // ... outros campos
  });
  
  const [photosBefore, setPhotosBefore] = useState([]);
  const [photosAfter, setPhotosAfter] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = async (files: FileList, type: 'before' | 'after') => {
    // Implementar upload de fotos
    const uploadPromises = Array.from(files).map(file => uploadPhoto(file));
    const urls = await Promise.all(uploadPromises);
    
    if (type === 'before') {
      setPhotosBefore([...photosBefore, ...urls]);
    } else {
      setPhotosAfter([...photosAfter, ...urls]);
    }
  };

  return (
    <form className="space-y-8 max-w-4xl mx-auto">
      {/* Dados básicos */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Dados do Atendimento</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Cliente"
            value={formData.customer_id}
            onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
            options={customers}
            required
          />
          
          <Select
            label="Profissional"
            value={formData.professional_id}
            onChange={(e) => setFormData({...formData, professional_id: e.target.value})}
            options={professionals}
            required
          />
          
          <Select
            label="Serviço"
            value={formData.service_id}
            onChange={(e) => setFormData({...formData, service_id: e.target.value})}
            options={services}
            required
          />
          
          <Input
            label="Data"
            type="date"
            value={formData.appointment_date}
            onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
            required
          />
        </div>
      </div>

      {/* Observações */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Observações do Procedimento</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Estado Inicial</label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={3}
              value={formData.pre_procedure_notes}
              onChange={(e) => setFormData({...formData, pre_procedure_notes: e.target.value})}
              placeholder="Descreva o estado inicial do cliente..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Procedimento Realizado</label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={4}
              value={formData.procedure_notes}
              onChange={(e) => setFormData({...formData, procedure_notes: e.target.value})}
              placeholder="Descreva detalhadamente o que foi realizado..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Orientações Pós-Procedimento</label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={3}
              value={formData.post_procedure_notes}
              onChange={(e) => setFormData({...formData, post_procedure_notes: e.target.value})}
              placeholder="Orientações e cuidados pós-procedimento..."
            />
          </div>
        </div>
      </div>

      {/* Upload de Fotos */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Registro Fotográfico</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Fotos Antes</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files, 'before')}
                className="hidden"
                id="photos-before"
              />
              <label
                htmlFor="photos-before"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Camera className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-500">Clique para adicionar fotos</span>
              </label>
            </div>
            
            {/* Preview fotos antes */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {photosBefore.map((photo, index) => (
                <img key={index} src={photo} className="w-full h-20 object-cover rounded" />
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Fotos Depois</label>
            {/* Similar ao anterior */}
          </div>
        </div>
      </div>

      {/* Dados Financeiros */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Informações Financeiras</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Preço do Serviço"
            type="number"
            step="0.01"
            value={formData.service_price}
            onChange={(e) => setFormData({...formData, service_price: e.target.value})}
            required
          />
          
          <Input
            label="Desconto (%)"
            type="number"
            step="0.01"
            value={formData.discount_percentage}
            onChange={(e) => setFormData({...formData, discount_percentage: e.target.value})}
          />
          
          <Input
            label="Valor Final"
            type="number"
            step="0.01"
            value={formData.final_amount}
            onChange={(e) => setFormData({...formData, final_amount: e.target.value})}
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Select
            label="Status Pagamento"
            value={formData.payment_status}
            onChange={(e) => setFormData({...formData, payment_status: e.target.value})}
            options={[
              { value: 'paid', label: 'Pago' },
              { value: 'pending', label: 'Pendente' },
              { value: 'partial', label: 'Parcial' }
            ]}
          />
          
          <Select
            label="Forma de Pagamento"
            value={formData.payment_method}
            onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
            options={[
              { value: 'cash', label: 'Dinheiro' },
              { value: 'pix', label: 'PIX' },
              { value: 'credit_card', label: 'Cartão Crédito' },
              { value: 'debit_card', label: 'Cartão Débito' }
            ]}
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button variant="primary" loading={loading} onClick={handleSubmit}>
          Registrar Atendimento
        </Button>
      </div>
    </form>
  );
};
```

## 🧪 Testes Essenciais

### **Testes de Integração**
```typescript
describe('Services Module Integration', () => {
  describe('POST /appointments/complete', () => {
    it('should register completed appointment successfully', async () => {
      const appointmentData = {
        customer_id: 'customer-uuid',
        professional_id: 'prof-uuid',
        service_id: 'service-uuid',
        appointment_date: '2024-08-23',
        appointment_time: '10:00',
        procedure_notes: 'Limpeza realizada com sucesso',
        final_amount: 150.00,
        payment_status: 'paid'
      };

      const response = await request(app)
        .post('/api/appointments/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData);

      expect(response.status).toBe(201);
      expect(response.body.data.appointment.final_amount).toBe(150.00);
    });

    it('should update customer visit data in CRM', async () => {
      // Mock da integração com CRM
      const crmSpy = jest.spyOn(crmService, 'updateCustomerVisit');
      
      await createAppointmentCompleted({
        customer_id: 'customer-uuid',
        final_amount: 150.00
      });
      
      expect(crmSpy).toHaveBeenCalledWith('customer-uuid', {
        visit_date: expect.any(String),
        amount: 150.00
      });
    });
  });

  describe('Professional availability', () => {
    it('should return correct availability for professional', async () => {
      // Criar profissional com horário 09:00-18:00
      const professional = await createProfessional({
        work_schedule: {
          monday: { start: '09:00', end: '18:00' }
        }
      });
      
      // Criar atendimento das 10:00-11:00
      await createAppointmentCompleted({
        professional_id: professional.id,
        appointment_date: '2024-08-26', // Segunda-feira
        appointment_time: '10:00'
      });
      
      const response = await request(app)
        .get(`/api/professionals/${professional.id}/availability?date=2024-08-26`);
      
      expect(response.body.available_slots).not.toContain('10:00');
      expect(response.body.available_slots).toContain('09:00');
      expect(response.body.available_slots).toContain('11:00');
    });
  });
});
```

## 🐳 Deploy e Configuração

### **Docker Configuration**
```yaml
# docker-compose.yml
nexus-services:
  build: ./modules/services
  ports:
    - "5003:5000"
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://nexus_services_user:password@postgres:5432/nexus_erp?schema=nexus_services
    - USER_MANAGEMENT_URL=http://nexus-user-management:5000
    - CRM_URL=http://nexus-crm:5000
    - REDIS_URL=redis://redis:6379/2
    - FILE_UPLOAD_PATH=/uploads/appointments
    - MAX_PHOTO_SIZE=5MB
  volumes:
    - appointment_uploads:/uploads/appointments
  depends_on:
    - postgres
    - redis
    - nexus-user-management
    - nexus-crm
  networks:
    - nexus-network
```

## 🔧 Integrações com Outros Módulos

### **Com CRM Module**
```typescript
// Buscar dados básicos do cliente
export const getCustomerBasicInfo = async (customerId: string) => {
  const response = await fetch(`http://nexus-crm:5000/api/crm/customers/${customerId}/basic`);
  return response.json();
};

// Notificar CRM sobre atendimento realizado
export const notifyCustomerVisit = async (customerId: string, visitData: any) => {
  await fetch(`http://nexus-crm:5000/api/crm/customers/${customerId}/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visitData)
  });
};
```

### **Com Agendamento Module**
```typescript
// Agendamento busca serviços disponíveis
app.get('/api/agendamento/services', async (req, res) => {
  const response = await fetch('http://nexus-services:5000/api/services/list');
  const services = await response.json();
  res.json(services);
});

// Agendamento busca profissionais disponíveis
app.get('/api/agendamento/professionals', async (req, res) => {
  const response = await fetch('http://nexus-services:5000/api/professionals/list');
  const professionals = await response.json();
  res.json(professionals);
});
```

## 📝 Próximos Passos

### **Fase 1 - Catálogos (Semana 5)**
- [ ] Setup schema nexus_services
- [ ] CRUD serviços completo
- [ ] CRUD profissionais básico
- [ ] Relacionamento profissional-serviço

### **Fase 2 - Atendimentos (Semana 6)**
- [ ] Registro de atendimento completo
- [ ] Upload e gestão de fotos
- [ ] Controle financeiro básico
- [ ] Integração com CRM

### **Fase 3 - Relatórios (Semana 9)**
- [ ] Dashboard diário de atendimentos
- [ ] Relatórios por profissional
- [ ] KPIs de performance
- [ ] Exportação de dados