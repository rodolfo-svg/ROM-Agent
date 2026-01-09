/**
 * ROM Agent - Roteamento Inteligente de IA por Vocação
 *
 * Sistema que otimiza custo/qualidade roteando tarefas para o modelo ideal:
 * - Tarefas SIMPLES → Modelos gratuitos (Llama, Mistral, DeepSeek)
 * - Tarefas MÉDIAS → Modelos econômicos (Haiku, Nova Lite)
 * - Tarefas COMPLEXAS → Modelos premium (Sonnet, Opus, Nova Pro)
 *
 * ECONOMIA ESPERADA: 60-80% dos custos mantendo qualidade máxima
 *
 * @version 1.0.0
 */

// ============================================================
// CUSTOS POR MODELO (USD per 1M tokens)
// ============================================================

const MODEL_COSTS = {
  // GRATUITOS/BARATOS (Tier 1: < $0.50/M tokens)
  'deepseek-r1': { input: 0.14, output: 0.28, tier: 1, quality: 8 },
  'llama-3.3-70b': { input: 0.27, output: 0.27, tier: 1, quality: 8 },
  'llama-4-scout': { input: 0.18, output: 0.18, tier: 1, quality: 8 },
  'mistral-large-3': { input: 0.20, output: 0.20, tier: 1, quality: 8 },

  // ECONÔMICOS (Tier 2: $0.50-$3/M tokens)
  'claude-haiku-4': { input: 0.80, output: 1.00, tier: 2, quality: 8 },
  'nova-lite': { input: 0.60, output: 0.80, tier: 2, quality: 7 },

  // INTERMEDIÁRIOS (Tier 3: $3-$10/M tokens)
  'claude-sonnet-4': { input: 3.00, output: 15.00, tier: 3, quality: 9 },
  'nova-pro': { input: 0.80, output: 3.20, tier: 3, quality: 9 },

  // PREMIUM (Tier 4: > $10/M tokens)
  'claude-opus-4': { input: 15.00, output: 75.00, tier: 4, quality: 10 },
  'claude-sonnet-4.5': { input: 3.00, output: 15.00, tier: 4, quality: 10 },
  'nova-premier': { input: 2.40, output: 9.60, tier: 4, quality: 10 }
};

// ============================================================
// VOCAÇÕES E COMPLEXIDADE
// ============================================================

const TASK_VOCATIONS = {
  // SIMPLES - Tier 1 models (gratuitos)
  'formatting': { complexity: 1, description: 'Formatação, limpeza de texto' },
  'summary': { complexity: 1, description: 'Resumo simples de textos' },
  'translation': { complexity: 1, description: 'Tradução direta' },
  'spell_check': { complexity: 1, description: 'Correção ortográfica' },
  'extraction': { complexity: 1, description: 'Extração de dados estruturados' },

  // MÉDIAS - Tier 2 models (econômicos)
  'classification': { complexity: 2, description: 'Classificação de documentos' },
  'basic_writing': { complexity: 2, description: 'Redação básica' },
  'qa_simple': { complexity: 2, description: 'Perguntas e respostas simples' },
  'comparison': { complexity: 2, description: 'Comparação de textos' },

  // COMPLEXAS - Tier 3 models (intermediários)
  'legal_analysis': { complexity: 3, description: 'Análise jurídica' },
  'legal_writing': { complexity: 3, description: 'Redação jurídica' },
  'research': { complexity: 3, description: 'Pesquisa aprofundada' },
  'argumentation': { complexity: 3, description: 'Construção de argumentos' },

  // CRÍTICAS - Tier 4 models (premium)
  'complex_reasoning': { complexity: 4, description: 'Raciocínio complexo' },
  'strategic_planning': { complexity: 4, description: 'Planejamento estratégico' },
  'expert_opinion': { complexity: 4, description: 'Parecer técnico especializado' },
  'appeal_writing': { complexity: 4, description: 'Redação de recursos complexos' }
};

// ============================================================
// ROTEAMENTO INTELIGENTE
// ============================================================

class IntelligentRouter {
  constructor() {
    this.cache = new Map();
    this.stats = {
      totalRequests: 0,
      costSaved: 0,
      cacheHits: 0
    };
  }

  /**
   * Classifica a complexidade de uma tarefa automaticamente
   * @param {string} prompt - Prompt do usuário
   * @param {string} context - Contexto adicional
   * @returns {number} Complexity (1-4)
   */
  classifyComplexity(prompt, context = '') {
    const text = (prompt + ' ' + context).toLowerCase();

    // Palavras-chave que indicam alta complexidade
    const highComplexity = [
      'analisar profundamente', 'raciocinar', 'estratégia',
      'complexo', 'avançado', 'especializado', 'crítico',
      'recurso', 'apelação', 'parecer técnico'
    ];

    const mediumComplexity = [
      'analisar', 'redigir', 'escrever', 'pesquisar',
      'comparar', 'avaliar', 'fundamentar'
    ];

    const lowComplexity = [
      'formatar', 'resumir', 'traduzir', 'corrigir',
      'extrair', 'listar', 'organizar'
    ];

    // Contar matches
    const highCount = highComplexity.filter(k => text.includes(k)).length;
    const mediumCount = mediumComplexity.filter(k => text.includes(k)).length;
    const lowCount = lowComplexity.filter(k => text.includes(k)).length;

    // Determinar complexidade
    if (highCount > 0) return 4;
    if (mediumCount > 0) return 3;
    if (lowCount > 0) return 1;

    // Default: média (melhor pecar por excesso)
    return 2;
  }

  /**
   * Seleciona o modelo ideal baseado em vocação e complexidade
   * @param {string} vocation - Vocação da tarefa
   * @param {number} complexity - Complexidade (1-4)
   * @param {object} options - Opções adicionais
   * @returns {string} Model ID
   */
  selectModel(vocation, complexity = null, options = {}) {
    const {
      forceModel = null,
      maxCostTier = 4,
      prioritizeQuality = false
    } = options;

    // Se modelo foi forçado, usar ele
    if (forceModel) return forceModel;

    // Determinar complexidade se não foi fornecida
    if (complexity === null) {
      complexity = TASK_VOCATIONS[vocation]?.complexity || 2;
    }

    // Selecionar por tier de custo
    let selectedModel;

    if (complexity === 1 && maxCostTier >= 1) {
      // Tarefas simples: usar gratuitos
      selectedModel = prioritizeQuality ? 'deepseek-r1' : 'llama-3.3-70b';
    } else if (complexity === 2 && maxCostTier >= 2) {
      // Tarefas médias: usar econômicos
      selectedModel = prioritizeQuality ? 'claude-haiku-4' : 'nova-lite';
    } else if (complexity === 3 && maxCostTier >= 3) {
      // Tarefas complexas: usar intermediários
      selectedModel = prioritizeQuality ? 'claude-sonnet-4' : 'nova-pro';
    } else if (complexity === 4 && maxCostTier >= 4) {
      // Tarefas críticas: usar premium
      selectedModel = prioritizeQuality ? 'claude-opus-4' : 'claude-sonnet-4.5';
    } else {
      // Fallback: modelo mais barato dentro do tier permitido
      const modelsInTier = Object.entries(MODEL_COSTS)
        .filter(([_, cost]) => cost.tier <= maxCostTier)
        .sort((a, b) => (a[1].input + a[1].output) - (b[1].input + b[1].output));

      selectedModel = modelsInTier[0]?.[0] || 'llama-3.3-70b';
    }

    return selectedModel;
  }

  /**
   * Rota uma requisição para o modelo ideal
   * @param {object} request - Requisição
   * @returns {object} Roteamento
   */
  route(request) {
    const {
      prompt,
      vocation = null,
      complexity = null,
      context = '',
      useCache = true,
      ...options
    } = request;

    this.stats.totalRequests++;

    // 1. Verificar cache
    if (useCache) {
      const cacheKey = this._getCacheKey(prompt, context);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        this.stats.cacheHits++;
        this.stats.costSaved += cached.estimatedCost;

        return {
          ...cached,
          cached: true,
          stats: this.getStats()
        };
      }
    }

    // 2. Classificar automaticamente se necessário
    const detectedComplexity = complexity || this.classifyComplexity(prompt, context);
    const detectedVocation = vocation || this._detectVocation(prompt);

    // 3. Selecionar modelo ideal
    const selectedModel = this.selectModel(detectedVocation, detectedComplexity, options);
    const modelCost = MODEL_COSTS[selectedModel];

    // 4. Estimar custo
    const inputTokens = Math.ceil((prompt + context).length / 4); // Aproximação
    const outputTokens = 1000; // Estimativa
    const estimatedCost = (
      (inputTokens / 1000000) * modelCost.input +
      (outputTokens / 1000000) * modelCost.output
    );

    // 5. Calcular economia vs modelo premium
    const premiumCost = MODEL_COSTS['claude-opus-4'];
    const premiumEstimatedCost = (
      (inputTokens / 1000000) * premiumCost.input +
      (outputTokens / 1000000) * premiumCost.output
    );
    const costSavings = premiumEstimatedCost - estimatedCost;
    const savingsPercent = ((costSavings / premiumEstimatedCost) * 100).toFixed(1);

    const routing = {
      model: selectedModel,
      vocation: detectedVocation,
      complexity: detectedComplexity,
      tier: modelCost.tier,
      quality: modelCost.quality,
      estimatedCost,
      costSavings,
      savingsPercent: `${savingsPercent}%`,
      reasoning: this._explainRouting(detectedVocation, detectedComplexity, selectedModel),
      timestamp: Date.now(),
      cached: false
    };

    // 6. Cachear resultado (estrutura para quando tiver resposta)
    if (useCache) {
      const cacheKey = this._getCacheKey(prompt, context);
      this.cache.set(cacheKey, {
        ...routing,
        prompt,
        context
      });
    }

    return routing;
  }

  /**
   * Detecta vocação baseado no prompt
   */
  _detectVocation(prompt) {
    const text = prompt.toLowerCase();

    // Padrões de detecção
    const patterns = {
      'legal_writing': ['redigir', 'peça', 'petição', 'recurso', 'inicial'],
      'legal_analysis': ['analisar', 'examinar', 'avaliar jurisprudência'],
      'research': ['pesquisar', 'buscar', 'encontrar precedentes'],
      'summary': ['resumir', 'sintetizar', 'resumo'],
      'formatting': ['formatar', 'ajustar', 'corrigir formatação'],
      'extraction': ['extrair', 'obter dados', 'listar informações']
    };

    for (const [vocation, keywords] of Object.entries(patterns)) {
      if (keywords.some(k => text.includes(k))) {
        return vocation;
      }
    }

    return 'basic_writing'; // Default
  }

  /**
   * Explica o porquê do roteamento
   */
  _explainRouting(vocation, complexity, model) {
    const vocationInfo = TASK_VOCATIONS[vocation] || { description: 'Tarefa genérica' };
    const modelInfo = MODEL_COSTS[model];

    const complexityLabels = {
      1: 'SIMPLES',
      2: 'MÉDIA',
      3: 'COMPLEXA',
      4: 'CRÍTICA'
    };

    return `${complexityLabels[complexity]} (${vocationInfo.description}) → Tier ${modelInfo.tier} (Qualidade ${modelInfo.quality}/10, Custo: $${modelInfo.input.toFixed(2)}/$${modelInfo.output.toFixed(2)} per 1M tokens)`;
  }

  /**
   * Gera chave de cache
   */
  _getCacheKey(prompt, context) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(prompt + context).digest('hex');
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheHitRate: this.stats.totalRequests > 0
        ? `${((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(1)}%`
        : '0%',
      totalCostSaved: `$${this.stats.costSaved.toFixed(4)}`
    };
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// ============================================================
// ESTRATÉGIAS AVANÇADAS
// ============================================================

/**
 * Cascade: Modelo rápido valida, modelo premium só se necessário
 */
async function cascadeStrategy(prompt, context, converseFunction) {
  const router = new IntelligentRouter();

  // 1. Tentar com modelo rápido primeiro
  const fastRouting = router.route({
    prompt,
    context,
    vocation: 'classification',
    complexity: 1
  });

  console.log(`[CASCADE] Tentando modelo rápido: ${fastRouting.model}`);

  const fastResponse = await converseFunction(prompt, {
    modelo: fastRouting.model,
    maxTokens: 1000
  });

  // 2. Avaliar qualidade da resposta
  const confidence = evaluateConfidence(fastResponse.resposta);

  if (confidence > 0.85) {
    console.log(`[CASCADE] ✅ Resposta confiável (${(confidence * 100).toFixed(1)}%), usando modelo rápido`);
    return {
      response: fastResponse,
      routing: fastRouting,
      strategy: 'cascade-fast',
      confidence
    };
  }

  // 3. Se não confiável, usar modelo premium
  console.log(`[CASCADE] ⚠️  Baixa confiança (${(confidence * 100).toFixed(1)}%), escalando para premium`);

  const premiumRouting = router.route({
    prompt,
    context,
    vocation: 'legal_analysis',
    complexity: 4
  });

  const premiumResponse = await converseFunction(prompt, {
    modelo: premiumRouting.model,
    maxTokens: 4096
  });

  return {
    response: premiumResponse,
    routing: premiumRouting,
    strategy: 'cascade-premium',
    confidence: 0.95,
    fallbackReason: `Confiança do modelo rápido baixa: ${(confidence * 100).toFixed(1)}%`
  };
}

/**
 * Voting: Múltiplos modelos votam na melhor resposta
 */
async function votingStrategy(prompt, context, converseFunction, numModels = 3) {
  const router = new IntelligentRouter();

  // Selecionar modelos de diferentes tiers
  const models = [
    router.route({ prompt, context, complexity: 1 }).model, // Gratuito
    router.route({ prompt, context, complexity: 3 }).model, // Intermediário
    router.route({ prompt, context, complexity: 4 }).model  // Premium
  ];

  console.log(`[VOTING] Usando ${models.length} modelos: ${models.join(', ')}`);

  // Executar em paralelo
  const responses = await Promise.all(
    models.map(model =>
      converseFunction(prompt, { modelo: model, maxTokens: 2000 })
    )
  );

  // Avaliar respostas
  const scored = responses.map((resp, idx) => ({
    response: resp,
    model: models[idx],
    score: evaluateResponseQuality(resp.resposta)
  }));

  // Ordenar por score
  scored.sort((a, b) => b.score - a.score);

  return {
    winner: scored[0],
    alternatives: scored.slice(1),
    strategy: 'voting',
    consensus: calculateConsensus(responses)
  };
}

/**
 * Avalia confiança de uma resposta
 */
function evaluateConfidence(response) {
  if (!response) return 0;

  // Heurísticas simples
  let confidence = 0.5; // Base

  // Resposta longa = mais confiança
  if (response.length > 200) confidence += 0.2;

  // Tem estrutura = mais confiança
  if (response.includes('\n\n')) confidence += 0.1;

  // Tem palavras técnicas = mais confiança
  const technicalWords = ['artigo', 'lei', 'jurisprudência', 'acórdão', 'súmula'];
  const hasTechnical = technicalWords.some(w => response.toLowerCase().includes(w));
  if (hasTechnical) confidence += 0.15;

  return Math.min(confidence, 1.0);
}

/**
 * Avalia qualidade de resposta
 */
function evaluateResponseQuality(response) {
  if (!response) return 0;

  let score = 0;

  // Comprimento apropriado
  if (response.length > 100 && response.length < 5000) score += 30;

  // Estruturação
  if (response.split('\n\n').length > 2) score += 20;

  // Citações e referências
  if (response.match(/\[(.*?)\]/g)?.length > 0) score += 25;

  // Termos jurídicos
  const juridicalTerms = ['artigo', 'lei', 'código', 'jurisprudência', 'súmula'];
  score += juridicalTerms.filter(t => response.toLowerCase().includes(t)).length * 5;

  return Math.min(score, 100);
}

/**
 * Calcula consenso entre respostas
 */
function calculateConsensus(responses) {
  // Simplificado: comparar palavras-chave comuns
  const keywords = responses.map(r =>
    r.resposta.toLowerCase().split(/\s+/).filter(w => w.length > 5)
  );

  const common = keywords[0].filter(k =>
    keywords.every(ks => ks.includes(k))
  );

  return {
    commonKeywords: common.slice(0, 10),
    consensusRate: `${((common.length / keywords[0].length) * 100).toFixed(1)}%`
  };
}

// ============================================================
// EXPORTAÇÕES
// ============================================================

module.exports = {
  IntelligentRouter,
  MODEL_COSTS,
  TASK_VOCATIONS,

  // Estratégias
  cascadeStrategy,
  votingStrategy,

  // Utilidades
  evaluateConfidence,
  evaluateResponseQuality,
  calculateConsensus
};
