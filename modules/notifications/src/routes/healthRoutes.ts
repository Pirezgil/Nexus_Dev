import { Router, Request, Response } from 'express';
import { config } from '../utils/config';

const router = Router();

interface HealthStatus {
  status: 'OK' | 'ERROR';
  service: string;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
}

// Basic health check
router.get('/', (req: Request, res: Response) => {
  const healthStatus: HealthStatus = {
    status: 'OK',
    service: 'nexus-notifications',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
    uptime: Math.floor(process.uptime()),
  };

  res.status(200).json(healthStatus);
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const healthStatus: HealthStatus = {
    status: 'OK',
    service: 'nexus-notifications',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
    uptime: Math.floor(process.uptime()),
  };

  res.status(200).json(healthStatus);
});

export { router as healthRoutes };