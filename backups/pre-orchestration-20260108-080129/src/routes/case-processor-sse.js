/**
 * Server-Sent Events (SSE) para Progresso em Tempo Real
 *
 * Permite que o frontend receba updates linha a linha durante o processamento
 *
 * @version 1.0.0
 */

import express from 'express';
import progressEmitter from '../utils/progress-emitter.js';

const router = express.Router();

/**
 * GET /api/case-processor/:casoId/stream
 *
 * Stream de Server-Sent Events para acompanhar processamento em tempo real
 *
 * Uso no frontend:
 *
 * const eventSource = new EventSource('/api/case-processor/CASO_123/stream');
 *
 * eventSource.onmessage = (event) => {
 *   const update = JSON.parse(event.data);
 *   console.log(update.type, update.message);
 * };
 *
 * eventSource.addEventListener('complete', (event) => {
 *   console.log('Processamento concluído!');
 *   eventSource.close();
 * });
 */
router.get('/:casoId/stream', (req, res) => {
  const { casoId } = req.params;

  // Configurar headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx

  // Enviar headers imediatamente
  res.flushHeaders();

  console.log(`📡 Cliente conectado ao stream SSE: ${casoId}`);

  // Enviar updates históricos (caso já tenha começado)
  const historicalUpdates = progressEmitter.getSessionUpdates(casoId);
  if (historicalUpdates.length > 0) {
    for (const update of historicalUpdates) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }
  }

  // Listener para novos updates
  const updateListener = ({ casoId: updatedCasoId, update }) => {
    if (updatedCasoId === casoId) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }
  };

  // Listener para conclusão
  const completeListener = ({ casoId: completedCasoId, totalTime, summary }) => {
    if (completedCasoId === casoId) {
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({ totalTime, summary })}\n\n`);

      // Aguardar 1 segundo e fechar conexão
      setTimeout(() => {
        res.end();
      }, 1000);
    }
  };

  // Listener para erro
  const failListener = ({ casoId: failedCasoId, error, totalTime }) => {
    if (failedCasoId === casoId) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error, totalTime })}\n\n`);

      setTimeout(() => {
        res.end();
      }, 1000);
    }
  };

  // Registrar listeners
  progressEmitter.on('update', updateListener);
  progressEmitter.on('session-complete', completeListener);
  progressEmitter.on('session-failed', failListener);

  // Heartbeat para manter conexão viva (a cada 15 segundos)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // Cleanup quando cliente desconectar
  req.on('close', () => {
    console.log(`📡 Cliente desconectado do stream SSE: ${casoId}`);

    clearInterval(heartbeat);
    progressEmitter.off('update', updateListener);
    progressEmitter.off('session-complete', completeListener);
    progressEmitter.off('session-failed', failListener);

    res.end();
  });
});

/**
 * GET /api/case-processor/:casoId/status
 *
 * Obter status atual do processamento (polling fallback)
 */
router.get('/:casoId/status', (req, res) => {
  const { casoId } = req.params;

  const status = progressEmitter.getSessionStatus(casoId);

  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Sessão de processamento não encontrada'
    });
  }

  res.json({
    success: true,
    casoId,
    ...status,
    recentUpdates: progressEmitter.getSessionUpdates(casoId).slice(-10) // Últimas 10
  });
});

/**
 * GET /api/case-processor/:casoId/updates
 *
 * Obter todos os updates de uma sessão
 */
router.get('/:casoId/updates', (req, res) => {
  const { casoId } = req.params;

  const updates = progressEmitter.getSessionUpdates(casoId);

  res.json({
    success: true,
    casoId,
    total: updates.length,
    updates
  });
});

export default router;
