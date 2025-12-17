/**
 * MODEL PROFILE ROUTER - v2.8.1 (BETA-RC1)
 *
 * Router de perfis (aliases) para modelos Bedrock
 * Compatível com sistema híbrido existente (SEM QUEBRAR)
 *
 * REGRA HARD: Entrega Final = PREMIUM obrigatório
 *
 * @version 2.8.1
 */

import { EventEmitter } from 'events';

/**
 * PERFIS OFICIAIS - Mapeamento conforme Release Spec v2.8.1
 */
export const MODEL_PROFILES = {
  // PREMIUM: Entrega final / peças / refinamento esmerado
  PREMIUM: {
    name: 'Premium',
    description: 'Qualidade máxima para entrega final',
    primary: 'anthropic.claude-opus-4-5-20251101-v1:0',
    fallbacks: [
      'anthropic.claude-sonnet-4-5-20250929-v1:0',
      'amazon.nova-premier-v1:0',
      'mistral.mistral-large-3-675b-instruct'
    ],
    useCases: ['entrega_final', 'peca_juridica', 'refinamento'],
    minQuality: 'premium',
    estimatedCost: 'alto',
    estimatedLatency: '2000-4000ms'
  },

  // PADRÃO: Análise jurídica estruturada / equilíbrio
  PADRAO: {
    name: 'Padrão',
    description: 'Equilíbrio para análise jurídica',
    primary: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    fallbacks: [
      'amazon.nova-pro-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0',
      'meta.llama3-2-90b-instruct-v1:0',
      'mistral.mistral-large-3-675b-instruct'
    ],
    useCases: ['analise', 'estruturacao', 'intermediario'],
    minQuality: 'standard',
    estimatedCost: 'médio',
    estimatedLatency: '1000-2500ms'
  },

  // ECONÔMICO: Triagens, resumos rápidos, pós-processo
  ECONOMICO: {
    name: 'Econômico',
    description: 'Rápido e econômico para triagem',
    primary: 'amazon.nova-micro-v1:0',
    fallbacks: [
      'amazon.nova-lite-v1:0',
      'meta.llama3-3-70b-instruct-v1:0',
      'cohere.command-r-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'mistral.ministral-3-14b-instruct'
    ],
    useCases: ['triagem', 'resumo', 'pos_processo', 'mecanico'],
    minQuality: 'basic',
    estimatedCost: 'baixo',
    estimatedLatency: '500-1000ms'
  },

  // CONTEXTO LONGO: Processos extensos / exaustivo
  CONTEXTO_LONGO: {
    name: 'Contexto Longo',
    description: 'Para processos extensos (200k+ tokens)',
    primary: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    fallbacks: [
      'amazon.nova-pro-v1:0',
      'meta.llama3-2-90b-instruct-v1:0',
      'anthropic.claude-3-5-sonnet-20241022-v2:0'
    ],
    useCases: ['exaustivo', 'processo_extenso', 'longo'],
    minQuality: 'standard',
    estimatedCost: 'médio-alto',
    estimatedLatency: '1500-3000ms',
    maxContextTokens: 200000
  },

  // RAG: Jurisprudência / KB search
  RAG: {
    name: 'RAG/Jurisprudência',
    description: 'Otimizado para busca e citação',
    primary: 'cohere.command-r-plus-v1:0',
    fallbacks: [
      'cohere.command-r-v1:0',
      'anthropic.claude-sonnet-4-5-20250929-v1:0',
      'meta.llama3-3-70b-instruct-v1:0'
    ],
    useCases: ['rag', 'jurisprudencia', 'kb_search', 'citacao'],
    minQuality: 'standard',
    estimatedCost: 'baixo-médio',
    estimatedLatency: '600-1200ms'
  },

  // VISÃO: PDFs escaneados / multimodal
  VISAO: {
    name: 'Visão',
    description: 'Para imagens e PDFs escaneados',
    primary: 'mistral.pixtral-large-2502-v1:0',
    fallbacks: [
      'anthropic.claude-opus-4-5-20251101-v1:0',
      'anthropic.claude-sonnet-4-5-20250929-v1:0'
    ],
    useCases: ['imagem', 'pdf_escaneado', 'multimodal', 'ocr'],
    minQuality: 'standard',
    estimatedCost: 'médio',
    estimatedLatency: '800-2000ms',
    capabilities: ['vision']
  },

  // RACIOCÍNIO: Problemas lógicos complexos
  RACIOCINIO: {
    name: 'Raciocínio',
    description: 'Raciocínio avançado para problemas complexos',
    primary: 'deepseek.r1-v1:0',
    fallbacks: [
      'anthropic.claude-opus-4-5-20251101-v1:0',
      'meta.llama3-2-90b-instruct-v1:0'
    ],
    useCases: ['raciocinio', 'logica', 'problema_complexo', 'cadeia'],
    minQuality: 'standard',
    estimatedCost: 'baixo-médio',
    estimatedLatency: '500-2500ms',
    capabilities: ['reasoning']
  }
};

/**
 * AUTO: Seleção automática baseada em contexto
 */
export const AUTO_PROFILE = {
  name: 'Auto',
  description: 'Seleção automática inteligente',
  strategy: 'auto',
  rules: {
    // Regras de detecção automática
    keywords: {
      premium: [
        'entrega final', 'peça', 'petição', 'recurso', 'contestação',
        'embargos', 'mandado', 'habeas', 'ação', 'defesa'
      ],
      rag: [
        'jurisprudência', 'precedente', 'leading case', 'súmula',
        'consultar kb', 'buscar', 'pesquisar'
      ],
      visao: [
        'imagem', 'foto', 'escaneado', 'digitalizado', 'pdf escaneado'
      ],
      raciocinio: [
        'calcular', 'demonstrar', 'provar', 'deduzir', 'raciocínio'
      ],
      contexto_longo: [
        'exaustivamente', 'integralidade', 'todos os arquivos',
        'processo completo', 'na íntegra'
      ]
    }
  }
};

/**
 * Model Profile Router
 */
class ModelProfileRouter extends EventEmitter {
  constructor() {
    super();

    // Estatísticas de uso e fallbacks
    this.stats = {
      totalRequests: 0,
      byProfile: {},
      byModel: {},
      fallbackCount: 0,
      circuitBreakers: new Map() // modelId → { failures, lastFailure, openUntil }
    };

    // Configuração de circuit breaker
    this.circuitBreakerConfig = {
      failureThreshold: 3,      // Falhas consecutivas antes de abrir
      openDuration: 300000,     // 5 minutos aberto
      halfOpenAttempts: 1       // Tentativas em half-open
    };
  }

  /**
   * Seleciona modelo baseado em perfil e contexto
   */
  async selectModel(options = {}) {
    const {
      profile = 'AUTO',           // Perfil solicitado
      taskType = null,            // texto/tabela/diagrama
      context = {},               // { userMessage, metadata, isDeliverable }
      forceQuality = null         // premium/standard/basic (override)
    } = options;

    this.stats.totalRequests++;

    // 1. Determinar perfil efetivo
    let effectiveProfile = profile;

    if (profile === 'AUTO') {
      effectiveProfile = this.detectProfile(context);
      console.info(`🤖 Auto-seleção: ${effectiveProfile}`, {
        userMessage: context.userMessage?.substring(0, 100),
        detected: effectiveProfile
      });
    }

    // 2. REGRA HARD: Entrega final = PREMIUM obrigatório
    if (context.isDeliverable || forceQuality === 'premium') {
      if (effectiveProfile !== 'PREMIUM') {
        console.warn('⚠️  Forçando PREMIUM para entrega final');
        effectiveProfile = 'PREMIUM';
      }
    }

    // 3. Aplicar política por tipo de tarefa
    if (taskType) {
      effectiveProfile = this.applyTaskTypePolicy(effectiveProfile, taskType, context);
    }

    // 4. Obter configuração do perfil
    const profileConfig = MODEL_PROFILES[effectiveProfile];
    if (!profileConfig) {
      throw new Error(`Perfil inválido: ${effectiveProfile}`);
    }

    // 5. Selecionar modelo (primary ou fallback via circuit breaker)
    const selectedModel = await this.selectWithCircuitBreaker(profileConfig);

    // 6. Registrar estatísticas
    this.stats.byProfile[effectiveProfile] = (this.stats.byProfile[effectiveProfile] || 0) + 1;
    this.stats.byModel[selectedModel.modelId] = (this.stats.byModel[selectedModel.modelId] || 0) + 1;

    // 7. Emitir evento
    this.emit('model-selected', {
      profile: effectiveProfile,
      modelId: selectedModel.modelId,
      isFallback: selectedModel.isFallback,
      taskType,
      context
    });

    return {
      profile: effectiveProfile,
      modelId: selectedModel.modelId,
      isFallback: selectedModel.isFallback,
      fallbackReason: selectedModel.fallbackReason,
      estimatedCost: profileConfig.estimatedCost,
      estimatedLatency: profileConfig.estimatedLatency,
      profileConfig
    };
  }

  /**
   * Detecta perfil automaticamente baseado em contexto
   */
  detectProfile(context) {
    const { userMessage = '', metadata = {} } = context;
    const lowerMessage = userMessage.toLowerCase();

    // Verificar keywords por prioridade
    const rules = AUTO_PROFILE.rules.keywords;

    // 1. Premium (mais específico)
    if (rules.premium.some(kw => lowerMessage.includes(kw))) {
      return 'PREMIUM';
    }

    // 2. Visão (imagens/PDFs)
    if (rules.visao.some(kw => lowerMessage.includes(kw)) || metadata.hasImages) {
      return 'VISAO';
    }

    // 3. Contexto longo (exaustivo)
    if (rules.contexto_longo.some(kw => lowerMessage.includes(kw))) {
      return 'CONTEXTO_LONGO';
    }

    // 4. RAG (busca)
    if (rules.rag.some(kw => lowerMessage.includes(kw))) {
      return 'RAG';
    }

    // 5. Raciocínio
    if (rules.raciocinio.some(kw => lowerMessage.includes(kw))) {
      return 'RACIOCINIO';
    }

    // 6. Default: PADRÃO
    return 'PADRAO';
  }

  /**
   * Aplica política por tipo de tarefa
   */
  applyTaskTypePolicy(profile, taskType, context) {
    switch (taskType) {
      case 'texto':
        // Texto: final em Premium, triagem pode ser Econômico
        if (context.isDeliverable) {
          return 'PREMIUM';
        }
        return profile;

      case 'tabela':
        // Tabelas: mínimo Padrão
        if (profile === 'ECONOMICO') {
          console.warn('⚠️  Rebaixando ECONOMICO → PADRAO para tabela');
          return 'PADRAO';
        }
        if (context.isDeliverable) {
          return 'PREMIUM';
        }
        return profile;

      case 'diagrama':
        // Diagramas: Padrão para rascunho, Premium para final
        if (context.isDeliverable) {
          return 'PREMIUM';
        }
        if (profile === 'ECONOMICO') {
          console.warn('⚠️  Rebaixando ECONOMICO → PADRAO para diagrama');
          return 'PADRAO';
        }
        return profile;

      default:
        return profile;
    }
  }

  /**
   * Seleciona modelo com circuit breaker e fallback
   */
  async selectWithCircuitBreaker(profileConfig) {
    const candidates = [profileConfig.primary, ...profileConfig.fallbacks];

    for (let i = 0; i < candidates.length; i++) {
      const modelId = candidates[i];
      const isFallback = i > 0;

      // Verificar circuit breaker
      const breakerState = this.getCircuitBreakerState(modelId);

      if (breakerState === 'open') {
        console.warn(`🔴 Circuit breaker OPEN para ${modelId} - pulando`);
        continue;
      }

      if (breakerState === 'half-open') {
        console.info(`🟡 Circuit breaker HALF-OPEN para ${modelId} - tentando`);
      }

      // Modelo selecionado
      if (isFallback) {
        this.stats.fallbackCount++;
        console.warn(`⚠️  Fallback: ${profileConfig.primary} → ${modelId}`);
      }

      return {
        modelId,
        isFallback,
        fallbackReason: isFallback ? `Circuit breaker ou falha no primary` : null
      };
    }

    // Todos falharam - última tentativa no primary
    console.error('❌ Todos modelos do perfil falharam - usando primary forçado');
    return {
      modelId: profileConfig.primary,
      isFallback: false,
      fallbackReason: 'Todos fallbacks esgotados'
    };
  }

  /**
   * Obtém estado do circuit breaker
   */
  getCircuitBreakerState(modelId) {
    const breaker = this.stats.circuitBreakers.get(modelId);
    if (!breaker) return 'closed';

    const now = Date.now();

    // Verificar se ainda está aberto
    if (breaker.openUntil && now < breaker.openUntil) {
      return 'open';
    }

    // Passou tempo - half-open
    if (breaker.openUntil && now >= breaker.openUntil) {
      return 'half-open';
    }

    return 'closed';
  }

  /**
   * Registra falha de modelo (para circuit breaker)
   */
  recordFailure(modelId, error) {
    let breaker = this.stats.circuitBreakers.get(modelId);

    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: null,
        openUntil: null
      };
      this.stats.circuitBreakers.set(modelId, breaker);
    }

    breaker.failures++;
    breaker.lastFailure = Date.now();

    // Abrir circuit se atingiu threshold
    if (breaker.failures >= this.circuitBreakerConfig.failureThreshold) {
      breaker.openUntil = Date.now() + this.circuitBreakerConfig.openDuration;
      console.error(`🔴 Circuit breaker ABERTO para ${modelId}`, {
        failures: breaker.failures,
        openUntil: new Date(breaker.openUntil).toISOString()
      });

      this.emit('circuit-breaker-open', { modelId, breaker });
    }

    console.error(`❌ Falha registrada para ${modelId}`, {
      failures: breaker.failures,
      error: error.message
    });
  }

  /**
   * Registra sucesso de modelo (reset circuit breaker)
   */
  recordSuccess(modelId) {
    const breaker = this.stats.circuitBreakers.get(modelId);

    if (breaker) {
      // Reset
      breaker.failures = 0;
      breaker.lastFailure = null;
      breaker.openUntil = null;

      console.info(`✅ Circuit breaker resetado para ${modelId}`);
    }
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      circuitBreakers: Array.from(this.stats.circuitBreakers.entries()).map(([modelId, breaker]) => ({
        modelId,
        state: this.getCircuitBreakerState(modelId),
        ...breaker
      }))
    };
  }
}

// Singleton
export const modelRouter = new ModelProfileRouter();

export default modelRouter;
