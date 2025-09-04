# Módulo Agendamento - Nexus ERP

**Responsabilidade Central:** Gestão completa de agendamentos com calendário visual por profissional, integração com serviços e notificações automáticas via WhatsApp/SMS.

## 🎯 Objetivo do Módulo

### **Função Principal:**
Gerenciar **agenda completa** da empresa com calendários individuais por profissional, permitindo agendamento inteligente baseado em disponibilidade real, serviços oferecidos e integração total com CRM e Services.

### **Problemas que Resolve:**
- ✅ **Calendário Profissional:** Agenda individual para cada especialista
- ✅ **Agendamento Inteligente:** Sugere horários baseado em duração do serviço
- ✅ **Evita Conflitos:** Não permite double booking 
- ✅ **Notificações Automáticas:** WhatsApp/SMS de confirmação e lembretes
- ✅ **Visão Unificada:** Gerente vê agenda de toda equipe
- ✅ **Reagendamentos:** Facilita remarcações com histórico

## 📊 Funcionalidades Detalhadas

### **Prioridade CRÍTICA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **CRUD Agendamentos** | Criar, editar, cancelar agendamentos | Média | 4 dias |
| **Calendário por Profissional** | View individual de cada especialista | Alta | 5 dias |
| **Validação de Conflitos** | Impede double booking | Média | 3 dias |
| **Integração Services** | Busca serviços e profissionais | Média | 2 dias |

### **Prioridade ALTA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Calendário Visual** | Interface calendário semana/mês | Alta | 6 dias |
| **Notificações WhatsApp** | Confirmação + lembretes automáticos | Alta | 4 dias |
| **Reagendamentos** | Facilita mudanças de data/horário | Média | 3 dias |
| **Bloqueio de Horários** | Admin bloqueia horários específicos | Baixa | 2 dias |

### **Prioridade MÉDIA**  
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Agenda Unificada** | View de toda equipe simultânea | Alta | 4 dias |
| **Lista de Espera** | Clientes aguardando vaga | Média | 3 dias |
| **Recurring Appointments** | Agendamentos recorrentes | Média | 3 dias |
| **Relatórios de Agenda** | Estatísticas de ocupação | Média | 3 dias |

### **Prioridade BAIXA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Online Booking** | Cliente agenda pelo site | Alta | 7 dias |
| **Lembretes por Email** | Além de WhatsApp/SMS | Baixa | 2 dias |
| **Integração Google Calendar** | Sincronização externa | Alta | 5 dias |

## 🗄️ Database Schema

### **Schema: `nexus_agendamento`**

```sql
-- Agendamentos principais
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL, -- Multi-tenant
  
  -- Referências (foreign keys para outros módulos)
  customer_id UUID NOT NULL, -- Referência nexus_crm.customers
  professional_id UUID NOT NULL, -- Referência nexus_services.professionals  
  service_id UUID NOT NULL, -- Referência nexus_services.services
  
  -- Dados temporais
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_end_time TIME NOT NULL, -- Calculado: time + service.duration
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  
  -- Status do agendamento
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, confirmed, completed, cancelled, no_show, rescheduled
  
  -- Dados do agendamento
  notes TEXT, -- Observações especiais
  internal_notes TEXT, -- Notas internas (cliente não vê)
  estimated_price DECIMAL(10,2), -- Preço estimado do serviço
  
  -- Configurações de notificação
  send_confirmation BOOLEAN DEFAULT true,
  send_reminder BOOLEAN DEFAULT true,
  reminder_hours_before INTEGER DEFAULT 24, -- Lembrete 24h antes
  
  -- Dados de confirmação
  confirmed_at TIMESTAMP,
  confirmed_by VARCHAR(50), -- customer, staff, auto
  
  -- Reagendamento (se aplicável)
  original_appointment_id UUID REFERENCES appointments(id), -- Se foi reagendado
  rescheduled_from_date DATE, -- Data original
  rescheduled_from_time TIME, -- Hora original
  reschedule_reason VARCHAR(255), -- Motivo da remarcação
  
  -- Completion (integração com Services)
  completed_at TIMESTAMP, -- Quando foi marcado como realizado
  completed_appointment_id UUID, -- Referência para nexus_services.appointments_completed
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  updated_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CHECK (appointment_end_time > appointment_time),
  CHECK (appointment_date >= CURRENT_DATE)
);

-- Bloqueios de horário (feriados, folgas, etc.)
CREATE TABLE schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Pode ser para profissional específico ou geral
  professional_id UUID, -- NULL = bloqueia para todos
  
  -- Período do bloqueio
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME, -- NULL = dia todo
  end_time TIME, -- NULL = dia todo
  
  -- Tipo e descrição
  block_type VARCHAR(50) NOT NULL, -- holiday, vacation, maintenance, personal
  title VARCHAR(255) NOT NULL, -- "Férias Dr. Ana", "Feriado Nacional"
  description TEXT,
  
  -- Recorrência (opcional)
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule JSONB, -- {"frequency": "weekly", "days": ["monday", "friday"]}
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lista de espera para horários ocupados
CREATE TABLE waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Dados da solicitação
  customer_id UUID NOT NULL,
  service_id UUID NOT NULL,
  professional_id UUID, -- NULL = qualquer profissional
  
  -- Preferências de horário
  preferred_date DATE,
  preferred_time_start TIME, -- Ex: 09:00
  preferred_time_end TIME, -- Ex: 12:00
  flexible_date BOOLEAN DEFAULT true, -- Aceita outras datas próximas
  flexible_time BOOLEAN DEFAULT true, -- Aceita outros horários
  
  -- Status da espera
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, contacted, scheduled, expired
  priority INTEGER DEFAULT 0, -- 0 = normal, 1 = high priority
  
  -- Notificação quando vaga abrir
  notify_phone BOOLEAN DEFAULT true,
  notify_whatsapp BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  
  -- Controle
  expires_at TIMESTAMP, -- Expira automaticamente se não responder
  contacted_at TIMESTAMP, -- Quando foi contatado sobre vaga
  contacted_by UUID REFERENCES nexus_auth.users(id),
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notificações enviadas (log para controle)
CREATE TABLE appointment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Tipo e canal
  notification_type VARCHAR(50) NOT NULL, -- confirmation, reminder, cancellation, reschedule
  channel VARCHAR(20) NOT NULL, -- whatsapp, sms, email
  
  -- Destinatário
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  
  -- Conteúdo
  message_template VARCHAR(100), -- Nome do template usado
  message_content TEXT, -- Mensagem final enviada
  
  -- Status de envio
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, read
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP, -- Para WhatsApp
  failure_reason TEXT,
  
  -- Provider response
  external_message_id VARCHAR(255), -- ID da mensagem no provider
  provider_response JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Templates de mensagens
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Identificação
  template_name VARCHAR(100) NOT NULL, -- "appointment_confirmation", "reminder_24h"
  template_type VARCHAR(50) NOT NULL, -- confirmation, reminder, cancellation
  channel VARCHAR(20) NOT NULL, -- whatsapp, sms, email
  
  -- Conteúdo
  subject VARCHAR(255), -- Para email
  content TEXT NOT NULL, -- Pode conter variáveis: {{customer_name}}, {{date}}, {{time}}
  
  -- Configurações
  active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Template padrão para o tipo
  
  -- Auditoria
  created_by UUID REFERENCES nexus_auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, template_name, channel)
);

-- Configurações de horário de funcionamento da empresa
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  -- Dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  
  -- Horários
  is_open BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  
  -- Intervalo de almoço (opcional)
  lunch_start TIME,
  lunch_end TIME,
  
  -- Configurações
  slot_duration_minutes INTEGER DEFAULT 30, -- Slots de agendamento (30min padrão)
  advance_booking_days INTEGER DEFAULT 60, -- Máximo 60 dias no futuro
  same_day_booking BOOLEAN DEFAULT true, -- Permite agendamento no mesmo dia
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, day_of_week)
);

-- Configurações gerais do módulo por empresa
CREATE TABLE agendamento_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL,
  
  -- Configurações de WhatsApp
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_phone VARCHAR(20),
  whatsapp_api_token VARCHAR(500),
  whatsapp_webhook_url VARCHAR(255),
  
  -- Configurações de SMS
  sms_enabled BOOLEAN DEFAULT false,
  sms_provider VARCHAR(50), -- twillio, nexmo, etc
  sms_api_key VARCHAR(255),
  sms_sender VARCHAR(20),
  
  -- Configurações de Email
  email_enabled BOOLEAN DEFAULT true,
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_password VARCHAR(255),
  email_from VARCHAR(255),
  
  -- Configurações de agendamento
  auto_confirmation_enabled BOOLEAN DEFAULT false,
  max_advance_booking_days INTEGER DEFAULT 60,
  min_advance_booking_hours INTEGER DEFAULT 2,
  allow_same_day_booking BOOLEAN DEFAULT true,
  reminder_default_hours INTEGER DEFAULT 24,
  
  -- Configurações de calendário
  default_slot_duration INTEGER DEFAULT 30,
  working_hours_start TIME DEFAULT '08:00:00',
  working_hours_end TIME DEFAULT '18:00:00',
  calendar_view_default VARCHAR(10) DEFAULT 'week', -- day, week, month
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_appointments_company_date ON appointments(company_id, appointment_date);
CREATE INDEX idx_appointments_professional_date ON appointments(professional_id, appointment_date, appointment_time);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_date_time ON appointments(appointment_date, appointment_time);

CREATE INDEX idx_schedule_blocks_professional_date ON schedule_blocks(professional_id, start_date, end_date);
CREATE INDEX idx_schedule_blocks_company_date ON schedule_blocks(company_id, start_date, end_date);

CREATE INDEX idx_waiting_list_service_date ON waiting_list(service_id, preferred_date);
CREATE INDEX idx_waiting_list_status ON waiting_list(status);

CREATE INDEX idx_notifications_appointment ON appointment_notifications(appointment_id);
CREATE INDEX idx_notifications_status ON appointment_notifications(status, sent_at);
```

## 🔗 APIs REST Detalhadas

### **Base URL:** `http://localhost:5008/api`

### **Endpoints de Agendamentos**

#### `GET /agendamento/appointments`
**Descrição:** Lista agendamentos com filtros

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Query Parameters:**
- `date_from=2024-08-23` - Data inicial
- `date_to=2024-08-30` - Data final
- `professional_id=uuid` - Filtro por profissional
- `customer_id=uuid` - Filtro por cliente
- `status=scheduled` - Filtro por status
- `view=day|week|month` - Tipo de visualização

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "appointment-uuid",
        "customer": {
          "id": "customer-uuid",
          "name": "Maria Silva",
          "phone": "+5511999999999",
          "email": "maria@email.com"
        },
        "professional": {
          "id": "prof-uuid",
          "name": "Dr. Ana Costa",
          "photo_url": "https://..."
        },
        "service": {
          "id": "service-uuid",
          "name": "Limpeza de Pele",
          "duration_minutes": 60,
          "price": 150.00,
          "category": "Estética Facial"
        },
        "appointment_date": "2024-08-23",
        "appointment_time": "10:00",
        "appointment_end_time": "11:00",
        "status": "confirmed",
        "notes": "Cliente solicitou horário matutino",
        "estimated_price": 150.00,
        "confirmed_at": "2024-08-22T14:30:00Z",
        "created_at": "2024-08-20T09:15:00Z"
      }
    ],
    "summary": {
      "total_appointments": 25,
      "by_status": {
        "scheduled": 15,
        "confirmed": 8,
        "completed": 2
      },
      "total_estimated_revenue": 3750.00
    }
  }
}
```

#### `POST /agendamento/appointments`
**Descrição:** Criar novo agendamento

**Request:**
```json
{
  "customer_id": "customer-uuid",
  "professional_id": "prof-uuid",
  "service_id": "service-uuid",
  "appointment_date": "2024-08-25",
  "appointment_time": "14:30",
  "notes": "Primeira vez da cliente",
  "send_confirmation": true,
  "send_reminder": true,
  "reminder_hours_before": 24
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "new-appointment-uuid",
      "customer": { "name": "Maria Silva", "phone": "+5511999999999" },
      "professional": { "name": "Dr. Ana Costa" },
      "service": { "name": "Limpeza de Pele", "duration_minutes": 60 },
      "appointment_date": "2024-08-25",
      "appointment_time": "14:30",
      "appointment_end_time": "15:30",
      "status": "scheduled",
      "estimated_price": 150.00,
      "created_at": "2024-08-23T10:30:00Z"
    },
    "notifications_scheduled": [
      {
        "type": "confirmation",
        "channel": "whatsapp",
        "scheduled_for": "immediately"
      },
      {
        "type": "reminder", 
        "channel": "whatsapp",
        "scheduled_for": "2024-08-24T14:30:00Z"
      }
    ]
  },
  "message": "Agendamento criado com sucesso"
}
```

#### `PUT /agendamento/appointments/:id`
**Descrição:** Atualizar agendamento existente

**Request (Reagendamento):**
```json
{
  "appointment_date": "2024-08-26",
  "appointment_time": "10:00",
  "reschedule_reason": "Cliente solicitou mudança por compromisso pessoal",
  "send_reschedule_notification": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "appointment-uuid",
      "original_appointment_id": null,
      "rescheduled_from_date": "2024-08-25",
      "rescheduled_from_time": "14:30",
      "appointment_date": "2024-08-26",
      "appointment_time": "10:00",
      "reschedule_reason": "Cliente solicitou mudança por compromisso pessoal",
      "status": "scheduled",
      "updated_at": "2024-08-23T11:45:00Z"
    }
  },
  "message": "Agendamento reagendado com sucesso"
}
```

#### `DELETE /agendamento/appointments/:id`
**Descrição:** Cancelar agendamento

**Request:**
```json
{
  "cancellation_reason": "Cliente desistiu do procedimento",
  "send_cancellation_notification": true,
  "refund_required": false
}
```

#### `POST /agendamento/appointments/:id/confirm`
**Descrição:** Confirmar agendamento

**Request:**
```json
{
  "confirmed_by": "customer", // customer, staff, auto
  "confirmation_notes": "Confirmado via WhatsApp"
}
```

### **Endpoints de Disponibilidade**

#### `GET /agendamento/availability`
**Descrição:** Verificar disponibilidade para agendamento

**Query Parameters:**
- `professional_id=uuid` - Profissional específico
- `service_id=uuid` - Serviço a ser agendado (para calcular duração)
- `date=2024-08-25` - Data desejada
- `days=7` - Número de dias para verificar

**Response (200):**
```json
{
  "success": true,
  "data": {
    "availability": [
      {
        "date": "2024-08-25",
        "day_name": "Domingo",
        "is_business_day": false,
        "available_slots": []
      },
      {
        "date": "2024-08-26", 
        "day_name": "Segunda-feira",
        "is_business_day": true,
        "business_hours": {
          "start": "08:00",
          "end": "18:00",
          "lunch_break": "12:00-13:00"
        },
        "available_slots": [
          {
            "start_time": "08:00",
            "end_time": "09:00",
            "available": true
          },
          {
            "start_time": "09:00", 
            "end_time": "10:00",
            "available": true
          },
          {
            "start_time": "10:00",
            "end_time": "11:00", 
            "available": false,
            "reason": "Já agendado"
          }
        ]
      }
    ],
    "recommended_slots": [
      {
        "date": "2024-08-26",
        "time": "08:00",
        "reason": "Primeiro horário disponível"
      },
      {
        "date": "2024-08-26", 
        "time": "14:00",
        "reason": "Horário popular disponível"
      }
    ]
  }
}
```

### **Endpoints de Calendário**

#### `GET /agendamento/calendar`
**Descrição:** Dados para renderização do calendário

**Query Parameters:**
- `view=week` - Visualização (day, week, month)
- `date=2024-08-23` - Data de referência
- `professional_id=uuid` - Filtro por profissional

**Response (200):**
```json
{
  "success": true,
  "data": {
    "view": "week",
    "period": {
      "start_date": "2024-08-19",
      "end_date": "2024-08-25"
    },
    "business_hours": {
      "monday": {"start": "08:00", "end": "18:00"},
      "tuesday": {"start": "08:00", "end": "18:00"}
    },
    "professionals": [
      {
        "id": "prof-uuid",
        "name": "Dr. Ana Costa",
        "photo_url": "https://...",
        "color": "#3B82F6"
      }
    ],
    "appointments": [
      {
        "id": "appointment-uuid",
        "professional_id": "prof-uuid",
        "customer_name": "Maria Silva",
        "service_name": "Limpeza de Pele",
        "start": "2024-08-23T10:00:00",
        "end": "2024-08-23T11:00:00",
        "status": "confirmed",
        "color": "#10B981"
      }
    ],
    "schedule_blocks": [
      {
        "id": "block-uuid",
        "professional_id": "prof-uuid",
        "title": "Intervalo Almoço",
        "start": "2024-08-23T12:00:00",
        "end": "2024-08-23T13:00:00",
        "type": "break",
        "color": "#F59E0B"
      }
    ]
  }
}
```

### **Endpoints de Notificações**

#### `GET /agendamento/notifications`
**Descrição:** Log de notificações enviadas

#### `POST /agendamento/notifications/test`
**Descrição:** Testar envio de notificação

**Request:**
```json
{
  "template_type": "confirmation",
  "channel": "whatsapp",
  "phone": "+5511999999999",
  "variables": {
    "customer_name": "Maria Silva",
    "date": "23/08/2024",
    "time": "10:00",
    "professional": "Dr. Ana Costa",
    "service": "Limpeza de Pele"
  }
}
```

### **Endpoints de Bloqueios**

#### `GET /agendamento/schedule-blocks`
**Descrição:** Lista bloqueios de horário

#### `POST /agendamento/schedule-blocks`
**Descrição:** Criar novo bloqueio

**Request:**
```json
{
  "professional_id": "prof-uuid", // null = todos os profissionais
  "start_date": "2024-08-30",
  "end_date": "2024-09-05",
  "start_time": null, // null = dia todo
  "end_time": null,
  "block_type": "vacation",
  "title": "Férias Dr. Ana",
  "description": "Férias programadas"
}
```

### **Endpoints para Outros Módulos**

#### `POST /agendamento/appointments/:id/complete` [INTERNAL]
**Descrição:** Marcar agendamento como completado (chamado pelo Services)

**Request:**
```json
{
  "completed_at": "2024-08-23T11:15:00Z",
  "completed_appointment_id": "services-appointment-uuid"
}
```

## 🎨 Frontend Components

### **Páginas React**
| Componente | Rota | Descrição | Acesso |
|:----------|:-----|:----------|:-------|
| `CalendarPage` | `/calendar` | Calendário principal | AGENDAMENTO read |
| `AppointmentCreatePage` | `/appointments/new` | Criar agendamento | AGENDAMENTO write |
| `AppointmentDetailPage` | `/appointments/:id` | Detalhes do agendamento | AGENDAMENTO read |
| `AppointmentEditPage` | `/appointments/:id/edit` | Editar agendamento | AGENDAMENTO write |
| `ScheduleBlocksPage` | `/schedule/blocks` | Gestão de bloqueios | AGENDAMENTO write |
| `WaitingListPage` | `/waiting-list` | Lista de espera | AGENDAMENTO read |

### **Componentes Base**

#### `CalendarView.tsx`
```tsx
import { useState, useEffect } from 'react';
import { Button, Select, LoadingSpinner } from '@/shared/components/ui';
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';

export const CalendarView = () => {
  const [view, setView] = useState('week'); // day, week, month
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState('all');
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view,
        date: currentDate.toISOString().split('T')[0],
        ...(selectedProfessional !== 'all' && { professional_id: selectedProfessional })
      });
      
      const response = await fetch(`/api/agendamento/calendar?${params}`);
      const data = await response.json();
      setCalendarData(data.data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [view, currentDate, selectedProfessional]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  };

  const renderWeekView = () => {
    if (!calendarData) return null;

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const timeSlots = getTimeSlots();

    return (
      <div className="calendar-grid">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-8 gap-1 mb-4">
          <div className="p-2"></div> {/* Coluna dos horários */}
          {days.map((day, index) => (
            <div key={day} className="p-2 text-center font-medium bg-gray-100">
              {day}
            </div>
          ))}
        </div>

        {/* Grid com horários e agendamentos */}
        <div className="grid grid-cols-8 gap-1">
          {timeSlots.map(time => (
            <React.Fragment key={time}>
              {/* Coluna do horário */}
              <div className="p-2 text-sm text-gray-500 border-r">
                {time}
              </div>
              
              {/* Células para cada dia da semana */}
              {days.map((day, dayIndex) => {
                const dayDate = new Date(calendarData.period.start_date);
                dayDate.setDate(dayDate.getDate() + dayIndex);
                const dateStr = dayDate.toISOString().split('T')[0];
                
                // Buscar agendamentos para este horário/dia
                const appointmentsInSlot = calendarData.appointments.filter(apt => {
                  const aptDate = apt.start.split('T')[0];
                  const aptTime = apt.start.split('T')[1].substring(0, 5);
                  return aptDate === dateStr && aptTime === time;
                });

                return (
                  <div
                    key={`${day}-${time}`}
                    className="p-1 min-h-12 border border-gray-200 relative cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSlotClick(dateStr, time)}
                  >
                    {appointmentsInSlot.map(appointment => (
                      <div
                        key={appointment.id}
                        className={`
                          text-xs p-1 rounded mb-1 text-white
                          ${appointment.status === 'confirmed' ? 'bg-success' : 'bg-warning'}
                        `}
                        title={`${appointment.customer_name} - ${appointment.service_name}`}
                      >
                        {appointment.customer_name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  const handleSlotClick = (date: string, time: string) => {
    // Abrir modal para criar agendamento
    router.push(`/appointments/new?date=${date}&time=${time}&professional=${selectedProfessional}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Agenda</h1>
          
          {/* Navegação de data */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-32 text-center">
              {currentDate.toLocaleDateString('pt-BR', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigateDate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Filtro por profissional */}
          <Select
            value={selectedProfessional}
            onChange={(e) => setSelectedProfessional(e.target.value)}
            options={[
              { value: 'all', label: 'Todos os profissionais' },
              ...calendarData?.professionals?.map(prof => ({
                value: prof.id,
                label: prof.name
              })) || []
            ]}
          />

          {/* Seletor de visualização */}
          <div className="flex border rounded">
            {['day', 'week', 'month'].map(viewType => (
              <button
                key={viewType}
                className={`px-3 py-1 text-sm capitalize ${
                  view === viewType 
                    ? 'bg-primary text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setView(viewType)}
              >
                {viewType === 'day' ? 'Dia' : viewType === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>

          {/* Botão novo agendamento */}
          <Button 
            variant="primary" 
            onClick={() => router.push('/appointments/new')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Calendário */}
      <div className="bg-white rounded-lg shadow p-6">
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
        {view === 'month' && renderMonthView()}
      </div>
    </div>
  );
};
```

#### `AppointmentForm.tsx`
```tsx
import { Input, Select, Button, Alert } from '@/shared/components/ui';
import { Search, Calendar, Clock, User, Scissors } from 'lucide-react';

export const AppointmentForm = ({ appointment, onSubmit, loading }) => {
  const [formData, setFormData] = useState(appointment || {
    customer_id: '',
    professional_id: '',
    service_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
    send_confirmation: true,
    send_reminder: true
  });

  const [customers, setCustomers] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);

  // Busca de clientes com debounce
  const searchCustomers = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) return;
      
      const response = await fetch(`/api/crm/customers?search=${query}&limit=10`);
      const data = await response.json();
      setCustomers(data.data.customers);
    }, 300),
    []
  );

  // Atualizar disponibilidade quando profissional/serviço/data mudam
  useEffect(() => {
    if (formData.professional_id && formData.service_id && formData.appointment_date) {
      fetchAvailability();
    }
  }, [formData.professional_id, formData.service_id, formData.appointment_date]);

  const fetchAvailability = async () => {
    const params = new URLSearchParams({
      professional_id: formData.professional_id,
      service_id: formData.service_id,
      date: formData.appointment_date,
      days: '1'
    });

    const response = await fetch(`/api/agendamento/availability?${params}`);
    const data = await response.json();
    setAvailability(data.data.availability[0]?.available_slots || []);
  };

  return (
    <form className="space-y-8 max-w-4xl mx-auto">
      {/* Seleção do Cliente */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Cliente
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nome, telefone ou email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              onChange={(e) => searchCustomers(e.target.value)}
            />
          </div>
          
          {customers.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {customers.map(customer => (
                <div
                  key={customer.id}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onClick={() => setFormData({...formData, customer_id: customer.id})}
                >
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-gray-500">
                    {customer.phone} • {customer.email}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {formData.customer_id && (
            <div className="p-3 bg-success bg-opacity-10 rounded-md">
              <div className="text-sm text-success font-medium">✓ Cliente selecionado</div>
            </div>
          )}
        </div>
      </div>

      {/* Seleção do Serviço e Profissional */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Scissors className="w-5 h-5" />
          Serviço e Profissional
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Serviço"
            value={formData.service_id}
            onChange={(e) => setFormData({...formData, service_id: e.target.value})}
            options={services.map(service => ({
              value: service.id,
              label: `${service.name} (${service.duration_minutes}min - R$ ${service.price})`
            }))}
            required
          />
          
          <Select
            label="Profissional"
            value={formData.professional_id}
            onChange={(e) => setFormData({...formData, professional_id: e.target.value})}
            options={professionals.map(prof => ({
              value: prof.id,
              label: prof.name
            }))}
            required
          />
        </div>
      </div>

      {/* Data e Horário */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Data e Horário
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Data"
            type="date"
            value={formData.appointment_date}
            onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          
          <div>
            <label className="block text-sm font-medium mb-2">Horário Disponível</label>
            {availability.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {availability
                  .filter(slot => slot.available)
                  .map(slot => (
                    <button
                      key={slot.start_time}
                      type="button"
                      className={`p-2 text-sm border rounded ${
                        formData.appointment_time === slot.start_time
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setFormData({...formData, appointment_time: slot.start_time})}
                    >
                      {slot.start_time}
                    </button>
                  ))
                }
              </div>
            ) : (
              <div className="text-sm text-gray-500 p-4 border rounded">
                Selecione serviço, profissional e data para ver horários disponíveis
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observações e Notificações */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Observações e Configurações</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Observações</label>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-md"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Observações especiais para este agendamento..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.send_confirmation}
                onChange={(e) => setFormData({...formData, send_confirmation: e.target.checked})}
              />
              <span className="text-sm">Enviar confirmação por WhatsApp</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.send_reminder}
                onChange={(e) => setFormData({...formData, send_reminder: e.target.checked})}
              />
              <span className="text-sm">Enviar lembrete 24h antes</span>
            </label>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button 
          variant="primary" 
          loading={loading} 
          onClick={handleSubmit}
          disabled={!formData.customer_id || !formData.professional_id || !formData.service_id || !formData.appointment_date || !formData.appointment_time}
        >
          {appointment?.id ? 'Atualizar' : 'Criar'} Agendamento
        </Button>
      </div>
    </form>
  );
};
```

## 🧪 Testes Essenciais

### **Testes de Integração**
```typescript
describe('Agendamento Module Integration', () => {
  describe('POST /agendamento/appointments', () => {
    it('should create appointment successfully', async () => {
      const appointmentData = {
        customer_id: 'customer-uuid',
        professional_id: 'prof-uuid',
        service_id: 'service-uuid',
        appointment_date: '2024-08-25',
        appointment_time: '10:00'
      };

      const response = await request(app)
        .post('/api/agendamento/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData);

      expect(response.status).toBe(201);
      expect(response.body.data.appointment.status).toBe('scheduled');
    });

    it('should prevent double booking', async () => {
      // Criar primeiro agendamento
      await createAppointment({
        professional_id: 'prof-uuid',
        appointment_date: '2024-08-25',
        appointment_time: '10:00'
      });

      // Tentar criar segundo no mesmo horário
      const response = await request(app)
        .post('/api/agendamento/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customer_id: 'other-customer-uuid',
          professional_id: 'prof-uuid', // Mesmo profissional
          service_id: 'service-uuid',
          appointment_date: '2024-08-25', // Mesma data
          appointment_time: '10:00' // Mesmo horário
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SCHEDULE_CONFLICT');
    });
  });

  describe('Availability calculation', () => {
    it('should return correct available slots', async () => {
      // Criar agendamento das 10:00-11:00
      await createAppointment({
        professional_id: 'prof-uuid',
        service_id: 'service-60min-uuid', // Serviço de 60 minutos
        appointment_date: '2024-08-25',
        appointment_time: '10:00'
      });

      const response = await request(app)
        .get('/api/agendamento/availability')
        .query({
          professional_id: 'prof-uuid',
          service_id: 'service-30min-uuid', // Serviço de 30 minutos
          date: '2024-08-25'
        });

      const availableSlots = response.body.data.availability[0].available_slots;
      
      // Deve estar disponível das 09:30-10:00 (30min antes)
      expect(availableSlots.find(s => s.start_time === '09:30').available).toBe(true);
      
      // Não deve estar disponível das 10:00-11:00 (ocupado)
      expect(availableSlots.find(s => s.start_time === '10:00').available).toBe(false);
      expect(availableSlots.find(s => s.start_time === '10:30').available).toBe(false);
      
      // Deve estar disponível das 11:00+ (após término)
      expect(availableSlots.find(s => s.start_time === '11:00').available).toBe(true);
    });
  });

  describe('Integration with Services module', () => {
    it('should fetch services and professionals from Services module', async () => {
      // Mock da resposta do Services
      const servicesSpy = jest.spyOn(servicesApi, 'getServicesList')
        .mockResolvedValue([
          { id: 'service-1', name: 'Limpeza de Pele', duration_minutes: 60 }
        ]);

      const professionalsSpy = jest.spyOn(servicesApi, 'getProfessionalsList')
        .mockResolvedValue([
          { id: 'prof-1', name: 'Dr. Ana Costa' }
        ]);

      const response = await request(app)
        .get('/api/agendamento/services-and-professionals');

      expect(servicesSpy).toHaveBeenCalled();
      expect(professionalsSpy).toHaveBeenCalled();
      expect(response.body.data.services).toHaveLength(1);
      expect(response.body.data.professionals).toHaveLength(1);
    });
  });
});
```

## 🐳 Deploy e Configuração

### **Docker Configuration**
```yaml
# docker-compose.yml
nexus-agendamento:
  build: ./modules/agendamento
  ports:
    - "5008:3000"
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://nexus_agendamento_user:password@postgres:5432/nexus_erp?schema=nexus_agendamento
    - USER_MANAGEMENT_URL=http://nexus-user-management:5000
    - CRM_URL=http://nexus-crm:5000
    - SERVICES_URL=http://nexus-services:5000
    - REDIS_URL=redis://redis:6379/3
    - WHATSAPP_API_URL=https://api.whatsapp.business
    - WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
    - SMS_PROVIDER_URL=https://api.sms-provider.com
    - SMS_API_KEY=your-sms-api-key
  depends_on:
    - postgres
    - redis
    - nexus-user-management
    - nexus-crm
    - nexus-services
  networks:
    - nexus-network
```

## 🔧 Integrações com Outros Módulos

### **Com Services Module**
```typescript
// Buscar serviços disponíveis
export const getAvailableServices = async (companyId: string) => {
  const response = await fetch(`http://nexus-services:5000/api/services/list?company_id=${companyId}`);
  return response.json();
};

// Buscar profissionais disponíveis
export const getAvailableProfessionals = async (companyId: string, serviceId?: string) => {
  const url = `http://nexus-services:5000/api/professionals/list?company_id=${companyId}`;
  const response = await fetch(serviceId ? `${url}&service_id=${serviceId}` : url);
  return response.json();
};

// Verificar disponibilidade específica do profissional
export const checkProfessionalAvailability = async (professionalId: string, date: string, serviceId: string) => {
  const response = await fetch(`http://nexus-services:5000/api/professionals/${professionalId}/availability?date=${date}&service_id=${serviceId}`);
  return response.json();
};
```

### **Com CRM Module**
```typescript
// Buscar clientes para agendamento
export const searchCustomersForBooking = async (query: string) => {
  const response = await fetch(`http://nexus-crm:5000/api/crm/customers?search=${query}&limit=10`);
  return response.json();
};

// Buscar dados básicos do cliente
export const getCustomerBasicInfo = async (customerId: string) => {
  const response = await fetch(`http://nexus-crm:5000/api/crm/customers/${customerId}/basic`);
  return response.json();
};
```

### **Notificações WhatsApp**
```typescript
// Envio de notificações via WhatsApp Business API
export const sendWhatsAppNotification = async (notification: AppointmentNotification) => {
  const message = await renderTemplate(notification.template_type, notification.variables);
  
  const response = await fetch(`${process.env.WHATSAPP_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: notification.recipient_phone,
      type: 'text',
      text: { body: message }
    })
  });

  return response.json();
};
```

## 📝 Próximos Passos

### **Fase 1 - CRUD Básico (Semana 7)**
- [ ] Setup schema nexus_agendamento
- [ ] CRUD completo de agendamentos
- [ ] Validação de conflitos de horário
- [ ] Integração básica com Services e CRM

### **Fase 2 - Calendário Visual (Semana 8)**
- [ ] Interface de calendário (week/month view)
- [ ] Drag & drop para reagendamentos
- [ ] Visualização por profissional
- [ ] Bloqueios de horário

### **Fase 3 - Notificações (Semana 9)**
- [ ] WhatsApp Business API integration
- [ ] Templates de mensagens customizáveis
- [ ] Agendamento de lembretes
- [ ] Log completo de notificações enviadas

### **Futuras Melhorias**
- [ ] Online booking (cliente agenda pelo site)
- [ ] Lista de espera automatizada
- [ ] Integração Google Calendar
- [ ] Agendamentos recorrentes automáticos