# 📊 **MAPEAMENTO COMPLETO DE CAMPOS: FRONTEND vs BANCO DE DADOS**

## 🎯 **CAMPOS DO FORMULÁRIO FRONTEND**

### **Campos Principais:**
- `name` → String obrigatória
- `email` → String opcional (email válido)
- `phone` → String obrigatória (mínimo 10 caracteres)
- `document` → String opcional (CPF/CNPJ)
- `status` → Enum: ['ACTIVE', 'PROSPECT', 'INACTIVE', 'BLOCKED']
- `tags` → Array de strings

### **Campos de Endereço (Estruturado):**
- `address.street` → String obrigatória
- `address.number` → String obrigatória
- `address.complement` → String opcional
- `address.neighborhood` → String obrigatória
- `address.city` → String obrigatória
- `address.state` → String (2 caracteres)
- `address.zipcode` → String (8-9 dígitos)

---

## 🗄️ **CAMPOS DO BANCO DE DADOS**

### **Tabela: nexus_crm.customers**

#### **Campos Principais:**
- `name` → VARCHAR(255) NOT NULL ✅
- `email` → VARCHAR(255) ✅
- `phone` → VARCHAR(50) ✅
- `cpf_cnpj` → VARCHAR(20) ✅
- `status` → USER-DEFINED (ENUM) ✅
- `tags` → TEXT[] ✅

#### **Campos de Endereço (Flat):**
- `address_street` → VARCHAR(255) ❌ (Não mapeado)
- `address_number` → VARCHAR(20) ❌ (Não mapeado)
- `address_complement` → VARCHAR(100) ❌ (Não mapeado)
- `address_neighborhood` → VARCHAR(100) ❌ (Não mapeado)
- `address_city` → VARCHAR(100) ❌ (Não mapeado)
- `address_state` → VARCHAR(2) ❌ (Não mapeado)
- `address_zipcode` → VARCHAR(10) ❌ (Não mapeado)
- `address_country` → VARCHAR(50) ❌ (Não mapeado)

#### **Outros Campos Não Mapeados:**
- `profession` → VARCHAR(100) ❌
- `source` → VARCHAR(50) ❌
- `preferred_contact` → VARCHAR(20) ❌
- `marketing_consent` → BOOLEAN ❌
- `secondary_phone` → VARCHAR(50) ❌
- `rg` → VARCHAR(20) ❌
- `birth_date` → DATE ❌
- `gender` → VARCHAR(20) ❌
- `marital_status` → VARCHAR(20) ❌

---

## 🚨 **PROBLEMAS IDENTIFICADOS**

### **❌ ENDEREÇO COMPLETO NÃO SALVO:**
- Frontend envia: `address.street`, `address.number`, etc.
- Backend espera: `address`, `city`, `state`, `zipCode`
- Banco tem: `address_street`, `address_number`, etc.

### **❌ CAMPOS ADICIONAIS NÃO MAPEADOS:**
- `profession`, `source`, `preferred_contact`
- `marketing_consent`, `secondary_phone`
- `rg`, `birth_date`, `gender`, `marital_status`

---

## 💡 **SOLUÇÃO PROPOSTA: BACKEND ADAPTÁVEL**

### **Lógica de Mapeamento:**
```typescript
// Se vier endereço estruturado (frontend atual)
if (data.address?.street) {
  prismaData.address_street = data.address.street;
  prismaData.address_number = data.address.number;
  prismaData.address_complement = data.address.complement;
  prismaData.address_neighborhood = data.address.neighborhood;
  prismaData.address_city = data.address.city;
  prismaData.address_state = data.address.state;
  prismaData.address_zipcode = data.address.zipcode;
}
// Se vier endereço flat (compatibilidade)
else if (data.address) {
  prismaData.address_street = data.address;
}
```

### **Mapeamento de Campos Adicionais:**
```typescript
// Mapear campos adicionais se existirem
if (data.profession) prismaData.profession = data.profession;
if (data.source) prismaData.source = data.source;
if (data.preferred_contact) prismaData.preferred_contact = data.preferred_contact;
if (data.marketing_consent !== undefined) prismaData.marketing_consent = data.marketing_consent;
// ... outros campos
```

---

## 📋 **CAMPOS A SEREM CORRIGIDOS:**

### **Prioridade ALTA:**
1. ✅ `address.street` → `address_street`
2. ✅ `address.number` → `address_number`
3. ✅ `address.neighborhood` → `address_neighborhood`
4. ✅ `address.city` → `address_city`
5. ✅ `address.state` → `address_state`
6. ✅ `address.zipcode` → `address_zipcode`
7. ✅ `address.complement` → `address_complement`

### **Prioridade MÉDIA:**
8. 📋 `profession` → adicionar suporte
9. 📋 `source` → adicionar suporte
10. 📋 `preferred_contact` → adicionar suporte
11. 📋 `marketing_consent` → adicionar suporte

---

## 🎯 **PRÓXIMOS PASSOS:**

1. ✅ **Mapeamento completo** - FEITO
2. 🔄 **Implementar solução no backend**
3. 🧪 **Testar todos os campos**
4. 📝 **Documentar mudanças**