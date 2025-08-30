import express from 'express';

const app = express();
const PORT = process.env.PORT || 5002;

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Nexus Agendamento',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Agendamento service is running'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Agendamento Service started on port ${PORT}`);
});

console.log('App started successfully');