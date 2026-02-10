/**
 * ROM Agent - Model Selector Inteligente
 *
 * Seleciona modelo ótimo baseado na tarefa para maximizar economia.
 *
 * ECONOMIA:
 * - Haiku: $1/1M input (85% mais barato que Sonnet)
 * - Sonnet: $3/1M input (baseline)
 * - Opus: $15/1M input (5x Sonnet)
 * - Nova Micro: $0.035/1M input (97% mais barato que Sonnet!)
 * - Nova Lite: $0.06/1M input (98% mais barato que Sonnet)
 */

import { logger } from './logger.js';

// Preços por 1M tokens (input)
const MODEL_COSTS = {
  'nova-micro': 0.035,
  'nova-lite': 0.06,
  haiku: 1.0,
  sonnet: 3.0,
  opus: 15.0,
  'deepseek-r1': 0.5,
  'llama': 0.99
};

// IDs completos dos modelos
const MODEL_IDS = {
  'nova-micro': 'us.amazon.nova-micro-v1:0',
  'nova-lite': 'us.amazon.nova-lite-v1:0',
  haiku: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  sonnet: 'us.anthropic.claude-sonnet-4-5-20241022-v2:0',
  opus: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
  'deepseek-r1': 'us.anthropic.deepseek-r1-distill-llama-70b',
  llama: 'us.meta.llama3-3-70b-instruct-v1:0'
};

/**
 * Classificar tipo de tarefa baseado no prompt
 */
function classifyTask(prompt, context = {}) {
  const promptLower = prompt.toLowerCase();

  // 🟢 NOVA MICRO - Tarefas ultra-simples (97% economia vs Sonnet)
  const novaMicroKeywords = [
    'extraia apenas', 'liste', 'enumere',
    'qual o', 'identifique o nome',
    'cpf', 'cnpj', 'data de',
    'retorne apenas', 'responda apenas'
  ];

  // 🟢 HAIKU - Tarefas estruturadas/simples (66% economia vs Sonnet)
  const haikuKeywords = [
    'extraia', 'parse', 'json', 'estruture',
    'classifique', 'categorize',
    'resuma em', 'resumo curto', 'resumo executivo',
    'coteje', 'compare', 'identifique',
    'número do processo', 'relator', 'tribunal',
    'valide', 'verifique se',
    'transcreva', 'converta'
  ];

  // 🔴 OPUS - Tarefas densas/criativas (5x Sonnet)
  const opusKeywords = [
    'redija', 'elabore peça', 'escreva petição',
    'fundamente', 'argumente', 'defenda',
    'análise profunda', 'análise completa',
    'parecer jurídico', 'memorial'
  ];

  // 🟣 DEEPSEEK - Raciocínio multi-etapa (50% economia vs Haiku)
  const deepseekKeywords = [
    'passo a passo', 'raciocine', 'deduza',
    'prove', 'demonstre logicamente',
    'chain of thought', 'reasoning'
  ];

  // Verificar keywords por prioridade (mais específico primeiro)
  for (const keyword of opusKeywords) {
    if (promptLower.includes(keyword)) {
      return { type: 'dense', model: 'opus', confidence: 0.9 };
    }
  }

  for (const keyword of deepseekKeywords) {
    if (promptLower.includes(keyword)) {
      return { type: 'reasoning', model: 'deepseek-r1', confidence: 0.85 };
    }
  }

  for (const keyword of novaMicroKeywords) {
    if (promptLower.includes(keyword)) {
      return { type: 'ultra-simple', model: 'nova-micro', confidence: 0.8 };
    }
  }

  for (const keyword of haikuKeywords) {
    if (promptLower.includes(keyword)) {
      return { type: 'simple', model: 'haiku', confidence: 0.8 };
    }
  }

  // Análise por tamanho esperado
  if (context.maxTokens && context.maxTokens <= 1000) {
    return { type: 'simple', model: 'haiku', confidence: 0.7 };
  }

  if (context.maxTokens && context.maxTokens >= 20000) {
    return { type: 'dense', model: 'sonnet', confidence: 0.6 };
  }

  // Análise por system prompt
  if (context.systemPrompt) {
    const systemLower = context.systemPrompt.toLowerCase();

    if (systemLower.includes('especialista em') || systemLower.includes('jurídico')) {
      return { type: 'medium', model: 'sonnet', confidence: 0.65 };
    }

    if (systemLower.includes('assistente') && systemLower.includes('extrair')) {
      return { type: 'simple', model: 'haiku', confidence: 0.7 };
    }
  }

  // Default: Sonnet (seguro)
  return { type: 'medium', model: 'sonnet', confidence: 0.5 };
}

/**
 * Selecionar modelo ótimo
 *
 * @param {string} prompt - Prompt do usuário
 * @param {Object} context - Contexto adicional (maxTokens, explicitModel, etc)
 * @returns {Object} { modelId, modelName, reasoning, cost }
 */
export function selectOptimalModel(prompt, context = {}) {
  // Se modelo foi especificado explicitamente, usar ele
  if (context.modelo || context.model) {
    const explicitModel = context.modelo || context.model;

    // Se é ID completo, retornar direto
    if (explicitModel.includes('.')) {  // Contains provider (us., anthropic., etc)
      return {
        modelId: explicitModel,
        modelName: extractModelName(explicitModel),
        reasoning: 'Explicit model specified',
        cost: MODEL_COSTS[extractModelName(explicitModel)] || 3.0,
        explicit: true
      };
    }

    // Se é nome curto (haiku, sonnet, opus, etc)
    const modelId = MODEL_IDS[explicitModel] || MODEL_IDS.sonnet;
    return {
      modelId,
      modelName: explicitModel,
      reasoning: 'Explicit model specified',
      cost: MODEL_COSTS[explicitModel] || 3.0,
      explicit: true
    };
  }

  // Classificar tarefa automaticamente
  const classification = classifyTask(prompt, context);

  const modelName = classification.model;
  const modelId = MODEL_IDS[modelName];
  const cost = MODEL_COSTS[modelName];

  logger.debug('[ModelSelector] Auto-selected model', {
    taskType: classification.type,
    model: modelName,
    modelId,
    confidence: classification.confidence,
    costPerMTokens: cost,
    promptLength: prompt.length,
    maxTokens: context.maxTokens
  });

  return {
    modelId,
    modelName,
    reasoning: `Task type: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`,
    cost,
    explicit: false,
    autoSelected: true
  };
}

/**
 * Extrair nome do modelo de ID completo
 */
function extractModelName(modelId) {
  if (modelId.includes('nova-micro')) return 'nova-micro';
  if (modelId.includes('nova-lite')) return 'nova-lite';
  if (modelId.includes('haiku')) return 'haiku';
  if (modelId.includes('sonnet')) return 'sonnet';
  if (modelId.includes('opus')) return 'opus';
  if (modelId.includes('deepseek')) return 'deepseek-r1';
  if (modelId.includes('llama')) return 'llama';
  return 'sonnet';
}

/**
 * Calcular economia estimada ao usar modelo selecionado
 */
export function calculateSavings(selectedModel, baselineModel = 'sonnet', estimatedTokens = 1000) {
  const selectedCost = MODEL_COSTS[selectedModel] || 3.0;
  const baselineCost = MODEL_COSTS[baselineModel] || 3.0;

  const selectedPrice = (selectedCost / 1000000) * estimatedTokens;
  const baselinePrice = (baselineCost / 1000000) * estimatedTokens;

  const savings = baselinePrice - selectedPrice;
  const savingsPercent = baselinePrice > 0 ? ((savings / baselinePrice) * 100).toFixed(1) : 0;

  return {
    selectedPrice: selectedPrice.toFixed(6),
    baselinePrice: baselinePrice.toFixed(6),
    savings: savings.toFixed(6),
    savingsPercent: parseFloat(savingsPercent)
  };
}

/**
 * Validar se modelo suporta recursos solicitados
 */
export function validateModelCapabilities(modelName, context = {}) {
  const capabilities = {
    'nova-micro': { vision: false, maxTokens: 4096, tools: false },
    'nova-lite': { vision: false, maxTokens: 8192, tools: false },
    haiku: { vision: false, maxTokens: 200000, tools: true },
    sonnet: { vision: true, maxTokens: 200000, tools: true },
    opus: { vision: true, maxTokens: 200000, tools: true },
    'deepseek-r1': { vision: false, maxTokens: 64000, tools: false },
    llama: { vision: false, maxTokens: 128000, tools: false }
  };

  const modelCaps = capabilities[modelName] || capabilities.sonnet;

  // Se precisa de visão, apenas Sonnet/Opus
  if (context.images && context.images.length > 0) {
    if (!modelCaps.vision) {
      logger.warn('[ModelSelector] Model lacks vision, upgrading to Sonnet', { model: modelName });
      return { valid: false, fallback: 'sonnet', reason: 'Vision required' };
    }
  }

  // Se precisa de tools, apenas Claude models
  if (context.enableTools && !modelCaps.tools) {
    logger.warn('[ModelSelector] Model lacks tools, upgrading to Haiku', { model: modelName });
    return { valid: false, fallback: 'haiku', reason: 'Tools required' };
  }

  // Se maxTokens excede capacidade
  if (context.maxTokens && context.maxTokens > modelCaps.maxTokens) {
    logger.warn('[ModelSelector] MaxTokens exceeds model capacity, upgrading', {
      model: modelName,
      requested: context.maxTokens,
      max: modelCaps.maxTokens
    });
    return { valid: false, fallback: 'sonnet', reason: 'Token capacity exceeded' };
  }

  return { valid: true, capabilities: modelCaps };
}

/**
 * Selecionar modelo com validação de capacidades
 */
export function selectModelWithValidation(prompt, context = {}) {
  let selection = selectOptimalModel(prompt, context);

  // Se foi explícito, não validar (usuário sabe o que quer)
  if (selection.explicit) {
    return selection;
  }

  // Validar se modelo selecionado suporta features solicitadas
  const validation = validateModelCapabilities(selection.modelName, context);

  if (!validation.valid) {
    logger.info('[ModelSelector] Auto-selected model incompatible, falling back', {
      original: selection.modelName,
      fallback: validation.fallback,
      reason: validation.reason
    });

    // Reselecionar com fallback
    selection = selectOptimalModel(prompt, { ...context, modelo: validation.fallback });
    selection.reasoning += ` (fallback: ${validation.reason})`;
  }

  return selection;
}

export default {
  selectOptimalModel,
  selectModelWithValidation,
  calculateSavings,
  validateModelCapabilities,
  MODEL_IDS,
  MODEL_COSTS
};
