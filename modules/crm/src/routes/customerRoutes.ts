import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';

const router = Router();
const customerController = new CustomerController();

// Mock user para desenvolvimento (simula usuário autenticado)
router.use((req: any, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Body:', req.body);
  req.user = {
    userId: 'user-dev-001',
    companyId: 'company-dev-001',
    email: 'dev@nexuserp.com'
  };
  next();
});

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

export default router;