/**
 * API ROUTES - SCHEDULER
 * Endpoints para monitoramento do scheduler de jobs
 *
 * @version 1.0.0
 */

import express from 'express';
import { scheduler } from '../src/jobs/scheduler.js';

const router = express.Router();

/**
 * GET /api/scheduler/status
 * Retorna status do scheduler e jobs agendados
 */
router.get('/scheduler/status', (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Erro ao obter status do scheduler:', error);
    res.status(500).json({
      error: error.message,
      ativo: false
    });
  }
});

/**
 * GET /api/scheduler/jobs
 * Lista todos os jobs agendados
 */
router.get('/scheduler/jobs', (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json({
      jobs: status.jobs || [],
      total: (status.jobs || []).length
    });
  } catch (error) {
    console.error('Erro ao listar jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
