/**
 * Deploy Routes
 * Endpoints para gerenciamento de deploys automáticos
 */

import express from 'express';
import { deployJob } from '../src/jobs/deploy-job.js';
import { logger } from '../src/utils/logger.js';

const router = express.Router();

/**
 * GET /deploy/status
 * Status do deploy atual
 */
router.get('/deploy/status', (req, res) => {
  try {
    const status = deployJob.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting deploy status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /deploy/history
 * Histórico de deploys
 */
router.get('/deploy/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await deployJob.getHistory(limit);
    res.json({ history });
  } catch (error) {
    logger.error('Error getting deploy history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /deploy/execute
 * Executa deploy manual
 */
router.post('/deploy/execute', async (req, res) => {
  try {
    // Executa em background e retorna imediatamente
    deployJob.execute().catch(error => {
      logger.error('Erro no deploy manual:', error);
    });

    res.json({
      success: true,
      message: 'Deploy iniciado em background. Use /api/deploy/status para acompanhar.'
    });
  } catch (error) {
    logger.error('Error executing deploy:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
