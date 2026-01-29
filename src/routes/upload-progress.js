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

/**
 * GET /api/upload-progress/:uploadId/status
 *
 * Endpoint REST para polling de progresso (fallback quando SSE falha)
 * Retorna o estado atual da sessão de progresso
 */
router.get('/:uploadId/status', (req, res) => {
  const { uploadId } = req.params;

  console.log(`📊 [POLLING] Status solicitado: ${uploadId}`);

  // Obter updates da sessão
  const updates = progressEmitter.getSessionUpdates(uploadId);
  const sessionStatus = progressEmitter.getSessionStatus(uploadId);

  // Se sessão não existe, retornar estado inicial
  if (!sessionStatus) {
    return res.json({
      percent: 0,
      stage: 'Aguardando...',
      currentFile: 0,
      totalFiles: 0,
      fileName: '',
      completed: false,
      result: null
    });
  }

  // Encontrar último update relevante
  const lastUpdate = updates[updates.length - 1];

  // Determinar se completou
  const completed = sessionStatus.status === 'completed' || sessionStatus.status === 'failed';

  // Buscar dados do último update
  const progressData = lastUpdate?.data || {};

  res.json({
    percent: progressData.percent || 0,
    stage: lastUpdate?.message || 'Processando...',
    currentFile: progressData.currentFile || 0,
    totalFiles: progressData.totalFiles || 0,
    fileName: progressData.fileName || '',
    completed,
    result: completed ? progressData : null,
    status: sessionStatus.status
  });
});

export default router;
