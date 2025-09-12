import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { NoteController } from '../controllers/noteController';
import { InteractionController } from '../controllers/interactionController';

const router = Router();
const customerController = new CustomerController();
const noteController = new NoteController();
const interactionController = new InteractionController();

// Authentication is handled by API Gateway - no middleware needed here

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  router.use((req: any, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - User: ${req.user?.userId}`);
    next();
  });
}

// GET /api/customers/check-document - ROTA ESPECÍFICA ANTES DA PARAMETRIZADA
router.get('/check-document', customerController.checkDocument);

// GET /api/customers/search - ROTA ESPECÍFICA ANTES DA PARAMETRIZADA
router.get('/search', customerController.searchCustomers);

// GET /api/customers/tags - ROTA ESPECÍFICA ANTES DA PARAMETRIZADA
router.get('/tags', customerController.getCustomerTags);

// GET /api/customers
router.get('/', customerController.getCustomers);

// POST /api/customers - ROTA PRINCIPAL DE TESTE
router.post('/', customerController.createCustomer);

// GET /api/customers/:id - ROTA PARAMETRIZADA POR ÚLTIMO
router.get('/:id', customerController.getCustomerById);

// PUT /api/customers/:id
router.put('/:id', customerController.updateCustomer);

// DELETE /api/customers/:id
router.delete('/:id', customerController.deleteCustomer);

// GET /api/customers/:id/history
router.get('/:id/history', customerController.getCustomerHistory);

// POST /api/customers/:id/tags
router.post('/:id/tags', customerController.addTags);

// DELETE /api/customers/:id/tags
router.delete('/:id/tags', customerController.removeTags);

// GET /api/customers/:id/notes - Obter notas do cliente
router.get('/:id/notes', noteController.getNotes);

// GET /api/customers/:id/interactions - Obter interações do cliente
router.get('/:id/interactions', interactionController.getInteractions);

// GET /api/customers/:id/appointments - Placeholder para agendamentos do cliente
router.get('/:id/appointments', (req, res) => {
  const { id } = req.params;
  console.log(`[${new Date().toISOString()}] GET /api/customers/${id}/appointments - Placeholder endpoint`);
  
  res.json({
    success: true,
    data: [],
    message: 'Endpoint de agendamentos em desenvolvimento. Funcionalidade será integrada com o módulo de agendamento.',
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    }
  });
});

export default router;