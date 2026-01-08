import express from 'express';
import { healthMonitor } from '../monitoring/health-check.js';

const router = express.Router();

// Health check básico
router.get('/health', async (req, res) => {
  const status = await healthMonitor.getFullStatus();
  const httpStatus = status.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(status);
});

// Metrics detalhado
router.get('/health/metrics', async (req, res) => {
  const status = await healthMonitor.getFullStatus();
  res.json({
    ...status,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
