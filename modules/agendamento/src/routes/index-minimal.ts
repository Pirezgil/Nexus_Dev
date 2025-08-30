import { Router } from 'express';

const router = Router();

// Teste simples
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Minimal route test working!', 
    timestamp: new Date().toISOString(),
    path: req.path,
    query: req.query
  });
});

// Rota de calendário simples (sem autenticação para teste)
router.get('/calendar', (req, res) => {
  res.json({
    success: true,
    message: 'Calendar route working!',
    query: req.query,
    data: {
      view: req.query.view || 'week',
      date: req.query.date || new Date().toISOString().split('T')[0],
      appointments: [],
      message: 'This is a test response - calendar service is reachable'
    }
  });
});

export default router;