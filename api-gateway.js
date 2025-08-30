const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 5001;

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002', 
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Parse JSON and form data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/ping', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Gateway is running',
    timestamp: new Date().toISOString()
  });
});

// Helper function to proxy requests
const proxyRequest = async (targetUrl, req, res, requireAuth = false) => {
  try {
    // Auth validation if required
    if (requireAuth && req.headers.authorization) {
      const authResponse = await fetch('http://localhost:5003/auth/validate', {
        method: 'GET',
        headers: { 'Authorization': req.headers.authorization }
      });
      
      if (!authResponse.ok) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    console.log(`🔄 Proxy: ${req.method} ${targetUrl}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();
    
    // Forward response headers
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    
    res.status(response.status).send(data);
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    res.status(502).json({ error: 'Service unavailable' });
  }
};

// Auth routes (no auth required)
app.post('/api/auth/login', (req, res) => {
  proxyRequest('http://localhost:5003/auth/login', req, res, false);
});

app.post('/api/auth/register', (req, res) => {
  proxyRequest('http://localhost:5003/auth/register', req, res, false);
});

app.get('/api/auth/validate', (req, res) => {
  proxyRequest('http://localhost:5003/auth/validate', req, res, false);
});

// Protected auth routes (require authentication)
app.get('/api/auth/me', (req, res) => {
  proxyRequest('http://localhost:5003/auth/me', req, res, true);
});

app.patch('/api/auth/profile', (req, res) => {
  proxyRequest('http://localhost:5003/auth/profile', req, res, true);
});

app.patch('/api/auth/password', (req, res) => {
  proxyRequest('http://localhost:5003/auth/password', req, res, true);
});

// Special handling for avatar upload (multipart/form-data)
app.post('/api/auth/avatar', async (req, res) => {
  try {
    // Auth validation
    if (req.headers.authorization) {
      const authResponse = await fetch('http://localhost:5003/auth/validate', {
        method: 'GET',
        headers: { 'Authorization': req.headers.authorization }
      });
      
      if (!authResponse.ok) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    } else {
      return res.status(401).json({ error: 'Authorization required' });
    }

    console.log('🔄 Avatar Upload Proxy: POST http://localhost:5003/auth/avatar');
    
    // Forward the raw request to the service
    const response = await fetch('http://localhost:5003/auth/avatar', {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': req.headers['content-type']
      },
      body: req.body
    });

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    console.error('❌ Avatar upload proxy error:', error.message);
    res.status(502).json({ error: 'Service unavailable' });
  }
});

// Protected routes - Agendamento
app.get('/api/agendamento/calendar', (req, res) => {
  const url = `http://localhost:5002/api/agendamento/calendar${req.url.includes('?') ? req.url.split('?')[1] : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/agendamento/schedule-blocks', (req, res) => {
  const url = `http://localhost:5002/api/agendamento/schedule-blocks${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
  proxyRequest(url, req, res, true);
});

// ================================
// CRM MODULE ROUTES (CRUD COMPLETO)
// ================================

// Customers CRUD
app.get('/api/crm/customers', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5004/api/customers${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/crm/customers/:id', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}`, req, res, true);
});

app.post('/api/crm/customers', (req, res) => {
  proxyRequest('http://localhost:5004/api/customers', req, res, true);
});

app.put('/api/crm/customers/:id', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}`, req, res, true);
});

app.delete('/api/crm/customers/:id', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}`, req, res, true);
});

// Customer Interactions
app.get('/api/crm/customers/:id/interactions', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5004/api/customers/${req.params.id}/interactions${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.post('/api/crm/customers/:id/interactions', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}/interactions`, req, res, true);
});

// Customer Notes
app.get('/api/crm/customers/:id/notes', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}/notes`, req, res, true);
});

app.post('/api/crm/customers/:id/notes', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}/notes`, req, res, true);
});

// Customer Segments
app.get('/api/crm/segments', (req, res) => {
  proxyRequest('http://localhost:5004/api/segments', req, res, true);
});

app.post('/api/crm/segments', (req, res) => {
  proxyRequest('http://localhost:5004/api/segments', req, res, true);
});

// CRM Stats
app.get('/api/crm/stats', (req, res) => {
  proxyRequest('http://localhost:5004/api/stats', req, res, true);
});

// ================================
// SERVICES MODULE ROUTES (CRUD COMPLETO)
// ================================

// Services CRUD
app.get('/api/services', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5005/api/services${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/services/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/services/${req.params.id}`, req, res, true);
});

app.post('/api/services', (req, res) => {
  proxyRequest('http://localhost:5005/api/services', req, res, true);
});

app.put('/api/services/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/services/${req.params.id}`, req, res, true);
});

app.delete('/api/services/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/services/${req.params.id}`, req, res, true);
});

// Professionals CRUD
app.get('/api/services/professionals', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5005/api/professionals${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/services/professionals/list', (req, res) => {
  proxyRequest('http://localhost:5005/api/professionals/list', req, res, true);
});

app.get('/api/services/professionals/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/professionals/${req.params.id}`, req, res, true);
});

app.post('/api/services/professionals', (req, res) => {
  proxyRequest('http://localhost:5005/api/professionals', req, res, true);
});

app.put('/api/services/professionals/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/professionals/${req.params.id}`, req, res, true);
});

app.delete('/api/services/professionals/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/professionals/${req.params.id}`, req, res, true);
});

// Professional Services (relacionamento)
app.get('/api/services/professionals/:id/services', (req, res) => {
  proxyRequest(`http://localhost:5005/api/professionals/${req.params.id}/services`, req, res, true);
});

app.put('/api/services/professionals/:id/services', (req, res) => {
  proxyRequest(`http://localhost:5005/api/professionals/${req.params.id}/services`, req, res, true);
});

// Appointments Completed CRUD
app.get('/api/services/appointments/completed', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5005/api/appointments/completed${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/services/appointments/completed/:id', (req, res) => {
  proxyRequest(`http://localhost:5005/api/appointments/completed/${req.params.id}`, req, res, true);
});

app.post('/api/services/appointments/complete', (req, res) => {
  proxyRequest('http://localhost:5005/api/appointments/complete', req, res, true);
});

// Photo uploads for appointments
app.post('/api/services/appointments/:id/photos', (req, res) => {
  proxyRequest(`http://localhost:5005/api/appointments/${req.params.id}/photos`, req, res, true);
});

// Reports
app.get('/api/services/reports/daily', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5005/api/reports/daily${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/services/reports/professional/:id', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5005/api/reports/professional/${req.params.id}${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

// ================================
// AGENDAMENTO MODULE ROUTES (já existentes + expandidas)
// ================================

app.get('/api/agendamento/calendar', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5002/api/agendamento/calendar${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.get('/api/agendamento/schedule-blocks', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5002/api/agendamento/schedule-blocks${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.post('/api/agendamento/appointments', (req, res) => {
  proxyRequest('http://localhost:5002/api/agendamento/appointments', req, res, true);
});

app.get('/api/agendamento/appointments', (req, res) => {
  const queryString = req.url.split('?')[1] || '';
  const url = `http://localhost:5002/api/agendamento/appointments${queryString ? '?' + queryString : ''}`;
  proxyRequest(url, req, res, true);
});

app.put('/api/agendamento/appointments/:id', (req, res) => {
  proxyRequest(`http://localhost:5002/api/agendamento/appointments/${req.params.id}`, req, res, true);
});

app.delete('/api/agendamento/appointments/:id', (req, res) => {
  proxyRequest(`http://localhost:5002/api/agendamento/appointments/${req.params.id}`, req, res, true);
});

// ================================
// INTEGRATION ROUTES (inter-module communication)
// ================================

// CRM data for other modules
app.get('/api/crm/customers/:id/basic', (req, res) => {
  proxyRequest(`http://localhost:5004/api/customers/${req.params.id}/basic`, req, res, true);
});

// Services data for other modules
app.get('/api/services/list', (req, res) => {
  proxyRequest('http://localhost:5005/api/services/list', req, res, true);
});

// Catch-all for other routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.originalUrl,
    availableModules: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/register', 
        'GET /api/auth/validate',
        'GET /api/auth/me',
        'PATCH /api/auth/profile',
        'PATCH /api/auth/password',
        'POST /api/auth/avatar'
      ],
      crm: [
        'GET /api/crm/customers',
        'POST /api/crm/customers',
        'GET /api/crm/customers/:id',
        'PUT /api/crm/customers/:id',
        'DELETE /api/crm/customers/:id',
        'GET /api/crm/customers/:id/interactions',
        'POST /api/crm/customers/:id/interactions',
        'GET /api/crm/customers/:id/notes',
        'POST /api/crm/customers/:id/notes',
        'GET /api/crm/segments',
        'POST /api/crm/segments',
        'GET /api/crm/stats'
      ],
      services: [
        'GET /api/services',
        'POST /api/services',
        'GET /api/services/:id',
        'PUT /api/services/:id',
        'DELETE /api/services/:id',
        'GET /api/services/professionals',
        'POST /api/services/professionals',
        'GET /api/services/professionals/:id',
        'PUT /api/services/professionals/:id',
        'DELETE /api/services/professionals/:id',
        'GET /api/services/appointments/completed',
        'POST /api/services/appointments/complete',
        'GET /api/services/reports/daily',
        'GET /api/services/reports/professional/:id'
      ],
      agendamento: [
        'GET /api/agendamento/calendar',
        'GET /api/agendamento/schedule-blocks',
        'GET /api/agendamento/appointments',
        'POST /api/agendamento/appointments',
        'PUT /api/agendamento/appointments/:id',
        'DELETE /api/agendamento/appointments/:id'
      ]
    },
    message: 'API Gateway now supports full CRUD operations for CRM, Services and Agendamento modules'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log('✅ Auth routes: /api/auth/* (complete)');
  console.log('✅ CRM routes: /api/crm/* (complete CRUD)');
  console.log('✅ Services routes: /api/services/* (complete CRUD)');
  console.log('✅ Agendamento routes: /api/agendamento/* (complete CRUD)');
  console.log('✅ Integration routes for inter-module communication');
  console.log('🚀 All backend modules are now accessible through this gateway');
});