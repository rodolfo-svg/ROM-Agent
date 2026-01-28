import express from 'express';
import { getSSEConnectionManager } from '../utils/sse-connection-manager.js';
import progressEmitter from '../utils/progress-emitter.js';

const router = express.Router();

/**
 * GET /api/upload-progress/:uploadId/progress
 *
 * Stream SSE de progresso para acompanhamento de upload e extração
 *
 * Retorna eventos:
 * - info: Progresso de extração (percent, stage)
 * - session-complete: Upload finalizado com sucesso
 * - session-failed: Erro durante processamento
 */
router.get('/:uploadId/progress', (req, res) => {
  const { uploadId } = req.params;
  const connectionId = `upload_${uploadId}`;
  const sseManager = getSSEConnectionManager();

  console.log(`📡 [SSE] Cliente conectou: ${uploadId}`);

  // Configurar headers SSE + CORS
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Render/Nginx

  // ✨ FIX: Bypass Cloudflare buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders(); // Force immediate header flush

  // ✨ FIX: Headers CORS necessários para EventSource com withCredentials
  const origin = req.headers.origin || 'https://iarom.com.br';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Adicionar conexão ao gerenciador
  sseManager.addConnection(connectionId, res, { uploadId });

  // Enviar histórico de updates já processados (se existir)
  const updates = progressEmitter.getSessionUpdates(uploadId);
  console.log(`📡 [SSE] Enviando ${updates.length} updates históricos para ${uploadId}`);
  for (const update of updates) {
    sseManager.writeEvent(connectionId, null, update);
  }

  // Listener para novos updates em tempo real
  const listener = ({ casoId, update }) => {
    if (casoId === uploadId && sseManager.isActive(connectionId)) {
      sseManager.writeEvent(connectionId, null, update);
    }
  };

  progressEmitter.on('update', listener);

  // Cleanup ao fechar conexão
  req.on('close', () => {
    progressEmitter.off('update', listener);
    sseManager.removeConnection(connectionId);
  });
});

export default router;
