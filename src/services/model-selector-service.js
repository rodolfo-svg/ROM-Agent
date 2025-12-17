/**
 * ROM Agent - Model Selector Service
 * Seleção automática inteligente de modelo baseada na vocação e tarefa
 *
 * FILOSOFIA:
 * - Sonnet 4.5 como padrão (melhor custo-benefício)
 * - Opus 4.5 para tarefas complexas críticas
 * - Pipeline apenas quando absolutamente necessário
 * - Máxima qualidade com mínimo custo
 *
 * @version 2.5.0
 */

import { MODELOS_BEDROCK } from '../modules/bedrock.js';

class ModelSelectorService {
  constructor() {
    // Vocação de cada modelo (baseado no manual ROM)
    this.modelVocations = {
      // ═══════════════════════════════════════════════════════════
      // ANTHROPIC CLAUDE (Melhores modelos)
      // ═══════════════════════════════════════════════════════════
      'opus-4.5': {
        id: MODELOS_BEDROCK.anthropic['claude-opus-4.5'],
        vocacao: 'RACIOCÍNIO PROFUNDO E CASOS COMPLEXOS',
        melhorPara: [
          'embargos-declaracao',
          'recurso-extraordinario',
          'recurso-especial',
          'analise-complexa',
          'casos-novos',
          'teses-ineditas',
          'fundamentacao-extensa',
          'multiplas-fontes',
          'raciocinio-juridico-profundo'
        ],
        custoRelativo: 10,  // Mais caro
        qualidade: 10,       // Máxima qualidade
        tokens: 200000,
        quando: 'Casos complexos, novos, ou críticos que exigem raciocínio profundo'
      },

      'sonnet-4.5': {
        id: MODELOS_BEDROCK.anthropic['claude-sonnet-4.5'],
        vocacao: 'EQUILÍBRIO PERFEITO - PADRÃO',
        melhorPara: [
          'peticao-inicial',
          'contestacao',
          'apelacao',
          'analise-documento',
          'redacao-geral',
          'consulta-juridica',
          'resumo-processo',
          'chat-geral',
          'maioria-tarefas'
        ],
        custoRelativo: 5,    // Custo médio
        qualidade: 9,        // Qualidade excelente
        tokens: 200000,
        quando: 'PADRÃO - Melhor custo-benefício para 90% das tarefas'
      },

      'haiku-4.5': {
        id: MODELOS_BEDROCK.anthropic['claude-haiku-4.5'],
        vocacao: 'VELOCIDADE E ECONOMIA',
        melhorPara: [
          'resumos-rapidos',
          'extracao-dados',
          'classificacao',
          'validacao',
          'triagem',
          'respostas-curtas',
          'microfichamento',
          'metadados'
        ],
        custoRelativo: 1,    // Mais barato
        qualidade: 7,        // Boa qualidade
        tokens: 200000,
        quando: 'Tarefas rápidas, extração de dados, triagem'
      },

      // ═══════════════════════════════════════════════════════════
      // AMAZON NOVA (Multimodal)
      // ═══════════════════════════════════════════════════════════
      'nova-pro': {
        id: MODELOS_BEDROCK.amazon['nova-pro'],
        vocacao: 'MULTIMODAL - IMAGENS E DOCUMENTOS',
        melhorPara: [
          'analise-imagem',
          'ocr-inteligente',
          'documentos-visuais',
          'evidencias-fotograficas',
          'plantas-baixas',
          'mapas',
          'graficos'
        ],
        custoRelativo: 4,
        qualidade: 8,
        tokens: 300000,
        quando: 'Documentos com imagens, gráficos, evidências visuais'
      },

      // ═══════════════════════════════════════════════════════════
      // META LLAMA (Raciocínio Matemático)
      // ═══════════════════════════════════════════════════════════
      'llama-3.3-70b': {
        id: MODELOS_BEDROCK.meta['llama-3.3-70b'],
        vocacao: 'CÁLCULOS E LÓGICA',
        melhorPara: [
          'calculos-trabalhistas',
          'calculos-juros',
          'valores-causa',
          'honorarios',
          'custas',
          'prazos-matematicos'
        ],
        custoRelativo: 2,
        qualidade: 7,
        tokens: 128000,
        quando: 'Cálculos complexos, valores, prazos'
      },

      // ═══════════════════════════════════════════════════════════
      // DEEPSEEK R1 (Raciocínio Explícito)
      // ═══════════════════════════════════════════════════════════
      'deepseek-r1': {
        id: MODELOS_BEDROCK.deepseek['r1'],
        vocacao: 'RACIOCÍNIO EXPLÍCITO PASSO-A-PASSO',
        melhorPara: [
          'fundamentacao-legal',
          'cadeia-logica',
          'dedução-juridica',
          'analise-jurisprudencia',
          'interpretacao-lei'
        ],
        custoRelativo: 3,
        qualidade: 8,
        tokens: 64000,
        quando: 'Fundamentação que exige raciocínio explícito demonstrado'
      }
    };

    // Regras de seleção automática
    this.selectionRules = {
      // Por tipo de peça judicial
      pecasJudiciais: {
        'embargos-declaracao': 'opus-4.5',
        'recurso-extraordinario': 'opus-4.5',
        'recurso-especial': 'opus-4.5',
        'apelacao': 'sonnet-4.5',
        'peticao-inicial': 'sonnet-4.5',
        'contestacao': 'sonnet-4.5',
        'replica': 'sonnet-4.5',
        'manifestacao': 'sonnet-4.5',
        'agravo': 'sonnet-4.5'
      },

      // Por tipo de tarefa
      tarefas: {
        'analise-complexa': 'opus-4.5',
        'analise-simples': 'sonnet-4.5',
        'resumo': 'haiku-4.5',
        'extracao': 'haiku-4.5',
        'redacao': 'sonnet-4.5',
        'revisao': 'haiku-4.5',
        'calculo': 'llama-3.3-70b',
        'fundamentacao': 'deepseek-r1',
        'multimodal': 'nova-pro'
      },

      // Por tamanho do input (tokens estimados)
      porTamanho: {
        pequeno: 'haiku-4.5',    // < 5k tokens
        medio: 'sonnet-4.5',     // 5k-50k tokens
        grande: 'sonnet-4.5',    // 50k-150k tokens
        enorme: 'opus-4.5'       // > 150k tokens
      },

      // Por urgência vs. qualidade
      prioridade: {
        'maxima-qualidade': 'opus-4.5',
        'equilibrado': 'sonnet-4.5',
        'rapido-economico': 'haiku-4.5'
      }
    };
  }

  /**
   * Seleciona automaticamente o melhor modelo para a tarefa
   *
   * @param {object} context - Contexto da tarefa
   * @returns {object} Modelo selecionado com justificativa
   */
  selectModel(context = {}) {
    const {
      tipo = null,              // Tipo de peça ou tarefa
      prompt = '',              // Texto do prompt
      documentos = [],          // Documentos a processar
      prioridade = 'equilibrado', // maxima-qualidade | equilibrado | rapido-economico
      forcePipeline = false,    // Forçar uso de pipeline
      forceModel = null        // Forçar modelo específico
    } = context;

    // Se modelo foi especificado manualmente, usar ele
    if (forceModel) {
      return {
        modelo: forceModel,
        motivo: 'Modelo especificado manualmente',
        confianca: 100,
        usarPipeline: forcePipeline
      };
    }

    // ═══════════════════════════════════════════════════════════
    // ANÁLISE AUTOMÁTICA
    // ═══════════════════════════════════════════════════════════

    let modeloSelecionado = 'sonnet-4.5';  // Padrão
    let motivo = 'Modelo padrão (Sonnet 4.5)';
    let confianca = 50;
    let usarPipeline = false;

    // 1. Verificar se é peça judicial específica
    if (tipo && this.selectionRules.pecasJudiciais[tipo]) {
      modeloSelecionado = this.selectionRules.pecasJudiciais[tipo];
      motivo = `Peça judicial: ${tipo} → Vocação: ${this.modelVocations[modeloSelecionado].vocacao}`;
      confianca = 90;
    }

    // 2. Verificar se é tarefa específica
    else if (tipo && this.selectionRules.tarefas[tipo]) {
      modeloSelecionado = this.selectionRules.tarefas[tipo];
      motivo = `Tarefa: ${tipo} → Vocação: ${this.modelVocations[modeloSelecionado].vocacao}`;
      confianca = 85;
    }

    // 3. Analisar tamanho do input
    else {
      const tokensEstimados = this.estimateTokens(prompt, documentos);

      if (tokensEstimados < 5000) {
        modeloSelecionado = 'haiku-4.5';
        motivo = `Input pequeno (${tokensEstimados} tokens) → Haiku 4.5 (rápido)`;
        confianca = 70;
      } else if (tokensEstimados > 150000) {
        modeloSelecionado = 'opus-4.5';
        motivo = `Input muito grande (${tokensEstimados} tokens) → Opus 4.5 (capacidade máxima)`;
        confianca = 95;
      } else {
        modeloSelecionado = 'sonnet-4.5';
        motivo = `Input médio (${tokensEstimados} tokens) → Sonnet 4.5 (padrão)`;
        confianca = 80;
      }
    }

    // 4. Ajustar por prioridade
    if (prioridade === 'maxima-qualidade' && modeloSelecionado !== 'opus-4.5') {
      modeloSelecionado = 'opus-4.5';
      motivo += ' | Prioridade: Máxima Qualidade → Opus 4.5';
      confianca = 95;
    } else if (prioridade === 'rapido-economico' && modeloSelecionado === 'opus-4.5') {
      modeloSelecionado = 'sonnet-4.5';
      motivo += ' | Prioridade: Rápido/Econômico → Sonnet 4.5';
      confianca = 75;
    }

    // 5. Detectar se precisa de imagem (multimodal)
    if (this.needsMultimodal(prompt, documentos)) {
      modeloSelecionado = 'nova-pro';
      motivo = 'Detectado necessidade de análise multimodal → Nova Pro';
      confianca = 90;
    }

    // 6. Detectar se precisa de cálculo complexo
    if (this.needsCalculation(prompt)) {
      modeloSelecionado = 'llama-3.3-70b';
      motivo = 'Detectado necessidade de cálculo → Llama 3.3 70B';
      confianca = 85;
    }

    // 7. Detectar se precisa de raciocínio explícito
    if (this.needsExplicitReasoning(prompt)) {
      modeloSelecionado = 'deepseek-r1';
      motivo = 'Detectado necessidade de raciocínio explícito → DeepSeek R1';
      confianca = 85;
    }

    // 8. Decidir se deve usar pipeline
    if (forcePipeline) {
      usarPipeline = true;
    } else {
      // Pipeline apenas para tarefas muito grandes ou complexas
      usarPipeline = this.shouldUsePipeline(context, modeloSelecionado);
    }

    return {
      modelo: this.modelVocations[modeloSelecionado].id,
      modeloNome: modeloSelecionado,
      vocacao: this.modelVocations[modeloSelecionado].vocacao,
      motivo,
      confianca,
      usarPipeline,
      metadata: {
        custoRelativo: this.modelVocations[modeloSelecionado].custoRelativo,
        qualidade: this.modelVocations[modeloSelecionado].qualidade,
        tokens: this.modelVocations[modeloSelecionado].tokens
      }
    };
  }

  /**
   * Estima quantidade de tokens no input
   */
  estimateTokens(prompt, documentos = []) {
    // Estimativa aproximada: 1 token ≈ 4 caracteres
    let totalChars = prompt.length;

    for (const doc of documentos) {
      if (doc.text) totalChars += doc.text.length;
      if (doc.content) totalChars += doc.content.length;
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * Detecta se precisa de análise multimodal
   */
  needsMultimodal(prompt, documentos = []) {
    const keywords = [
      'imagem', 'foto', 'fotografia', 'planta baixa', 'mapa',
      'gráfico', 'diagrama', 'ilustração', 'visual', 'figura'
    ];

    const promptLower = prompt.toLowerCase();

    // Verificar keywords no prompt
    if (keywords.some(k => promptLower.includes(k))) {
      return true;
    }

    // Verificar se há documentos com imagens
    const hasImages = documentos.some(doc =>
      doc.type && (
        doc.type.includes('image') ||
        doc.name?.endsWith('.png') ||
        doc.name?.endsWith('.jpg') ||
        doc.name?.endsWith('.jpeg')
      )
    );

    return hasImages;
  }

  /**
   * Detecta se precisa de cálculo
   */
  needsCalculation(prompt) {
    const keywords = [
      'calcul', 'valor', 'honorários', 'custas', 'juros',
      'correção monetária', 'somar', 'subtrair', 'multiplicar',
      'percentual', 'porcentagem', 'total', 'parcela'
    ];

    const promptLower = prompt.toLowerCase();
    return keywords.some(k => promptLower.includes(k));
  }

  /**
   * Detecta se precisa de raciocínio explícito
   */
  needsExplicitReasoning(prompt) {
    const keywords = [
      'fundament', 'justific', 'porque', 'por que', 'razão',
      'motivo', 'explicar', 'demonstr', 'passo a passo',
      'cadeia lógica', 'dedução'
    ];

    const promptLower = prompt.toLowerCase();
    return keywords.some(k => promptLower.includes(k));
  }

  /**
   * Decide se deve usar pipeline multi-agent
   */
  shouldUsePipeline(context, modeloSelecionado) {
    const { tipo, documentos = [], prompt = '' } = context;

    // Pipeline APENAS para:
    // 1. Documentos muito grandes (>100 páginas)
    // 2. Múltiplos documentos complexos (>10 docs)
    // 3. Tarefas específicas que se beneficiam

    const numDocumentos = documentos.length;
    const totalPages = documentos.reduce((sum, doc) => sum + (doc.pages || 0), 0);

    // Se mais de 100 páginas ou mais de 10 documentos
    if (totalPages > 100 || numDocumentos > 10) {
      return true;
    }

    // Para tipos específicos que exigem pipeline
    const tiposQueExigemPipeline = [
      'caso-completo',
      'analise-exaustiva',
      'revisao-criminal',
      'habeas-corpus-complexo'
    ];

    if (tiposQueExigemPipeline.includes(tipo)) {
      return true;
    }

    // Padrão: NÃO usar pipeline (modelo único é mais eficiente)
    return false;
  }

  /**
   * Obter informações sobre um modelo
   */
  getModelInfo(modelName) {
    return this.modelVocations[modelName] || null;
  }

  /**
   * Listar todos os modelos e suas vocações
   */
  listModels() {
    return Object.entries(this.modelVocations).map(([name, info]) => ({
      name,
      id: info.id,
      vocacao: info.vocacao,
      melhorPara: info.melhorPara,
      custoRelativo: info.custoRelativo,
      qualidade: info.qualidade
    }));
  }

  /**
   * Obter estatísticas de uso (placeholder para futuro)
   */
  getUsageStats() {
    return {
      message: 'Estatísticas de uso serão implementadas em versão futura',
      recommendation: 'Use Sonnet 4.5 como padrão para 90% das tarefas'
    };
  }
}

// Singleton
const modelSelectorService = new ModelSelectorService();

export default modelSelectorService;
