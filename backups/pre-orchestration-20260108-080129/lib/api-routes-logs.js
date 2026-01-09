/**
 * Logs Routes
 * Endpoints para acesso aos logs do sistema
 */

import express from 'express';
import { logger } from '../src/utils/logger.js';

const router = express.Router();

/**
 * GET /logs
 * Retorna logs do sistema
 */
router.get('/logs', async (req, res) => {
  try {
    const date = req.query.date || null;
    const logs = await logger.getLogs(date);
    res.json({ logs });
  } catch (error) {
    logger.error('Error getting logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /logs/files
 * Lista arquivos de log disponíveis
 */
router.get('/logs/files', async (req, res) => {
  try {
    const files = await logger.listLogFiles();
    res.json({ files });
  } catch (error) {
    logger.error('Error listing log files:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
