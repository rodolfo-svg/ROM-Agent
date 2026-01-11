/**
 * Server-Sent Events (SSE) para Progresso em Tempo Real
 *
 * Permite que o frontend receba updates linha a linha durante o processamento
 *
 * Features v2.0.0:
 * - SSEConnectionManager para gerenciamento centralizado
 * - Heartbeat seguro com verificacao de conexao
 * - TTL automatico e cleanup
 *
 * @version 2.0.0
 * @since WS5 - SSE Streaming Optimization
 */

import express from 'express';
import progressEmitter from '../utils/progress-emitter.js';
import { getSSEConnectionManager } from '../utils/sse-connection-manager.js';

const router = express.Router();
const sseManager = getSSEConnectionManager();

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
  const connectionId = `case_${casoId}_${Date.now()}`;

  // Usar SSEConnectionManager para gerenciar conexao
  const connection = sseManager.addConnection(connectionId, res, { casoId });

  console.log(`[CaseProcessor-SSE] Cliente conectado: ${connectionId}`);

  // Enviar updates historicos (caso ja tenha comecado)
  const historicalUpdates = progressEmitter.getSessionUpdates(casoId);
  if (historicalUpdates.length > 0) {
    for (const update of historicalUpdates) {
      sseManager.writeEvent(connectionId, null, update);
    }
  }

  // Listener para novos updates
  const updateListener = ({ casoId: updatedCasoId, update }) => {
    if (updatedCasoId === casoId && sseManager.isActive(connectionId)) {
      sseManager.writeEvent(connectionId, null, update);
      // Renovar TTL a cada update
      sseManager.renewTTL(connectionId);
    }
  };

  // Listener para conclusao
  const completeListener = ({ casoId: completedCasoId, totalTime, summary }) => {
    if (completedCasoId === casoId && sseManager.isActive(connectionId)) {
      sseManager.writeEvent(connectionId, 'complete', { totalTime, summary });

      // Aguardar 1 segundo e fechar conexao
      setTimeout(() => {
        sseManager.removeConnection(connectionId);
      }, 1000);
    }
  };

  // Listener para erro
  const failListener = ({ casoId: failedCasoId, error, totalTime }) => {
    if (failedCasoId === casoId && sseManager.isActive(connectionId)) {
      sseManager.writeEvent(connectionId, 'error', { error, totalTime });

      setTimeout(() => {
        sseManager.removeConnection(connectionId);
      }, 1000);
    }
  };

  // Registrar listeners
  progressEmitter.on('update', updateListener);
  progressEmitter.on('session-complete', completeListener);
  progressEmitter.on('session-failed', failListener);

  // Cleanup quando cliente desconectar
  req.on('close', () => {
    console.log(`[CaseProcessor-SSE] Cliente desconectado: ${connectionId}`);

    progressEmitter.off('update', updateListener);
    progressEmitter.off('session-complete', completeListener);
    progressEmitter.off('session-failed', failListener);

    sseManager.removeConnection(connectionId);
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
