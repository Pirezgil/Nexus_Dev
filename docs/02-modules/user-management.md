# Módulo User Management - Nexus ERP

**Responsabilidade Central:** Autenticação, autorização e gestão de usuários em ambiente multi-tenant com isolamento total por empresa.

## 🎯 Objetivo do Módulo

### **Função Principal:**
Gerenciar **identidade e acesso** de todos os usuários do sistema, garantindo que cada empresa tenha seus dados completamente isolados e que apenas usuários autorizados acessem funcionalidades específicas.

### **Problemas que Resolve:**
- ✅ **Isolamento Multi-tenant:** Empresa A nunca vê dados da Empresa B
- ✅ **Controle de Acesso:** Define quem pode fazer o quê em cada módulo
- ✅ **Autenticação Segura:** Login/logout com JWT e validação por empresa
- ✅ **Auditoria:** Registra todas as ações de login e acesso

## 📊 Funcionalidades Detalhadas

### **Prioridade CRÍTICA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Login Multi-tenant** | Login com email + empresa isolada | Média | 3 dias |
| **Cadastro de Usuários** | Admin cadastra usuários da empresa | Baixa | 2 dias |
| **Validação JWT** | Middleware para todos os módulos | Média | 2 dias |
| **Company Isolation** | Schema switching por empresa | Alta | 4 dias |

### **Prioridade ALTA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Roles Básicos** | Admin, Manager, Employee | Média | 3 dias |
| **Permissões por Módulo** | CRM, Services, Agendamento | Média | 3 dias |
| **Session Management** | Controle de sessões ativas | Baixa | 1 dia |

### **Prioridade MÉDIA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Recuperação de Senha** | Reset via email | Baixa | 2 dias |
| **Profile Management** | Usuário edita próprio perfil | Baixa | 1 dia |

### **Prioridade BAIXA**
| Funcionalidade | Descrição | Complexidade | Tempo Est. |
|:---------------|:----------|:-------------|:-----------|
| **Auditoria de Login** | Log completo de acessos | Baixa | 1 dia |
| **2FA (Futuro)** | Two-factor authentication | Alta | 5 dias |

## 🗄️ Database Schema

### **Schema: `nexus_auth`**

```sql
-- Tabela global de empresas (acesso apenas admin Nexus)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  cnpj VARCHAR(20) UNIQUE,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  plan VARCHAR(50) DEFAULT 'basic', -- basic, premium, enterprise
  max_users INTEGER DEFAULT 5,
  settings JSONB, -- Company-specific settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usuários por empresa (multi-tenant)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar TEXT,
  role VARCHAR(20) DEFAULT 'USER', -- ADMIN, USER, MANAGER, VIEWER
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, PENDING, SUSPENDED
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  email_verification_token VARCHAR(255),
  preferences JSONB, -- User preferences
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessões ativas para JWT token management
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  access_token VARCHAR(500) UNIQUE NOT NULL,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  device_info VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Solicitações de reset de senha
CREATE TABLE password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Verificação de email
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_companies_active ON companies(is_active);
```

## 🔗 APIs REST Detalhadas

### **Base URL:** `http://localhost:5003/api`

### **Endpoints Públicos (Sem Auth)**

#### `POST /auth/login`
**Descrição:** Login de usuário com validação multi-tenant

**Request:**
```json
{
  "email": "admin@clinica.com",
  "password": "senha123"
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Dr. João Silva",
      "email": "admin@clinica.com", 
      "role": "admin",
      "company": {
        "id": "company-uuid",
        "name": "Clínica Bella Vida",
        "enabled_modules": ["CRM", "SERVICES", "AGENDAMENTO"]
      },
      "permissions": {
        "CRM": ["read", "write", "delete"],
        "SERVICES": ["read", "write"],
        "AGENDAMENTO": ["read", "write"]
      }
    },
    "token": "jwt.token.here",
    "expires_in": 86400
  }
}
```

**Response Error (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou senha incorretos"
  }
}
```

#### `POST /auth/logout`
**Descrição:** Logout e invalidação do token

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

#### `POST /auth/forgot-password`
**Descrição:** Solicita reset de senha via email

**Request:**
```json
{
  "email": "admin@clinica.com"
}
```

### **Endpoints Protegidos (Requer Auth)**

#### `GET /auth/me`
**Descrição:** Dados do usuário autenticado

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Dr. João Silva",
    "email": "admin@clinica.com",
    "role": "admin", 
    "permissions": {...},
    "company": {...},
    "last_login": "2024-08-23T10:30:00Z"
  }
}
```

#### `PUT /auth/profile`
**Descrição:** Atualiza perfil do usuário

**Request:**
```json
{
  "name": "Dr. João Silva Santos",
  "phone": "+5511999999999",
  "avatar_url": "https://..."
}
```

#### `GET /users` [ADMIN ONLY]
**Descrição:** Lista usuários da empresa

**Query Parameters:**
- `page=1` - Página
- `limit=20` - Registros por página  
- `search=nome` - Busca por nome/email
- `role=admin` - Filtro por role

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "Maria Santos", 
        "email": "maria@clinica.com",
        "role": "employee",
        "is_active": true,
        "last_login": "2024-08-23T09:15:00Z",
        "created_at": "2024-08-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### `POST /users` [ADMIN ONLY] 
**Descrição:** Cria novo usuário na empresa

**Request:**
```json
{
  "name": "Ana Costa",
  "email": "ana@clinica.com", 
  "password": "senha123",
  "role": "employee",
  "permissions": {
    "CRM": ["read", "write"],
    "SERVICES": ["read"]
  }
}
```

#### `PUT /users/:id` [ADMIN ONLY]
**Descrição:** Atualiza usuário existente

#### `DELETE /users/:id` [ADMIN ONLY]
**Descrição:** Desativa usuário (soft delete)

### **Endpoints de Validação (Para Outros Módulos)**

#### `GET /auth/validate`
**Descrição:** Valida token JWT (usado por outros módulos)

**Headers:**
```
Authorization: Bearer jwt.token.here
```

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "company_id": "company-uuid",
    "role": "admin",
    "permissions": {...}
  }
}
```

## 🔐 Middleware de Autenticação

### **Para Outros Módulos**
```typescript
// shared/middleware/auth.ts
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req);
    const response = await fetch('http://nexus-user-management:5000/api/auth/validate', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    const authData = await response.json();
    req.user = authData.user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Autenticação falhou' });
  }
};

// Middleware para roles específicas
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
};
```

## 🎨 Frontend Components

### **Páginas React**
| Componente | Rota | Descrição | Acesso |
|:----------|:-----|:----------|:-------|
| `LoginPage` | `/login` | Tela de login | Público |
| `DashboardPage` | `/dashboard` | Dashboard pós-login | Autenticado |
| `ProfilePage` | `/profile` | Edição de perfil | Autenticado |
| `UsersPage` | `/users` | Gestão de usuários | Admin apenas |
| `UserCreatePage` | `/users/new` | Criar usuário | Admin apenas |
| `UserEditPage` | `/users/:id/edit` | Editar usuário | Admin apenas |

### **Componentes Base (usando Biblioteca_visual.tsx)**

#### `LoginForm.tsx`
```tsx
import { Button, Input, Alert } from '@/shared/components/ui';

export const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await authService.login(formData);
      localStorage.setItem('token', response.data.token);
      router.push('/dashboard');
    } catch (err) {
      setError('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-primary">Nexus ERP</h1>
        <p className="text-textSecondary">Faça login para continuar</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      
      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      
      <Input
        label="Senha" 
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        required
      />
      
      <Button 
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        className="w-full"
      >
        Entrar
      </Button>
    </form>
  );
};
```

#### `UserTable.tsx`
```tsx
import { DataTable, Button } from '@/shared/components/ui';

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Função' },
  { 
    key: 'is_active', 
    label: 'Status',
    render: (value: boolean) => (
      <span className={`px-2 py-1 rounded text-xs ${
        value ? 'bg-success text-white' : 'bg-error text-white'
      }`}>
        {value ? 'Ativo' : 'Inativo'}
      </span>
    )
  },
  { 
    key: 'last_login', 
    label: 'Último Acesso',
    render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Nunca'
  }
];

export const UserTable = ({ users, loading, onEdit, onDelete }: UserTableProps) => {
  const handleView = (user: User) => {
    router.push(`/users/${user.id}`);
  };

  return (
    <DataTable
      data={users}
      columns={columns}
      loading={loading}
      onView={handleView}
      onEdit={onEdit}
      onDelete={onDelete}
      searchPlaceholder="Buscar usuário..."
    />
  );
};
```

## 🧪 Testes Essenciais

### **Testes de Integração**
```typescript
describe('Auth Module Integration', () => {
  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com', 
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should not allow cross-company access', async () => {
      // Criar 2 empresas e usuários
      const company1Token = await getCompanyToken('company1');
      const company2Token = await getCompanyToken('company2');
      
      // Tentar acessar dados da company2 com token da company1
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${company1Token}`);
      
      // Deve retornar apenas usuários da company1
      expect(response.body.data.users).toHaveLength(1);
    });
  });
});
```

### **Testes Unitários**
```typescript
describe('JWT Utils', () => {
  it('should generate valid JWT token', () => {
    const payload = { userId: 'uuid', companyId: 'company-uuid' };
    const token = generateJWT(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify JWT token correctly', () => {
    const payload = { userId: 'uuid', companyId: 'company-uuid' };
    const token = generateJWT(payload);
    const verified = verifyJWT(token);
    
    expect(verified.userId).toBe(payload.userId);
    expect(verified.companyId).toBe(payload.companyId);
  });
});
```

## 🐳 Deploy e Configuração

### **Docker Configuration**
```yaml
# docker-compose.yml
nexus-user-management:
  build: ./modules/user-management
  ports:
    - "5003:3000"
  environment:
    - NODE_ENV=development
    - DATABASE_URL=postgresql://nexus_auth_user:password@postgres:5432/nexus_erp?schema=nexus_auth
    - JWT_SECRET=super-secret-key-here
    - REDIS_URL=redis://redis:6379/0
  depends_on:
    - postgres
    - redis
  networks:
    - nexus-network
  restart: unless-stopped
```

### **Environment Variables**
```env
# .env
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://nexus_auth_user:password@localhost:5433/nexus_erp?schema=nexus_auth

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Redis (opcional)
REDIS_URL=redis://localhost:6379/0

# Email (para reset de senha)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@nexus-erp.com
SMTP_PASS=app-password

# Rate Limiting
RATE_LIMIT_LOGIN=5 # tentativas por 15min
```

### **Comandos Úteis**
```bash
# Setup inicial
npm install
npm run prisma:migrate
npm run seed:companies # Criar empresa demo

# Desenvolvimento
npm run dev # Inicia em modo watch
npm run test # Roda todos os testes
npm run test:watch # Testes em modo watch

# Build & Deploy
npm run build
npm run start
npm run docker:build
npm run docker:run
```

## 🔧 Integrações com Outros Módulos

### **CRM Module**
```typescript
// modules/crm/middleware/auth.ts
import { authMiddleware, requirePermission } from '@/shared/middleware';

// Todas as rotas CRM requerem autenticação
app.use('/api/crm', authMiddleware);

// Rotas específicas requerem permissões
app.get('/api/crm/customers', requirePermission('CRM', 'read'), customersController.list);
app.post('/api/crm/customers', requirePermission('CRM', 'write'), customersController.create);
app.delete('/api/crm/customers/:id', requirePermission('CRM', 'delete'), customersController.delete);
```

### **Services Module**  
```typescript
// modules/services/routes/professionals.ts
app.get('/api/services/professionals', 
  authMiddleware,
  requirePermission('SERVICES', 'read'),
  professionalsController.list
);
```

### **Agendamento Module**
```typescript  
// modules/agendamento/routes/appointments.ts
app.post('/api/agendamento/appointments',
  authMiddleware, 
  requirePermission('AGENDAMENTO', 'write'),
  appointmentsController.create
);
```

## 📝 Próximos Passos

### **Fase 1 - MVP (Semana 1-2)**
- [ ] Setup PostgreSQL schema nexus_auth
- [ ] Implementar login/logout básico  
- [ ] JWT generation e validation
- [ ] Middleware auth para outros módulos
- [ ] Frontend login page

### **Fase 2 - Roles & Permissions (Semana 3)**
- [ ] Sistema de roles (admin, manager, employee)
- [ ] Permissões por módulo  
- [ ] CRUD usuários (admin only)
- [ ] Frontend user management

### **Fase 3 - Segurança (Fase 4-5)**
- [ ] Rate limiting para login
- [ ] Auditoria completa
- [ ] Recuperação de senha
- [ ] Session management

### **Futuras Melhorias**
- [ ] 2FA (Two-factor authentication)
- [ ] SSO integration
- [ ] Advanced role hierarchy
- [ ] API keys for integrations