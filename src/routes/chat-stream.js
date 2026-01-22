/**
 * Server-Sent Events (SSE) para Chat em Tempo Real
 *
 * Streaming de respostas AI para experiencia 5-8x mais rapida
 * Time to First Token: <1s (vs 5-10s sem streaming)
 *
 * Features v2.8.0:
 * - Heartbeat seguro com verificacao de conexao
 * - Registro de latencia para metricas
 * - Cleanup automatico de conexoes
 *
 * @version 2.8.0
 * @since WS5 - SSE Streaming Optimization
 */

import express from 'express';
import { conversarStream } from '../modules/bedrock.js';
import { logger } from '../utils/logger.js';
import metricsCollector from '../utils/metrics-collector-v2.js';
import { buildSystemPrompt } from '../server-enhanced.js';
import { getSSEConnectionManager } from '../utils/sse-connection-manager.js';

const router = express.Router();
const sseManager = getSSEConnectionManager();

// Mapeamento de modelos curtos para IDs completos do Bedrock
const MODEL_MAPPING = {
  'claude-opus-4.5': 'anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-opus-4': 'anthropic.claude-opus-4-20250514-v1:0',
  'claude-sonnet-4.5': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  'claude-sonnet-4-5': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  'claude-sonnet-4': 'anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-haiku-4.5': 'anthropic.claude-haiku-4-5-20251001-v1:0',
  'claude-3.5-sonnet': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'claude-3.5-haiku': 'anthropic.claude-3-5-haiku-20241022-v1:0',
};

/**
 * POST /api/chat/stream
 *
 * Envia mensagem e recebe resposta em streaming via SSE
 *
 * Body:
 * {
 *   "message": "Sua pergunta aqui",
 *   "modelo": "anthropic.claude-sonnet-4-5-20250929-v1:0", // opcional
 *   "systemPrompt": "Você é um assistente...", // opcional
 *   "historico": [{role: "user", content: "..."}], // opcional
 *   "kbContext": "Contexto da base de conhecimento...", // opcional
 *   "maxTokens": 4000, // opcional
 *   "temperature": 0.7 // opcional
 * }
 *
 * Resposta SSE:
 * - event: chunk -> { type: "chunk", content: "..." }
 * - event: complete -> { type: "complete", modelo: "...", tokensUsados: 123 }
 * - event: error -> { type: "error", error: "..." }
 *
 * Uso no frontend:
 *
 * fetch('/api/chat/stream', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ message: 'Olá' })
 * }).then(response => {
 *   const reader = response.body.getReader();
 *   const decoder = new TextDecoder();
 *
 *   function read() {
 *     reader.read().then(({ done, value }) => {
 *       if (done) return;
 *
 *       const chunk = decoder.decode(value);
 *       const lines = chunk.split('\n');
 *
 *       for (const line of lines) {
 *         if (line.startsWith('data: ')) {
 *           const data = JSON.parse(line.slice(6));
 *           if (data.type === 'chunk') {
 *             // Mostrar chunk na UI
 *             appendToChat(data.content);
 *           }
 *         }
 *       }
 *
 *       read();
 *     });
 *   }
 *
 *   read();
 * });
 */
router.post('/stream', async (req, res) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let heartbeatInterval = null; // Declarar fora do try para cleanup no catch

  try {
    const {
      message,
      modelo,
      model, // Aceitar tanto 'modelo' quanto 'model'
      systemPrompt,
      historico = [],
      messages = [], // Aceitar tanto 'historico' quanto 'messages'
      kbContext = '',
      maxTokens,
      temperature
    } = req.body;

    // Validações
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Campo "message" é obrigatório e deve ser uma string'
      });
    }

    // Unificar histórico (aceitar messages ou historico)
    const conversationHistory = messages.length > 0 ? messages : historico;

    // Limitar para últimas 30 mensagens (contexto otimizado)
    const limitedHistory = conversationHistory.slice(-30);

    // Usar model ou modelo e mapear para ID completo do Bedrock
    const modelInput = model || modelo;
    const selectedModel = MODEL_MAPPING[modelInput] || modelInput;

    // Debug logging removido para producao - use LOG_LEVEL=debug se necessario

    // Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx bypass buffer
    res.flushHeaders(); // Enviar headers imediatamente

    logger.info(`[${requestId}] Chat stream iniciado`, {
      modelo: selectedModel || 'default',
      messageLength: message.length,
      kbContextLength: kbContext.length,
      historicoSize: limitedHistory.length,
      historicoOriginalSize: conversationHistory.length
    });

    // ✅ CORREÇÃO: Write queue para prevenir race condition heartbeat/chunks
    const writeQueue = [];
    let isWriting = false;

    const safeWrite = (data) => {
      return new Promise((resolve) => {
        writeQueue.push({ data, resolve });
        processWriteQueue();
      });
    };

    const processWriteQueue = () => {
      if (isWriting || writeQueue.length === 0) return;
      if (res.writableEnded || res.destroyed) {
        // Limpar queue se conexão morreu
        writeQueue.length = 0;
        return;
      }

      isWriting = true;
      const { data, resolve } = writeQueue.shift();

      try {
        res.write(data);
        resolve(true);
      } catch (err) {
        logger.error(`[${requestId}] Write failed:`, err.message);
        resolve(false);
      }

      isWriting = false;
      // Processar próximo item imediatamente
      if (writeQueue.length > 0) {
        setImmediate(processWriteQueue);
      }
    };

    // Enviar evento de início
    await safeWrite(`data: ${JSON.stringify({
      type: 'start',
      requestId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Heartbeat para manter conexao viva - COM VERIFICACAO DE CONEXAO
    // IMPORTANTE: Cloudflare tem timeout HTTP/2 de ~2min (120s)
    // Enviar heartbeat frequente para evitar ERR_HTTP2_PROTOCOL_ERROR
    heartbeatInterval = setInterval(() => {
      // SEGURANCA: Verificar se conexao ainda esta viva antes de escrever
      if (res.writableEnded || res.destroyed || res.socket?.destroyed) {
        logger.debug(`[${requestId}] Connection detected as closed during heartbeat`);
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        return;
      }

      // Usar safeWrite para evitar race condition
      safeWrite(`: heartbeat ${Date.now()}\n\n`).catch(err => {
        logger.error(`[${requestId}] Heartbeat write failed:`, err.message);
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      });
    }, 10000); // A cada 10s (antes era 15s)

    // Cleanup heartbeat ao finalizar
    const cleanupHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    // Variáveis para tracking
    let fullResponse = '';
    let chunkCount = 0;
    let firstTokenTime = null;

    // Callback para cada chunk
    const onChunk = (chunk) => {
      // 🎨 ESPECIAL: Detectar artifact object
      if (typeof chunk === 'object' && chunk.__artifact) {
        logger.info(`[${requestId}] Artifact detected:`, chunk.__artifact.title);

        // Enviar artifact como evento SSE especial
        safeWrite(`data: ${JSON.stringify({
          type: 'artifact',
          artifact: chunk.__artifact
        })}\n\n`).catch(err => {
          logger.error(`[${requestId}] Artifact write failed:`, err.message);
        });

        return; // Não processar como chunk normal
      }

      // Chunk normal (string)
      if (!firstTokenTime) {
        firstTokenTime = Date.now();
        const ttft = firstTokenTime - startTime; // Time To First Token

        logger.info(`[${requestId}] First token received`, {
          ttft: `${ttft}ms`,
          chunkLength: chunk.length
        });

        // Metrica: Time To First Token
        metricsCollector.recordTTFT(ttft, selectedModel || 'default');

        // Registrar latencia no SSEConnectionManager para metricas globais
        sseManager.recordLatency(ttft);
      }

      fullResponse += chunk;
      chunkCount++;

      // SEGURANCA: Verificar se conexao ainda esta viva antes de escrever
      if (res.writableEnded || res.destroyed) {
        return;
      }

      // Enviar chunk via SSE usando write queue
      safeWrite(`data: ${JSON.stringify({
        type: 'chunk',
        content: chunk,
        chunkIndex: chunkCount
      })}\n\n`).catch(err => {
        logger.error(`[${requestId}] Chunk write failed:`, err.message);
      });
    };

    // ✅ CRÍTICO: Usar systemPrompt com instruções de ferramentas se não vier do frontend
    const finalSystemPrompt = systemPrompt || buildSystemPrompt();

    // Executar streaming
    const resultado = await conversarStream(message, onChunk, {
      modelo: selectedModel,
      systemPrompt: finalSystemPrompt,  // ✅ Sempre usar systemPrompt (com instruções de ferramentas)
      historico: limitedHistory, // Usar histórico limitado
      kbContext,
      maxTokens,
      temperature,
      enableTools: true  // ✅ CRÍTICO: Habilitar ferramentas (jurisprudência, KB, CNJ, súmulas)
    });

    const totalTime = Date.now() - startTime;

    // Limpar heartbeat
    cleanupHeartbeat();

    if (resultado.sucesso) {
      // Enviar evento de conclusão
      res.write(`event: complete\n`);
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        requestId,
        modelo: resultado.modelo,
        totalChunks: chunkCount,
        responseLength: fullResponse.length,
        metrics: {
          totalTime: `${totalTime}ms`,
          ttft: firstTokenTime ? `${firstTokenTime - startTime}ms` : null,
          avgChunkTime: chunkCount > 0 ? `${Math.round((totalTime - (firstTokenTime - startTime)) / chunkCount)}ms` : null
        },
        timestamp: new Date().toISOString()
      })}\n\n`);

      logger.info(`[${requestId}] Chat stream completed`, {
        totalTime: `${totalTime}ms`,
        ttft: firstTokenTime ? `${firstTokenTime - startTime}ms` : null,
        totalChunks: chunkCount,
        responseLength: fullResponse.length,
        modelo: resultado.modelo
      });

      // Métrica: Streaming success
      metricsCollector.incrementCounter('chat_stream_success', {
        modelo: resultado.modelo || 'unknown'
      });
      metricsCollector.recordLatency('chat_stream', totalTime, resultado.modelo || 'unknown');

    } else {
      // Enviar evento de erro
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: resultado.erro || 'Erro desconhecido',
        requestId,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      })}\n\n`);

      logger.error(`[${requestId}] Chat stream failed`, {
        error: resultado.erro,
        totalTime: `${totalTime}ms`,
        modelo: resultado.modelo
      });

      // Métrica: Streaming failure
      metricsCollector.incrementCounter('chat_stream_error', {
        modelo: resultado.modelo || 'unknown',
        error_type: resultado.erro || 'unknown'
      });
    }

    // Fechar conexão
    res.end();

  } catch (error) {
    const totalTime = Date.now() - startTime;

    // Limpar heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    logger.error(`[${requestId}] Chat stream exception`, {
      error: error.message,
      stack: error.stack,
      totalTime: `${totalTime}ms`
    });

    // Tentar enviar erro via SSE (se conexão ainda estiver aberta)
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
        requestId,
        totalTime: `${totalTime}ms`,
        timestamp: new Date().toISOString()
      })}\n\n`);
      res.end();
    } catch (writeError) {
      // Conexão já foi fechada, apenas logar
      logger.error(`[${requestId}] Failed to send error via SSE`, {
        error: writeError.message
      });
    }

    // Métrica: Streaming exception
    metricsCollector.incrementCounter('chat_stream_exception', {
      error_type: error.name || 'unknown'
    });
  }
});

/**
 * GET /api/chat/stream/health
 *
 * Health check para streaming endpoint com metricas SSE
 */
router.get('/stream/health', (req, res) => {
  const sseMetrics = sseManager.getMetrics();
  const latencyStats = sseManager.getLatencyStats();

  res.json({
    success: true,
    status: 'operational',
    features: ['sse', 'streaming', 'real-time-chat', 'safe-heartbeat', 'ttl-connections'],
    version: '2.8.0',
    sse: {
      activeConnections: sseMetrics.activeConnections,
      totalConnections: sseMetrics.totalConnections,
      heartbeatsSent: sseMetrics.heartbeatsSent,
      heartbeatsFailed: sseMetrics.heartbeatsFailed,
      latency: latencyStats ? {
        avg: `${Math.round(latencyStats.avg)}ms`,
        p50: `${latencyStats.p50}ms`,
        p95: `${latencyStats.p95}ms`,
        p99: `${latencyStats.p99}ms`,
        samples: latencyStats.count
      } : null
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
