/**
 * ROM Agent - Módulo AWS Bedrock
 * Integração com modelos de IA da AWS (Claude, Nova, Llama, etc)
 *
 * @version 1.0.0
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand
} from '@aws-sdk/client-bedrock';

// Validar credenciais AWS no startup
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('❌ AWS credentials not configured! Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
}

// Integração com ROM Tools (KB, Jurisprudência, CNJ)
import { BEDROCK_TOOLS, executeTool } from './bedrock-tools.js';

// Context Manager para limitação inteligente de tokens
import contextManager from '../utils/context-manager.js';

// Loop Guardrails para prevenção de loops infinitos
import { loopGuardrails } from '../utils/loop-guardrails.js';

// Retry logic with exponential backoff
import { retryAwsCommand } from '../utils/retry-with-backoff.js';

// Bottleneck para controle de concorrência e fila
import bottleneck from '../utils/bottleneck.js';

// Resilient Invoke: Circuit Breaker + Fallback + Retry + Bottleneck
import { resilientInvoke } from '../utils/resilient-invoke.js';

// Multi-Level Cache for 10-50x performance improvement
import { getCache } from '../utils/multi-level-cache.js';

// Model Capabilities Detection para multi-model compatibility
import { shouldEnableTools, getToolsUnavailableMessage, getModelCapabilities } from '../utils/model-capabilities.js';

// v2.9.0: Stub metrics para monitoramento (metrics module pode nao existir ainda)
const metrics = {
  incrementTotalRequests: () => {},
  observeToolLoops: () => {},
  incrementForcedPresentations: () => {},
  observeSseStreamingTime: (ms) => console.log(`[Metrics] SSE time: ${ms}ms`)
};

// ============================================================
// CONFIGURAÇÃO
// ============================================================

/**
 * Seleciona modelo padrão baseado no ambiente
 * - STAGING: Opus 4.5 (máxima qualidade para testes e desenvolvimento)
 * - PRODUCTION: Sonnet 4.5 (melhor custo-benefício)
 * - DEVELOPMENT: Sonnet 4.5 (padrão)
 */
function getDefaultModel() {
  const env = process.env.NODE_ENV?.toLowerCase() || 'development';
  const forceModel = process.env.DEFAULT_AI_MODEL;

  // Se houver modelo forçado via env var, usar ele
  if (forceModel) {
    console.log(`🎯 Usando modelo forçado via DEFAULT_AI_MODEL: ${forceModel}`);
    return forceModel;
  }

  // STAGING: Usar Opus 4.5 (máxima qualidade)
  if (env === 'staging' || process.env.RENDER_SERVICE_NAME?.includes('staging')) {
    console.log('🚀 STAGING detectado: usando Claude Opus 4.5 (máxima qualidade)');
    return 'us.anthropic.claude-opus-4-5-20251101-v1:0';
  }

  // PRODUCTION e DEVELOPMENT: Usar Sonnet 4.5 (custo-benefício)
  console.log(`📊 ${env.toUpperCase()}: usando Claude Sonnet 4.5 (custo-benefício)`);
  return 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
}

const CONFIG = {
  region: process.env.AWS_REGION || 'us-west-2',
  defaultModel: getDefaultModel(),
  maxTokens: 64000,  // 64K tokens output (limite do Bedrock para Sonnet/Opus 4.5)
  temperature: 0.7,
  autoModelSelection: true,  // Habilitar seleção automática de modelo
  maxContextTokens: 200000  // Limite de contexto de entrada (200k tokens - Sonnet/Opus 4.5)
};

// Modelos disponíveis organizados por provedor
export const MODELOS_BEDROCK = {
  amazon: {
    'nova-premier': 'amazon.nova-premier-v1:0',
    'nova-pro': 'amazon.nova-pro-v1:0',
    'nova-lite': 'amazon.nova-lite-v1:0',
    'nova-micro': 'amazon.nova-micro-v1:0',
    'titan-text': 'amazon.titan-text-express-v1'
  },
  anthropic: {
    'claude-opus-4.5': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    'claude-opus-4': 'us.anthropic.claude-opus-4-20250514-v1:0',
    'claude-sonnet-4.5': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    'claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'claude-haiku-4.5': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    'claude-3.7-sonnet': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    'claude-3.5-sonnet': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    'claude-3.5-haiku': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'claude-3-opus': 'us.anthropic.claude-3-opus-20240229-v1:0',
    'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
    'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0'
  },
  meta: {
    'llama-4-scout': 'meta.llama4-scout-17b-instruct-v1:0',
    'llama-4-maverick': 'meta.llama4-maverick-17b-instruct-v1:0',
    'llama-3.3-70b': 'meta.llama3-3-70b-instruct-v1:0',
    'llama-3.2-90b': 'meta.llama3-2-90b-instruct-v1:0',
    'llama-3.2-11b': 'meta.llama3-2-11b-instruct-v1:0',
    'llama-3.1-70b': 'meta.llama3-1-70b-instruct-v1:0',
    'llama-3.1-8b': 'meta.llama3-1-8b-instruct-v1:0'
  },
  mistral: {
    'mistral-large-3': 'mistral.mistral-large-3-675b-instruct',
    'pixtral-large': 'mistral.pixtral-large-2502-v1:0',
    'ministral-14b': 'mistral.ministral-3-14b-instruct',
    'ministral-8b': 'mistral.ministral-3-8b-instruct'
  },
  deepseek: {
    'r1': 'deepseek.r1-v1:0',
    'deepseek-r1': 'deepseek.r1-v1:0'
  },
  cohere: {
    'command-r-plus': 'cohere.command-r-plus-v1:0',
    'command-r': 'cohere.command-r-v1:0'
  }
};

// Inference Profiles para modelos que requerem
export const INFERENCE_PROFILES = {
  // Meta Llama
  'meta.llama3-3-70b-instruct-v1:0': 'us.meta.llama3-3-70b-instruct-v1:0',
  'meta.llama3-2-90b-instruct-v1:0': 'us.meta.llama3-2-90b-instruct-v1:0',
  'meta.llama3-2-11b-instruct-v1:0': 'us.meta.llama3-2-11b-instruct-v1:0',
  'meta.llama3-1-70b-instruct-v1:0': 'us.meta.llama3-1-70b-instruct-v1:0',
  'meta.llama3-1-8b-instruct-v1:0': 'us.meta.llama3-1-8b-instruct-v1:0',
  'meta.llama4-scout-17b-instruct-v1:0': 'us.meta.llama4-scout-17b-instruct-v1:0',
  'meta.llama4-maverick-17b-instruct-v1:0': 'us.meta.llama4-maverick-17b-instruct-v1:0',

  // Anthropic Claude (modelos que requerem inference profile)
  'anthropic.claude-3-opus-20240229-v1:0': 'us.anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0': 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-7-sonnet-20250219-v1:0': 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  'anthropic.claude-sonnet-4-20250514-v1:0': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'anthropic.claude-opus-4-20250514-v1:0': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'anthropic.claude-opus-4-5-20251101-v1:0': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',

  // Mapeamentos simplificados para compatibilidade com frontend (usando hífens)
  'claude-opus-4-5': 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-opus-4': 'us.anthropic.claude-opus-4-20250514-v1:0',
  'claude-sonnet-4-5': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'claude-sonnet-4': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-haiku-4-5': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',

  // Amazon Nova
  'amazon.nova-premier-v1:0': 'us.amazon.nova-premier-v1:0',
  'amazon.nova-pro-v1:0': 'us.amazon.nova-pro-v1:0',
  'amazon.nova-lite-v1:0': 'us.amazon.nova-lite-v1:0',
  'amazon.nova-micro-v1:0': 'us.amazon.nova-micro-v1:0',

  // DeepSeek
  'deepseek.r1-v1:0': 'us.deepseek.r1-v1:0',

  // Mistral
  'mistral.mistral-large-3-675b-instruct': 'us.mistral.mistral-large-3-675b-instruct',
  'mistral.pixtral-large-2502-v1:0': 'us.mistral.pixtral-large-2502-v1:0'
};

// ============================================================
// CLIENTE BEDROCK
// ============================================================

let runtimeClient = null;
let managementClient = null;

function getBedrockRuntimeClient() {
  if (!runtimeClient) {
    runtimeClient = new BedrockRuntimeClient({ region: CONFIG.region });
  }
  return runtimeClient;
}

function getBedrockManagementClient() {
  if (!managementClient) {
    managementClient = new BedrockClient({ region: CONFIG.region });
  }
  return managementClient;
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Envia mensagem para modelo Bedrock usando a API Converse
 * @param {string} prompt - Mensagem do usuário
 * @param {object} options - Opções de configuração
 * @returns {Promise<object>} Resposta do modelo
 */
export async function conversar(prompt, options = {}) {
  const {
    modelo = CONFIG.defaultModel,
    systemPrompt = null,
    historico = [],
    maxTokens = CONFIG.maxTokens,
    temperature = CONFIG.temperature,
    topP = 0.9,
    enableTools = true,  // ← NOVO: habilitar tools por padrão
    kbContext = '',  // ← NOVO: contexto do KB para cálculo de tokens
    enableCache = true,  // ← v2.7.0: Enable cache (default true)
    cacheType = 'simple'  // ← v2.7.0: Cache type (simple, jurisprudence, legislation, templates)
  } = options;

  // 🔥 v2.7.0: CACHE CHECK (10-50x faster on hits)
  if (enableCache && !enableTools) { // Only cache non-tool responses
    const cache = getCache();
    const cacheKey = cache.generateKey(prompt, modelo, { temperature, maxTokens });

    const cached = await cache.get(cacheKey, cacheType);
    if (cached) {
      console.log(`💾 [Cache HIT] Returning cached response`);
      return {
        ...cached,
        fromCache: true
      };
    }
  }

  const client = getBedrockRuntimeClient();

  // 🔥 TRUNCAR HISTÓRICO PARA EVITAR "Input is too long"
  // Calcular limite baseado no modelo específico (cada modelo tem limite diferente)
  const safeLimit = contextManager.getSafeContextLimit(modelo); // 70% do limite do modelo

  const truncatedHistory = contextManager.truncateHistory(
    historico,
    safeLimit,  // Limite seguro baseado no modelo específico
    kbContext,
    prompt
  );

  // 🔥 CONCATENAR KB CONTEXT DEPOIS DO TRUNCAMENTO
  const finalPrompt = kbContext ? prompt + '\n\n' + kbContext : prompt;

  // Construir mensagens iniciais
  const initialMessages = [
    ...truncatedHistory.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }]
    })),
    {
      role: 'user',
      content: [{ text: finalPrompt }]  // 🔥 Usar prompt final com KB
    }
  ];

  // Configurar inferência
  const modeloId = INFERENCE_PROFILES[modelo] || modelo;
  const isClaude45 = modeloId.includes('claude-haiku-4-5') ||
                     modeloId.includes('claude-sonnet-4-5') ||
                     modeloId.includes('claude-opus-4-5');

  const inferenceConfig = isClaude45
    ? { maxTokens }
    : { maxTokens, temperature, topP };

  try {
    // ═══════════════════════════════════════════════════════════
    // LOOP DE TOOL USE
    // ═══════════════════════════════════════════════════════════
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Inicializar guardrails para esta conversação
    loopGuardrails.initConversation(conversationId);

    let currentMessages = initialMessages;
    let loopCount = 0;
    const MAX_LOOPS = 100;  // Aumentado de 10 para 100 para análises exaustivas (BACKSPEC BETA)
    let totalTokensUsed = { input: 0, output: 0 };
    const toolsUsed = [];

    while (loopCount < MAX_LOOPS) {
      // Montar comando
      const commandParams = {
        modelId: INFERENCE_PROFILES[modelo] || modelo,
        messages: currentMessages,
        inferenceConfig
      };

      // Adicionar system prompt with caching (v2.7.0)
      if (systemPrompt) {
        const usePromptCaching = options.enablePromptCaching !== false; // Default true
        const systemPromptLength = systemPrompt.length;
        const shouldCache = usePromptCaching && systemPromptLength > 1024; // Only cache if >1024 chars

        if (shouldCache) {
          // Use prompt caching for large system prompts (90% cost reduction)
          commandParams.system = [{
            text: systemPrompt,
            cacheControl: { type: 'ephemeral' } // Cache for 5 minutes
          }];
          console.log(`💰 [Prompt Caching] ENABLED for system prompt (${systemPromptLength} chars)`);
        } else {
          commandParams.system = [{ text: systemPrompt }];
        }
      }

      // 🔥 v2.7.0: KB Context with Prompt Caching
      if (kbContext && kbContext.length > 2048) {
        // Add KB as separate system message with caching
        if (!commandParams.system) {
          commandParams.system = [];
        }
        commandParams.system.push({
          text: `# Knowledge Base Context\n\n${kbContext}`,
          cacheControl: { type: 'ephemeral' } // Cache KB for 5 minutes
        });
        console.log(`💰 [Prompt Caching] ENABLED for KB context (${kbContext.length} chars)`);
      }

      // ✅ NOVO v2.8.0: Multi-model compatibility - verificar se modelo suporta tool use
      const actualModelId = INFERENCE_PROFILES[modelo] || modelo;
      const toolsEnabled = shouldEnableTools(actualModelId, enableTools);

      if (toolsEnabled) {
        commandParams.toolConfig = { tools: BEDROCK_TOOLS };
      } else if (loopCount === 0 && enableTools && !getModelCapabilities(actualModelId).toolUse) {
        // Log apenas na primeira iteração se modelo não suporta tools
        console.log(`⚠️ [Converse] Tools DISABLED - modelo não suporta tool use`);
      }

      const command = new ConverseCommand(commandParams);

      // Envolver com resilientInvoke: Circuit Breaker + Fallback + Retry + Bottleneck
      const response = await resilientInvoke(client, command, {
        modelId: commandParams.modelId,
        operation: 'converse',
        requestId: options.conversationId || `conv_${Date.now()}`,
        loopIteration: loopCount,
        enableFallback: true,
        enableCircuitBreaker: true
      });

      // Acumular uso de tokens
      totalTokensUsed.input += response.usage.inputTokens;
      totalTokensUsed.output += response.usage.outputTokens;

      // ────────────────────────────────────────────────────────
      // VERIFICAR SE MODELO QUER USAR TOOL
      // ────────────────────────────────────────────────────────
      if (response.stopReason === 'tool_use') {
        const toolUses = response.output.message.content.filter(c => c.toolUse);

        // Adicionar mensagem do assistente (com tool_use)
        currentMessages.push(response.output.message);

        // Executar cada tool solicitada
        const toolResults = [];
        for (const toolUseBlock of toolUses) {
          const { toolUseId, name, input } = toolUseBlock.toolUse;

          // ──────────────────────────────────────────────────────
          // GUARDRAIL: Verificar antes de executar tool
          // ──────────────────────────────────────────────────────
          const guardrailCheck = loopGuardrails.trackToolUse(conversationId, name);

          if (!guardrailCheck.allowed) {
            console.error(`🛡️ [Guardrail] ${guardrailCheck.reason.toUpperCase()} - Bloqueando execução`);

            // Adicionar mensagem de erro como resultado da tool
            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{
                  text: `[GUARDRAIL ATIVADO] ${guardrailCheck.message}`
                }]
              }
            });

            // Forçar fim do loop
            loopCount = MAX_LOOPS;
            break;
          }

          console.log(`🔧 [Tool Use] ${name}:`, JSON.stringify(input, null, 2));
          toolsUsed.push({ name, input });

          try {
            const result = await executeTool(name, input);

            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{
                  text: result.success ? result.content : `Erro: ${result.error || result.content}`
                }]
              }
            });

            console.log(`✅ [Tool Use] ${name} executada com sucesso`);
          } catch (error) {
            console.error(`❌ [Tool Use] Erro ao executar ${name}:`, error);

            toolResults.push({
              toolResult: {
                toolUseId,
                content: [{ text: `Erro ao executar tool: ${error.message}` }]
              }
            });
          }
        }

        // Adicionar resultados das tools como nova mensagem do user
        currentMessages.push({
          role: 'user',
          content: toolResults
        });

        loopCount++;
        continue;  // Fazer nova chamada com os resultados
      }

      // ────────────────────────────────────────────────────────
      // MODELO NÃO QUER MAIS USAR TOOLS - RETORNAR RESPOSTA
      // ────────────────────────────────────────────────────────
      const content = response.output.message.content[0];
      let resposta = '';
      let raciocinio = null;

      if (content.text) {
        // Resposta normal (Claude, Nova, Llama, etc)
        resposta = content.text;
      } else if (content.reasoningContent) {
        // Modelo de raciocínio (DeepSeek R1)
        raciocinio = content.reasoningContent.reasoningText?.text || '';
        resposta = raciocinio;
      }

      // Cleanup guardrails após conversação bem-sucedida
      loopGuardrails.cleanupConversation(conversationId);

      const resultadoFinal = {
        sucesso: true,
        resposta,
        raciocinio,
        modelo,
        uso: {
          tokensEntrada: totalTokensUsed.input,
          tokensSaida: totalTokensUsed.output,
          tokensTotal: totalTokensUsed.input + totalTokensUsed.output
        },
        toolsUsadas: toolsUsed.length > 0 ? toolsUsed : undefined,  // ← NOVO
        latencia: response.metrics?.latencyMs || null,
        motivoParada: response.stopReason,
        guardrailStats: loopGuardrails.getStats(conversationId)  // ← NOVO: stats do guardrail
      };

      // 🔥 v2.7.0: CACHE STORE (only if tools weren't used)
      if (enableCache && toolsUsed.length === 0) {
        const cache = getCache();
        const cacheKey = cache.generateKey(prompt, modelo, { temperature, maxTokens });
        await cache.set(cacheKey, resultadoFinal, cacheType);
        console.log(`💾 [Cache SET] Stored response in cache (type: ${cacheType})`);
      }

      return resultadoFinal;
    }

    // Se chegou ao limite de loops
    throw new Error(`Limite de tool use loops atingido (${MAX_LOOPS} iterações)`);

  } catch (error) {
    console.error('❌ [Bedrock] Erro na conversação:', error);

    // Preservar propriedades do erro (statusCode, retryAfter, etc) no objeto de retorno
    return {
      sucesso: false,
      erro: error?.message || 'Erro ao processar conversa',
      statusCode: Number.isInteger(error?.statusCode)
        ? error.statusCode
        : (Number.isInteger(error?.status) ? error.status : undefined),
      retryAfter: error?.retryAfter,
      // Campos auxiliares para debug
      errorName: error?.name,
      errorCode: error?.code,
      modelo
    };
  }
}

/**
 * Envia mensagem com streaming
 * @param {string} prompt - Mensagem do usuário
 * @param {function} onChunk - Callback para cada chunk
 * @param {object} options - Opções de configuração
 */
export async function conversarStream(prompt, onChunk, options = {}) {
  const {
    modelo = CONFIG.defaultModel,
    systemPrompt = null,
    historico = [],
    maxTokens = CONFIG.maxTokens,
    temperature = CONFIG.temperature,
    kbContext = '',  // ← NOVO: contexto do KB para cálculo de tokens
    enableTools = true  // ✅ NOVO: Habilitar ferramentas por padrão (jurisprudência, KB, CNJ)
  } = options;

  console.log('🚀 [conversarStream] STARTED with:', {
    promptLength: prompt?.length || 0,
    hasSystemPrompt: !!systemPrompt,
    systemPromptLength: systemPrompt?.length || 0,
    modelo,
    historicoLength: historico?.length || 0,
    kbContextLength: kbContext?.length || 0,
    enableTools,
    maxTokens,
    temperature,
    hasOnChunkCallback: typeof onChunk === 'function'
  });

  if (!systemPrompt) {
    console.warn('⚠️ [conversarStream] WARNING: systemPrompt is NULL! Model may not respond correctly.');
  }

  const client = getBedrockRuntimeClient();

  // 🔥 TRUNCAR HISTÓRICO PARA EVITAR "Input is too long"
  // Calcular limite baseado no modelo específico (cada modelo tem limite diferente)
  const safeLimit = contextManager.getSafeContextLimit(modelo); // 70% do limite do modelo

  const truncatedHistory = contextManager.truncateHistory(
    historico,
    safeLimit,  // Limite seguro baseado no modelo específico
    kbContext,
    prompt
  );

  // Log apenas em desenvolvimento (removido debug verboso para producao)

  // 🔥 CONCATENAR KB CONTEXT DEPOIS DO TRUNCAMENTO
  const finalPrompt = kbContext ? prompt + '\n\n' + kbContext : prompt;

  const messages = [
    ...truncatedHistory.map(msg => ({
      role: msg.role,
      content: [{ text: msg.content }]
    })),
    {
      role: 'user',
      content: [{ text: finalPrompt }]  // 🔥 Usar prompt final com KB
    }
  ];


  const commandParams = {
    modelId: INFERENCE_PROFILES[modelo] || modelo,
    messages,
    inferenceConfig: { maxTokens, temperature }
  };

  // Adicionar system prompt with caching (v2.7.0)
  if (systemPrompt) {
    const usePromptCaching = options.enablePromptCaching !== false; // Default true
    const shouldCache = usePromptCaching && systemPrompt.length > 1024;

    if (shouldCache) {
      commandParams.system = [{
        text: systemPrompt,
        cacheControl: { type: 'ephemeral' }
      }];
      console.log(`💰 [Stream] Prompt Caching ENABLED (${systemPrompt.length} chars)`);
    } else {
      commandParams.system = [{ text: systemPrompt }];
    }
  }

  // KB Context caching
  if (kbContext && kbContext.length > 2048) {
    if (!commandParams.system) {
      commandParams.system = [];
    }
    commandParams.system.push({
      text: `# Knowledge Base Context\n\n${kbContext}`,
      cacheControl: { type: 'ephemeral' }
    });
    console.log(`💰 [Stream] KB Cache ENABLED (${kbContext.length} chars)`);
  }

  // ✅ NOVO v2.7.2: Adicionar ferramentas (jurisprudência, KB, CNJ, súmulas)
  // ✅ NOVO v2.8.0: Multi-model compatibility - verificar se modelo suporta tool use
  const actualModelId = INFERENCE_PROFILES[modelo] || modelo;
  const modelCapabilities = getModelCapabilities(actualModelId);
  const toolsEnabled = shouldEnableTools(actualModelId, enableTools);

  if (toolsEnabled) {
    commandParams.toolConfig = { tools: BEDROCK_TOOLS };
    console.log(`🔧 [Stream] Tools ENABLED (${BEDROCK_TOOLS.length} ferramentas | ${modelCapabilities.provider})`);
  } else {
    if (enableTools && !modelCapabilities.toolUse) {
      // Usuário queria tools, mas modelo não suporta
      console.log(`⚠️ [Stream] Tools DISABLED - modelo ${modelCapabilities.provider} não suporta tool use`);
      console.log(`💡 [Stream] Use Claude Sonnet/Opus ou Amazon Nova Pro para busca automática`);
    } else {
      console.log(`🔧 [Stream] Tools DISABLED (desabilitado pelo usuário)`);
    }
  }

  try {
    // ✅ NOVO v2.8.0: Informar usuário se tools estão indisponíveis devido ao modelo
    if (enableTools && !modelCapabilities.toolUse) {
      const warningMessage = getToolsUnavailableMessage(actualModelId);
      if (warningMessage) {
        onChunk(warningMessage + '\n\n');
      }
    }

    let currentMessages = messages;
    let loopCount = 0;
    const MAX_TOOL_LOOPS = 2; // ✅ v2.9.0: 1 busca + 1 apresentação IMEDIATA (-75% latência SSE)
    let hasJurisprudenceResults = false;

    // v2.9.0: Metricas de performance SSE
    const streamStartTime = Date.now();
    metrics.incrementTotalRequests();

    while (loopCount < MAX_TOOL_LOOPS) {
      // 🔄 v2.9.0: Logging melhorado para rastreamento de loops
      console.log(`🔄 [Loop ${loopCount + 1}/${MAX_TOOL_LOOPS}] Processing tool results...`);

      if (loopCount >= MAX_TOOL_LOOPS - 1) {
        console.log(`⚠️ [MAX_LOOPS REACHED] Forcing presentation now (loopCount=${loopCount})`);
      }

      const command = new ConverseStreamCommand({ ...commandParams, messages: currentMessages });
      const response = await retryAwsCommand(client, command, { modelId: commandParams.modelId, operation: 'converse_stream' });

      let textoCompleto = '';
      let stopReason = null;
      let toolUseData = [];
      let currentToolUse = null;
      let eventCount = 0;

      console.log(`🔄 [Stream Loop ${loopCount}] Starting to process Bedrock stream...`);

      // Processar stream de eventos
      for await (const event of response.stream) {
        eventCount++;

        // ✅ DEBUG: Log TODOS os eventos recebidos do Bedrock
        if (eventCount <= 3 || eventCount % 10 === 0) {
          console.log(`📦 [Stream Loop ${loopCount}] Event #${eventCount}:`, Object.keys(event));
        }

        // Texto sendo gerado
        if (event.contentBlockDelta?.delta?.text) {
          const chunk = event.contentBlockDelta.delta.text;
          textoCompleto += chunk;

          console.log(`📝 [Stream Loop ${loopCount}] Text chunk received (${chunk.length} chars)`);

          // ✅ CORREÇÃO: Try/catch para prevenir stream quebrado
          try {
            onChunk(chunk);
            console.log(`   ✅ onChunk() called successfully`);
          } catch (err) {
            console.error('[Bedrock Stream] onChunk falhou:', err.message);
            // Abortar stream se callback falhou (conexão SSE morreu)
            break;
          }
        }

        // Início de tool use
        if (event.contentBlockStart?.start?.toolUse) {
          currentToolUse = {
            toolUseId: event.contentBlockStart.start.toolUse.toolUseId,
            name: event.contentBlockStart.start.toolUse.name,
            input: ''
          };
        }

        // Input da tool sendo streamed
        if (event.contentBlockDelta?.delta?.toolUse) {
          if (currentToolUse) {
            currentToolUse.input += event.contentBlockDelta.delta.toolUse.input || '';
          }
        }

        // Fim do tool use block
        if (event.contentBlockStop && currentToolUse) {
          try {
            currentToolUse.input = JSON.parse(currentToolUse.input);
          } catch (e) {
            // Input já está parseado ou não é JSON
          }
          toolUseData.push(currentToolUse);
          currentToolUse = null;
        }

        // ✅ CORREÇÃO: stopReason está em messageStop, não em metadata
        if (event.messageStop) {
          stopReason = event.messageStop.stopReason;
        }
      }

      console.log(`🏁 [Stream Loop ${loopCount}] Stream processing completed:`, {
        eventCount,
        textoCompletoLength: textoCompleto.length,
        stopReason,
        toolUseDataCount: toolUseData.length
      });

      // Se não foi tool_use, retornar resposta final
      if (stopReason !== 'tool_use' || toolUseData.length === 0) {
        console.log(`✅ [Stream] Returning final response (no tool use). Length: ${textoCompleto.length}`);

        if (textoCompleto.length === 0) {
          console.error(`⚠️ [Stream] WARNING: textoCompleto is EMPTY! This should not happen.`);
          console.error(`   stopReason: ${stopReason}`);
          console.error(`   eventCount: ${eventCount}`);
          console.error(`   toolUseData: ${toolUseData.length}`);
        }

        return {
          sucesso: true,
          resposta: textoCompleto,
          modelo
        };
      }

      // ✅ Executar ferramentas solicitadas
      console.log(`🔧 [Stream] Tool use detected: ${toolUseData.map(t => t.name).join(', ')}`);

      // ⚡ CRÍTICO: Enviar feedback IMEDIATO para o usuário não ficar esperando
      const toolNames = toolUseData.map(t => {
        if (t.name === 'pesquisar_jurisprudencia') return '🔍 Buscando jurisprudência';
        if (t.name === 'pesquisar_jusbrasil') return '📚 Consultando JusBrasil';
        if (t.name === 'consultar_cnj_datajud') return '🏛️ Consultando CNJ DataJud';
        if (t.name === 'pesquisar_sumulas') return '📋 Buscando súmulas';
        if (t.name === 'consultar_kb') return '💾 Consultando base de conhecimento';
        if (t.name === 'pesquisar_doutrina') return '📚 Buscando doutrina jurídica';
        return `⚙️ ${t.name}`;
      }).join(', ');

      onChunk(`\n\n${toolNames}...\n\n`);

      // Adicionar mensagem do assistente com tool_use
      const assistantMessage = {
        role: 'assistant',
        content: toolUseData.map(t => ({
          toolUse: {
            toolUseId: t.toolUseId,
            name: t.name,
            input: t.input
          }
        }))
      };
      currentMessages.push(assistantMessage);

      // Executar cada ferramenta e adicionar resultados
      const toolResults = [];
      let previewShown = false;

      for (const tool of toolUseData) {
        console.log(`🔧 Executando ferramenta: ${tool.name}`);

        // ⚡ FEEDBACK: Informar ao usuário que a ferramenta está sendo executada
        const toolStartMsg = tool.name === 'pesquisar_jurisprudencia' ? '⏳ Consultando tribunais...' :
                            tool.name === 'pesquisar_jusbrasil' ? '⏳ Acessando JusBrasil...' :
                            tool.name === 'consultar_cnj_datajud' ? '⏳ Acessando DataJud...' :
                            tool.name === 'pesquisar_sumulas' ? '⏳ Buscando súmulas...' :
                            tool.name === 'consultar_kb' ? '⏳ Consultando documentos...' :
                            `⏳ Executando ${tool.name}...`;
        onChunk(toolStartMsg);

        try {
          const result = await executeTool(tool.name, tool.input);

          // 🎨 ESPECIAL: Se for create_artifact, enviar evento especial para o frontend
          if (tool.name === 'create_artifact' && result.success && result.artifact) {
            console.log(`📄 [Stream] Artifact detectado: "${result.artifact.title}"`);

            // Enviar artifact como objeto especial (não string)
            // O chat-stream.js vai detectar e enviar como evento SSE tipo "artifact"
            try {
              onChunk({ __artifact: result.artifact });
            } catch (err) {
              console.error('[Bedrock Stream] Erro ao enviar artifact:', err.message);
            }
          }

          // ⚡ FEEDBACK: Informar resultado da ferramenta
          const successMsg = result.success ? ' ✓\n' : ' ✗\n';
          onChunk(successMsg);

          // ⚡ DETECTAR se encontrou jurisprudência - para forçar apresentação imediata
          if (result.success && (tool.name === 'pesquisar_jurisprudencia' || tool.name === 'pesquisar_sumulas' || tool.name === 'pesquisar_doutrina')) {
            // Verificar se tem resultados reais (não vazio)
            const hasResults = result.content && (
              result.content.includes('**[1]') || // Formato de resultado
              result.content.includes('Resultados:') ||
              result.content.length > 500 // Content substancial
            );
            if (hasResults) {
              hasJurisprudenceResults = true;
              console.log(`✅ [Stream] Jurisprudência encontrada em ${tool.name} - apresentação será forçada`);
            }
          }

          // ⚡ PREVIEW IMEDIATO: Mostrar primeiros resultados assim que chegam (anti-silêncio)
          if (!previewShown && result.success && result.content && tool.name === 'pesquisar_jurisprudencia') {
            const previewMatch = result.content.match(/\*\*\[1\]\s+(.{0,150})/);
            if (previewMatch) {
              onChunk(`\n💡 Preview: ${previewMatch[1]}...\n`);
              previewShown = true;
            }
          }

          toolResults.push({
            toolResult: {
              toolUseId: tool.toolUseId,
              content: [{
                text: result.success ? result.content : `Erro: ${result.error || result.content}`
              }]
            }
          });
          console.log(`✅ Ferramenta ${tool.name} executada com sucesso`);
        } catch (error) {
          console.error(`❌ Erro ao executar ${tool.name}:`, error);
          onChunk(' ✗ (erro)\n');
          toolResults.push({
            toolResult: {
              toolUseId: tool.toolUseId,
              content: [{
                text: `Erro ao executar ferramenta: ${error.message}`
              }]
            }
          });
        }
      }

      // Adicionar resultados das ferramentas às mensagens
      currentMessages.push({
        role: 'user',
        content: toolResults
      });

      // ⚡ STREAMING FORÇADO: Enviar header para forçar Claude a começar a escrever
      onChunk(`✅ Pesquisa concluída.\n\n📊 **Resultados Encontrados:**\n\n`);

      loopCount++;

      // 🚨 v2.9.0: VELOCIDADE CRÍTICA - Com MAX_TOOL_LOOPS=2, forçamos apresentação após 1 busca
      // Loop 0 -> busca -> loopCount++ = 1 -> shouldForcePresentation = TRUE (1 >= 2-1)
      // Isso elimina 75% da latência SSE (de 24-30s para 6-8s)
      const shouldForcePresentation = hasJurisprudenceResults || loopCount >= (MAX_TOOL_LOOPS - 1);

      if (shouldForcePresentation) {
        const reason = hasJurisprudenceResults ?
          `✅ Jurisprudência encontrada após ${loopCount} loop(s) - APRESENTAÇÃO IMEDIATA para velocidade` :
          `⚠️ MAX_TOOL_LOOPS atingido (${loopCount}/${MAX_TOOL_LOOPS}) - FORÇANDO apresentação`;
        console.log(`[Stream] ${reason}`);

        // v2.9.0: Registrar metricas de apresentacao forcada
        metrics.observeToolLoops(loopCount);
        metrics.incrementForcedPresentations();

        // Adicionar mensagem IMPERATIVA para forçar Claude a apresentar
        currentMessages.push({
          role: 'user',
          content: [{
            text: `🚨 IMPERATIVO CRÍTICO - APRESENTAÇÃO OBRIGATÓRIA

Você executou ${loopCount} buscas de jurisprudência. As ferramentas retornaram resultados COMPLETOS nas mensagens acima.

═══════════════════════════════════════════════════════════════
AGORA você DEVE IMEDIATAMENTE:
═══════════════════════════════════════════════════════════════

1. APRESENTAR TODOS os resultados encontrados (súmulas, decisões, temas, IRDR, teses jurisprudenciais, acórdãos, doutrina)

2. Para CADA resultado encontrado nas ferramentas acima, escreva:
   📋 **[Número] Título/Ementa**
   Tribunal: [tribunal]
   Data: [data se disponível]
   Tipo: [súmula/decisão/tese/IRDR/doutrina]
   Ementa: [resumo da ementa - MÍNIMO 2 linhas]
   Link: [URL completo]

3. ORGANIZE por relevância e tipo

4. Após listar TODOS os resultados, faça uma ANÁLISE JURÍDICA respondendo à pergunta do usuário com base nos resultados

═══════════════════════════════════════════════════════════════
PROIBIÇÕES ABSOLUTAS:
═══════════════════════════════════════════════════════════════

❌ NÃO execute mais buscas
❌ NÃO diga "não encontrei resultados" (você JÁ encontrou!)
❌ NÃO resuma em 1 linha (detalhe CADA resultado)
❌ NÃO omita nenhum resultado encontrado

═══════════════════════════════════════════════════════════════

COMECE AGORA escrevendo "Com base nas buscas realizadas, encontrei:" e LISTE IMEDIATAMENTE o primeiro resultado!`
          }]
        });

        // Executar UMA última iteração APENAS para apresentação
        // ⚠️ IMPORTANTE: Manter MESMAS tools (não remover) pois mensagens anteriores têm toolUse blocks
        // A mensagem imperativa do user vai PROIBIR Claude de usar tools, mesmo que estejam disponíveis
        const finalCommand = new ConverseStreamCommand({
          ...commandParams,
          messages: currentMessages
          // toolConfig mantém o mesmo de commandParams (com todas as tools)
        });
        const finalResponse = await retryAwsCommand(client, finalCommand, { modelId: commandParams.modelId, operation: 'converse_stream' });

        let finalText = '';
        for await (const event of finalResponse.stream) {
          if (event.contentBlockDelta?.delta?.text) {
            const chunk = event.contentBlockDelta.delta.text;
            finalText += chunk;
            onChunk(chunk);
          }
        }

        // v2.9.0: Registrar tempo total de streaming SSE
        const streamTotalTime = Date.now() - streamStartTime;
        metrics.observeSseStreamingTime(streamTotalTime);
        console.log(`📊 [Metrics] SSE streaming completed in ${streamTotalTime}ms (loops: ${loopCount})`);

        return {
          sucesso: true,
          resposta: finalText,
          modelo,
          streamingTimeMs: streamTotalTime,
          loopsExecutados: loopCount
        };
      }
      // Loop continua para próxima iteração
    }

    // Se chegou aqui sem stopReason, retornar erro
    console.error(`❌ [Stream] Loop terminou sem resposta final`);
    return {
      sucesso: false,
      erro: 'Sistema atingiu limite de iterações sem gerar resposta',
      modelo
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      modelo
    };
  }
}

/**
 * Lista modelos disponíveis na conta
 */
export async function listarModelos() {
  const client = getBedrockManagementClient();

  try {
    const command = new ListFoundationModelsCommand({});
    const response = await retryAwsCommand(client, command, { operation: 'list_foundation_models' });

    return response.modelSummaries.map(model => ({
      id: model.modelId,
      nome: model.modelName,
      provedor: model.providerName,
      modalidades: model.inputModalities,
      streaming: model.responseStreamingSupported
    }));
  } catch (error) {
    return { erro: error.message };
  }
}

/**
 * Lista inference profiles ativos
 */
export async function listarInferenceProfiles() {
  const client = getBedrockManagementClient();

  try {
    const command = new ListInferenceProfilesCommand({});
    const response = await retryAwsCommand(client, command, { operation: 'list_inference_profiles' });

    return response.inferenceProfileSummaries.map(profile => ({
      id: profile.inferenceProfileId,
      nome: profile.inferenceProfileName,
      status: profile.status,
      tipo: profile.type
    }));
  } catch (error) {
    return { erro: error.message };
  }
}

// ============================================================
// FUNÇÕES ESPECÍFICAS PARA ROM AGENT
// ============================================================

/**
 * Gera texto jurídico usando Bedrock
 * @param {string} tipo - Tipo de peça (peticao_inicial, habeas_corpus, etc)
 * @param {string} contexto - Contexto/fatos do caso
 * @param {object} options - Opções adicionais
 */
export async function gerarTextoJuridico(tipo, contexto, options = {}) {
  const systemPrompt = `Você é o ROM - Redator de Obras Magistrais, um assistente jurídico especializado em redação de peças processuais brasileiras.

REGRAS OBRIGATÓRIAS:
- NUNCA use emojis
- NUNCA use markdown
- Use formatação profissional para documentos jurídicos
- Cite legislação e jurisprudência quando aplicável
- Siga a estrutura técnica adequada ao tipo de peça
- Use linguagem formal e técnica do direito brasileiro`;

  const prompt = `Elabore uma ${tipo} com base no seguinte contexto:

${contexto}

Siga a estrutura técnica adequada e inclua fundamentação legal e jurisprudencial.`;

  return conversar(prompt, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

/**
 * Analisa processo judicial
 */
export async function analisarProcesso(documentos, options = {}) {
  const systemPrompt = `Você é um analista jurídico especializado. Analise os documentos do processo e forneça:
1. Resumo dos fatos
2. Partes envolvidas
3. Pedidos/pretensões
4. Fundamentos jurídicos
5. Pontos críticos
6. Sugestões de estratégia`;

  return conversar(documentos, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

/**
 * Análise jurídica profunda com DeepSeek R1 (modelo de raciocínio)
 * Ideal para: teses complexas, análise de precedentes, fundamentação
 */
export async function analisarComRaciocinio(questao, options = {}) {
  const systemPrompt = `Você é um jurista brasileiro especializado em análise jurídica profunda.
Analise a questão apresentada com raciocínio detalhado, considerando:
1. Legislação aplicável (CF, códigos, leis especiais)
2. Jurisprudência relevante (STF, STJ, tribunais estaduais)
3. Doutrina majoritária
4. Argumentos favoráveis e contrários
5. Conclusão fundamentada

Seja preciso nas citações legais e jurisprudenciais.`;

  const resultado = await conversar(questao, {
    ...options,
    systemPrompt,
    modelo: 'deepseek.r1-v1:0',
    maxTokens: options.maxTokens || 2000
  });

  return {
    ...resultado,
    tipo: 'analise_raciocinio',
    modelo: 'DeepSeek R1'
  };
}

/**
 * Pesquisa jurisprudência
 */
export async function pesquisarJurisprudencia(tema, options = {}) {
  const systemPrompt = `Você é um pesquisador jurídico especializado em jurisprudência brasileira.
Forneça precedentes relevantes sobre o tema, indicando:
- Tribunal
- Número do processo
- Relator
- Data do julgamento
- Tese firmada

IMPORTANTE: Indique que os precedentes devem ser verificados nas fontes oficiais.`;

  return conversar(`Pesquise jurisprudência sobre: ${tema}`, {
    ...options,
    systemPrompt,
    modelo: options.modelo || MODELOS_BEDROCK.amazon['nova-pro']
  });
}

// ============================================================
// CLASSE PRINCIPAL
// ============================================================

export class BedrockAgent {
  constructor(options = {}) {
    this.modelo = options.modelo || CONFIG.defaultModel;
    this.region = options.region || CONFIG.region;
    this.systemPrompt = options.systemPrompt || null;
    this.historico = [];

// Debug logging removido para producao - agente inicializado silenciosamente
  }

  async enviar(mensagem, options = {}) {
    // 🔥 NÃO concatenar aqui - deixar conversar() fazer isso DEPOIS do truncamento
    const { kbContext, ...restOptions } = options;

    const resultado = await conversar(mensagem, {
      modelo: this.modelo,
      systemPrompt: this.systemPrompt,
      historico: this.historico,
      kbContext: kbContext || '',  // Passar para truncamento correto
      ...restOptions
    });

    if (resultado.sucesso) {
      // Salvar no histórico a mensagem ORIGINAL (sem KB) para economizar espaço
      this.historico.push({ role: 'user', content: mensagem });
      this.historico.push({ role: 'assistant', content: resultado.resposta });
    }

    return resultado;
  }

  async enviarStream(mensagem, onChunk, options = {}) {
    return conversarStream(mensagem, onChunk, {
      modelo: this.modelo,
      systemPrompt: this.systemPrompt,
      historico: this.historico,
      ...options
    });
  }

  limparHistorico() {
    this.historico = [];
  }

  setModelo(modelo) {
    this.modelo = modelo;
  }

  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  // Configuração
  CONFIG,
  MODELOS_BEDROCK,
  INFERENCE_PROFILES,

  // Funções principais
  conversar,
  conversarStream,
  listarModelos,
  listarInferenceProfiles,

  // Funções ROM Agent
  gerarTextoJuridico,
  analisarProcesso,
  pesquisarJurisprudencia,
  analisarComRaciocinio, // DeepSeek R1

  // Classe
  BedrockAgent
};
