/**
 * Server-Sent Events (SSE) para Chat em Tempo Real
 *
 * Streaming de respostas AI para experiencia 5-8x mais rapida
 * Time to First Token: <1s (vs 5-10s sem streaming)
 *
 * Features v3.0.0:
 * - Sistema de Memória Hierárquica (3 níveis)
 * - Timeouts expandidos (20 minutos)
 * - Histórico expandido (100 mensagens)
 * - Recuperação de contexto cross-conversacional
 * - Heartbeat seguro com verificacao de conexao
 * - Registro de latencia para metricas
 * - Cleanup automatico de conexoes
 *
 * @version 3.0.0
 * @since WS6 - Advanced Memory System
 */

import express from 'express';
import { conversarStream } from '../modules/bedrock.js';
import { logger } from '../utils/logger.js';
import metricsCollector from '../utils/metrics-collector-v2.js';
import { buildSystemPrompt } from '../server-enhanced.js';
import { getSSEConnectionManager } from '../utils/sse-connection-manager.js';
import conversationMemoryService from '../services/conversation-memory-service.js';
import * as ConversationRepository from '../repositories/conversation-repository.js';
import { estimateTokens, getSafeContextLimit, extractRelevantSections } from '../utils/context-manager.js';
import { selectOptimalModel } from '../utils/model-selector.js'; // ✅ OTIMIZAÇÃO: Seleção automática de modelo

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

    // Extrair conversationId e userId do request
    const conversationId = req.body.conversationId || req.body.conversation_id;
    const userId = req.session?.user?.id || req.body.userId || 'anonymous';

    // Unificar histórico (aceitar messages ou historico)
    const conversationHistory = messages.length > 0 ? messages : historico;

    // ✅ SUPERIOR AO CLAUDE.AI: Limitar para últimas 100 mensagens (vs 30 anterior, vs ~40 claude.ai)
    const limitedHistory = conversationHistory.slice(-100);

    // ✅ OTIMIZAÇÃO DE CUSTO: Seleção automática de modelo baseado na complexidade
    const modelInput = model || modelo;
    let selectedModel;

    if (modelInput) {
      // Se usuário especificou modelo, usar ele
      selectedModel = MODEL_MAPPING[modelInput] || modelInput;
    } else {
      // ✅ NOVO: Seleção inteligente automática (pode economizar 66-97% vs Sonnet)
      const modelSelection = selectOptimalModel(message, {
        maxTokens,
        systemPrompt: systemPrompt || '',
        kbContext: kbContext || ''
      });
      selectedModel = modelSelection.modelId;

      // Log da seleção automática para análise
      logger.info(`[${requestId}] Modelo selecionado automaticamente`, {
        model: modelSelection.modelName,
        reasoning: modelSelection.reasoning,
        estimatedCost: `$${modelSelection.cost}/1M tokens`,
        savings: modelSelection.modelName !== 'sonnet' ? `${Math.round((1 - modelSelection.cost / 3.0) * 100)}% vs Sonnet` : 'baseline'
      });
    }

    // Debug logging removido para producao - use LOG_LEVEL=debug se necessario

    // ✅ SUPERIOR AO CLAUDE.AI: Configurar timeouts expandidos para streaming muito longo
    // Timeout de 20 minutos (vs 10 min anterior) para permitir geração de documentos extensos
    req.setTimeout(1200000); // 20 minutos
    res.setTimeout(1200000); // 20 minutos

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
        // ✅ FLUSH: Garantir que dados sejam enviados imediatamente ao cliente
        // Crítico para SSE em análises longas e prevenir timeout de proxy
        if (typeof res.flush === 'function') {
          res.flush();
        }
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
    // Render tem timeout de proxy HTTP de ~60s
    // ✅ REDUZIDO: 10s → 5s para evitar timeout em análises longas
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
    }, 5000); // ✅ A cada 5s (reduzido de 10s para prevenir timeout de proxy)

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
      // 🎨 STREAMING PROGRESSIVO: Detectar eventos de artifact
      if (typeof chunk === 'object') {
        // 🎨 INÍCIO: Artifact começou a ser gerado
        if (chunk.__artifact_start) {
          logger.info(`[${requestId}] Artifact START:`, chunk.__artifact_start.title);

          safeWrite(`data: ${JSON.stringify({
            type: 'artifact_start',
            artifact: chunk.__artifact_start
          })}\n\n`).catch(err => {
            logger.error(`[${requestId}] Artifact start write failed:`, err.message);
          });

          return;
        }

        // 🎨 CHUNK: Conteúdo progressivo do artifact
        if (chunk.__artifact_chunk) {
          safeWrite(`data: ${JSON.stringify({
            type: 'artifact_chunk',
            id: chunk.__artifact_chunk.id,
            content: chunk.__artifact_chunk.content
          })}\n\n`).catch(err => {
            logger.error(`[${requestId}] Artifact chunk write failed:`, err.message);
          });

          return;
        }

        // 🎨 COMPLETO: Artifact finalizado
        if (chunk.__artifact_complete) {
          logger.info(`[${requestId}] Artifact COMPLETE:`, chunk.__artifact_complete.title, `(${chunk.__artifact_complete.content?.length || 0} chars)`);

          safeWrite(`data: ${JSON.stringify({
            type: 'artifact_complete',
            artifact: chunk.__artifact_complete
          })}\n\n`).catch(err => {
            logger.error(`[${requestId}] Artifact complete write failed:`, err.message);
          });

          return;
        }

        // 🎨 LEGADO: Artifact completo (via create_artifact tool - modo antigo)
        if (chunk.__artifact) {
          logger.info(`[${requestId}] Artifact detected (legacy):`, chunk.__artifact.title);

          safeWrite(`data: ${JSON.stringify({
            type: 'artifact',
            artifact: chunk.__artifact
          })}\n\n`).catch(err => {
            logger.error(`[${requestId}] Artifact write failed:`, err.message);
          });

          return;
        }
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

    // ✅ AUTO-DETECÇÃO: Identificar se é pedido de redação de peça ou chat
    const detectIfPecaRequest = (msg) => {
      const lowerMessage = msg.toLowerCase();

      // Verbos de ação para redação (prioridade alta) - incluir infinitivos
      const actionVerbs = ['redija', 'redigir', 'elabore', 'elaborar', 'escreva', 'escrever', 'crie', 'criar', 'draft', 'faça', 'fazer', 'prepare', 'preparar'];
      const hasActionVerb = actionVerbs.some(verb => lowerMessage.includes(verb));

      // Tipos de peças jurídicas
      const pecaTypes = [
        'petição', 'peça', 'contrato', 'recurso',
        'apelação', 'agravo', 'inicial',
        'mandado', 'habeas corpus', 'embargos',
        'parecer', 'memorial'
      ];
      const hasPecaType = pecaTypes.some(type => lowerMessage.includes(type));

      // PRIORIDADE 1: Se tem verbo de ação + tipo de peça = definitivamente redação
      if (hasActionVerb && hasPecaType) {
        return true;
      }

      // PRIORIDADE 2: Se tem verbo de ação forte sozinho = redação
      if (hasActionVerb) {
        return true;
      }

      // PRIORIDADE 3: Se tem tipo de peça sem verbo = pode ser redação implícita
      // Ex: "preciso de uma petição", "faça um contrato"
      const implicitActionWords = ['preciso de', 'necessito', 'quero', 'gostaria de'];
      const hasImplicitAction = implicitActionWords.some(word => lowerMessage.includes(word));
      if (hasImplicitAction && hasPecaType) {
        return true;
      }

      // Palavras de pergunta indicam chat (verificar depois das ações)
      const questionWords = ['qual', 'como', 'quando', 'onde', 'por que', 'porque', 'o que', 'quem', 'explique'];
      const isQuestion = questionWords.some(word => lowerMessage.startsWith(word));

      // Se é claramente uma pergunta sem verbos de ação = chat
      if (isQuestion) return false;

      return false;
    };

    const isPecaRequest = detectIfPecaRequest(message);

    // Detectar se usuário quer recuperar informações de conversas anteriores
    const detectRecallIntent = (msg) => {
      const lower = msg.toLowerCase();

      // Palavras-chave que indicam intenção de recuperação
      const recallKeywords = [
        'lembr', 'relemb', 'record', // lembre, relembre, recordar
        'mencionou', 'mencionei', 'mencionamos',
        'falamos', 'discutimos', 'conversamos',
        'aquele', 'aquela', 'aquilo', // referência a algo anterior
        'anterior', 'passado', 'outro dia',
        'já', 'antes', 'previamente',
        'me ajude a', 'qual era', 'quem era',
        'retomar', 'voltar', 'revisar'
      ];

      return recallKeywords.some(keyword => lower.includes(keyword));
    };

    const hasRecallIntent = detectRecallIntent(message);

    // ✅ SUPERIOR AO CLAUDE.AI: Construir contexto hierárquico com memória de 3 níveis
    let hierarchicalContext = null;
    let additionalContext = '';

    // 🔥 CRÍTICO: Construir contexto APENAS quando:
    // 1. É continuação de conversa existente (conversationId exists)
    // 2. OU usuário pede explicitamente para recuperar informações (hasRecallIntent)
    const shouldBuildContext = (conversationId || hasRecallIntent);

    if (userId !== 'anonymous' && shouldBuildContext) {
      try {
        logger.debug(`[${requestId}] Construindo contexto hierárquico...`);
        hierarchicalContext = await conversationMemoryService.buildHierarchicalContext(
          conversationId,  // Pode ser null para novas conversas
          userId,
          message
        );

        // Formatar contexto adicional para incluir no prompt
        additionalContext = conversationMemoryService.formatContextForPrompt(hierarchicalContext);

        logger.info(`[${requestId}] Contexto hierárquico construído`, {
          stats: hierarchicalContext.stats
        });
      } catch (error) {
        logger.error(`[${requestId}] Erro ao construir contexto hierárquico`, {
          error: error.message
        });
        // Continuar sem contexto hierárquico em caso de erro
      }
    }

    // ✅ PERFORMANCE: Truncar contextos muito grandes para prevenir timeouts e OOM
    const safeLimit = getSafeContextLimit(selectedModel);
    let truncatedKbContext = kbContext;
    let truncatedAdditionalContext = additionalContext;

    // Truncar KB context se necessário
    if (kbContext) {
      const kbTokens = estimateTokens(kbContext);
      if (kbTokens > safeLimit * 0.4) { // Max 40% do limite para KB
        logger.warn(`[${requestId}] KB context muito grande (${kbTokens} tokens), truncando para ${Math.floor(safeLimit * 0.4)} tokens`);
        const extracted = extractRelevantSections(kbContext, message, Math.floor(safeLimit * 0.4));
        truncatedKbContext = extracted.content;
      }
    }

    // Truncar additional context se necessário
    if (additionalContext) {
      const additionalTokens = estimateTokens(additionalContext);
      if (additionalTokens > safeLimit * 0.2) { // Max 20% do limite para contexto hierárquico
        logger.warn(`[${requestId}] Additional context muito grande (${additionalTokens} tokens), truncando`);
        truncatedAdditionalContext = additionalContext.substring(0, Math.floor(safeLimit * 0.2 * 3.5));
      }
    }

    // ✅ CRÍTICO: Usar systemPrompt com instruções de ferramentas se não vier do frontend
    // 🔧 IMPORTANTE: Passar context correto para garantir que Custom Instructions sejam aplicadas
    let finalSystemPrompt = systemPrompt || buildSystemPrompt({
      userMessage: message,
      context: {
        type: isPecaRequest ? 'peca' : 'chat'  // ✅ Detecção automática do tipo
      },
      partnerId: req.session?.user?.partnerId || 'rom'
    });

    // Adicionar contexto hierárquico ao system prompt se disponível
    if (truncatedAdditionalContext) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n${truncatedAdditionalContext}`;
    }

    // Executar streaming (sem timeout - permitir documentos grandes)
    const resultado = await conversarStream(message, onChunk, {
      modelo: selectedModel,
      systemPrompt: finalSystemPrompt,  // ✅ Sempre usar systemPrompt (com instruções de ferramentas)
      historico: limitedHistory, // Usar histórico limitado
      kbContext: truncatedKbContext, // ✅ Usar contexto truncado para performance
      maxTokens,
      temperature,
      enableTools: true,  // ✅ CRÍTICO: Habilitar ferramentas (jurisprudência, KB, CNJ, súmulas)
      userId: userId  // 🔥 FIX CRÍTICO: Passar userId para que arquivos gerados tenham userId correto
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
        memory: hierarchicalContext?.stats || null,
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

      // 🔥 CRÍTICO: Salvar conversa e mensagens no banco para memória de longo prazo
      if (userId && userId !== 'anonymous') {
        try {
          let finalConversationId = conversationId;

          // Se não existe conversationId, criar nova conversa
          if (!conversationId) {
            // Gerar título baseado na primeira mensagem
            const title = message.length > 50 ? message.substring(0, 50) + '...' : message;

            const newConv = await ConversationRepository.createConversation({
              userId: userId,  // ✅ FIX: Corrigido de user_id para userId
              title: title,
              model: resultado.modelo || selectedModel
            });

            finalConversationId = newConv.id;

            logger.info(`[${requestId}] Nova conversa criada: ${finalConversationId}`);
          }

          // Salvar mensagem do usuário
          await ConversationRepository.addMessage({
            conversationId: finalConversationId,  // ✅ FIX: Corrigido de conversation_id para conversationId
            role: 'user',
            content: message
          });

          // Salvar resposta do assistente
          await ConversationRepository.addMessage({
            conversationId: finalConversationId,  // ✅ FIX: Corrigido de conversation_id para conversationId
            role: 'assistant',
            content: fullResponse
          });

          logger.debug(`[${requestId}] Mensagens salvas: conversationId=${finalConversationId}`);

        } catch (saveError) {
          // Log do erro mas não falhar o request
          logger.error(`[${requestId}] Erro ao salvar conversa`, {
            error: saveError.message,
            userId,
            conversationId
          });
        }
      }

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
