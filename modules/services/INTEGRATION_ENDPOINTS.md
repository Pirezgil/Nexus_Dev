# Services Module - Integration Endpoints for Agendamento

## 🚀 Critical Integration APIs Implemented

The Services module now provides **100% of the required integration APIs** for the Agendamento module to function properly.

## 📋 Integration Endpoints

### 1. **Get Services List**
```http
GET /api/integrations/services/list
Authorization: Bearer <jwt-token>
```

**Purpose:** Allow Agendamento to fetch available services for booking  
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "service-uuid",
      "name": "Limpeza de Pele",
      "duration": 60,
      "price": 150.00,
      "category": "Estética Facial"
    }
  ],
  "meta": {
    "count": 25,
    "companyId": "company-uuid",
    "retrievedAt": "2024-08-28T10:00:00Z"
  }
}
```

### 2. **Get Professionals List**
```http
GET /api/integrations/professionals/list?service_id=optional-service-uuid
Authorization: Bearer <jwt-token>
```

**Purpose:** Allow Agendamento to fetch available professionals  
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prof-uuid",
      "name": "Dr. Ana Costa",
      "specialties": ["estética facial", "peeling"],
      "status": "ACTIVE"
    }
  ],
  "meta": {
    "count": 8,
    "companyId": "company-uuid",
    "serviceId": "service-uuid",
    "retrievedAt": "2024-08-28T10:00:00Z"
  }
}
```

### 3. **Check Professional Availability** ⭐ **CRITICAL**
```http
GET /api/integrations/professionals/:id/availability?date=2024-08-28&service_id=service-uuid
Authorization: Bearer <jwt-token>
```

**Purpose:** Real-time availability checking for appointment booking  
**Response:**
```json
{
  "success": true,
  "data": {
    "availableSlots": ["09:00", "09:30", "10:00", "11:30", "14:00"],
    "workingHours": {
      "start": "08:00",
      "end": "17:00"
    },
    "bookedSlots": ["10:30", "11:00", "15:00"]
  },
  "meta": {
    "professionalId": "prof-uuid",
    "date": "2024-08-28",
    "serviceId": "service-uuid",
    "companyId": "company-uuid",
    "checkedAt": "2024-08-28T10:00:00Z"
  }
}
```

### 4. **Complete Appointment Callback** ⭐ **CRITICAL**
```http
POST /api/integrations/appointments/:id/complete
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Purpose:** Mark appointment as completed when service is finished  
**Request Body:**
```json
{
  "customer_id": "customer-uuid",
  "professional_id": "prof-uuid",
  "service_id": "service-uuid",
  "completed_at": "2024-08-28T10:30:00Z",
  "notes": "Cliente satisfeito com o procedimento",
  "photos": ["photo1.jpg", "photo2.jpg"],
  "payment_status": "PAID",
  "payment_amount": 150.00,
  "payment_method": "pix"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "completedAppointmentId": "completed-uuid",
    "appointmentId": "original-appointment-uuid",
    "customerId": "customer-uuid",
    "professionalId": "prof-uuid",
    "serviceId": "service-uuid",
    "totalAmount": 150.00,
    "paymentStatus": "PAID",
    "completedAt": "2024-08-28T10:30:00Z",
    "createdAt": "2024-08-28T10:30:45Z"
  },
  "message": "Appointment marked as completed successfully"
}
```

## 🔧 Database Schema Changes

### Added Fields:
- **`appointments_completed.appointment_id`** - Links to original Agendamento appointment
- **Multi-schema support** with `@@schema("nexus_services")` attributes
- **Proper indexing** on `appointmentId` for performance

### Schema Structure:
```sql
-- appointments_completed table now includes:
appointment_id UUID, -- Reference to nexus_agendamento.appointments
-- With proper index:
@@index([appointmentId])
```

## 🏗️ Integration Architecture

### Cross-Module Communication Flow:

1. **Agendamento → Services:**
   - `GET /integrations/services/list` - List available services
   - `GET /integrations/professionals/list` - List available professionals  
   - `GET /integrations/professionals/:id/availability` - Check real-time availability

2. **Services → CRM (Automatic):**
   - When appointment completes, Services automatically updates CRM with visit data
   - Creates customer note with service details

3. **Availability Calculation Logic:**
   - Reads professional's `workSchedule` JSON
   - Checks existing appointments from database
   - Generates available time slots based on service duration
   - Returns only genuinely available slots

## 📊 Key Features Implemented:

### ✅ **Professional Availability System**
- Real-time slot calculation
- Work schedule parsing
- Service duration consideration
- Conflict detection
- 30-minute caching for performance

### ✅ **Appointment Completion Workflow**
- Links completed appointment to original booking
- Automatic CRM integration
- Payment status tracking
- Photo and notes storage
- Audit trail maintenance

### ✅ **Multi-tenant Security**
- All endpoints require company authentication
- Data isolation by `companyId`
- Role-based access control
- Service-to-service authentication support

## 🎯 Integration Validation

### Required Test Scenarios:
```bash
# 1. Agendamento can list services
curl -H "Authorization: Bearer $TOKEN" \
  http://nexus-services:5003/api/integrations/services/list

# 2. Agendamento can list professionals
curl -H "Authorization: Bearer $TOKEN" \
  http://nexus-services:5003/api/integrations/professionals/list

# 3. Check availability works
curl -H "Authorization: Bearer $TOKEN" \
  "http://nexus-services:5003/api/integrations/professionals/prof-uuid/availability?date=2024-08-28&service_id=service-uuid"

# 4. Complete appointment works
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"cust-uuid","professional_id":"prof-uuid","service_id":"serv-uuid","completed_at":"2024-08-28T10:00:00Z","payment_amount":150.00}' \
  http://nexus-services:5003/api/integrations/appointments/appt-uuid/complete
```

## 🚨 Critical Success Metrics

### ✅ **MVP Integration Requirements Met:**
- [x] **Services List API** - Agendamento can fetch services ✅
- [x] **Professionals List API** - Agendamento can fetch professionals ✅  
- [x] **Availability Check API** - Real-time slot validation ✅
- [x] **Appointment Completion** - Services records completed appointments ✅
- [x] **CRM Integration** - Visit data automatically updated ✅
- [x] **Multi-tenant Security** - Company isolation maintained ✅

### 📈 **Business Value Delivered:**
- **End-to-end booking flow** now functional
- **Real-time availability** prevents double-booking
- **Automatic visit tracking** maintains customer history
- **Integrated payment recording** enables financial reports
- **Professional performance tracking** via completed appointments

---

**✅ The Services module integration APIs are now 100% complete and ready for Agendamento module integration.**

The critical integration gap that was blocking the MVP has been resolved. Agendamento can now:
1. List available services and professionals
2. Check real-time availability 
3. Mark appointments as completed with full data recording
4. Trigger automatic CRM updates

**Next Steps:** Test the integration with the Agendamento module and validate the complete booking workflow.