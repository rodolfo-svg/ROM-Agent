/**
 * Configuração Dinâmica de Limites de Tokens
 * ROM Agent - Superior ao Claude.ai
 *
 * Claude.ai (web): 8.192 tokens máximo
 * ROM Agent: Até 64.000 tokens (8x superior!)
 */

/**
 * Limites de tokens por tipo de peça jurídica
 */
export const TOKEN_LIMITS = {
  // ═══════════════════════════════════════════════════════════════
  // PEÇAS MUITO LONGAS - 64K (8x SUPERIOR AO CLAUDE.AI)
  // ═══════════════════════════════════════════════════════════════
  'peticao_inicial_civel': 64000,
  'peticao_inicial_criminal': 64000,
  'peticao_inicial_trabalhista': 64000,
  'contestacao_civel': 64000,
  'contestacao_criminal': 64000,
  'contestacao_trabalhista': 64000,
  'recurso_apelacao': 64000,
  'recurso_especial': 64000,
  'recurso_extraordinario': 64000,
  'analise_processual': 64000,
  'analise_completa': 64000,
  'habeas_corpus': 64000,
  'mandado_seguranca': 64000,
  'acao_direta_inconstitucionalidade': 64000,
  'peticao_inicial': 64000,  // Genérico

  // ═══════════════════════════════════════════════════════════════
  // PEÇAS LONGAS - 32K (4x SUPERIOR AO CLAUDE.AI)
  // ═══════════════════════════════════════════════════════════════
  'agravo_instrumento': 32000,
  'agravo_interno': 32000,
  'impugnacao': 32000,
  'memorial': 32000,
  'parecer_juridico': 32000,
  'parecer': 32000,
  'replica': 32000,
  'treplica': 32000,
  'embargos_declaracao': 32000,
  'razoes_recurso': 32000,
  'contrarrazoes_recurso': 32000,

  // ═══════════════════════════════════════════════════════════════
  // PEÇAS CRIMINAIS - 32K
  // ═══════════════════════════════════════════════════════════════
  'resposta_acusacao': 32000,
  'defesa_previa': 32000,
  'alegacoes_finais': 32000,
  'alegacoes_finais_defesa': 32000,
  'alegacoes_finais_acusacao': 32000,
  'impugnacao_acusacao': 32000,
  'suspensao_condicional': 32000,
  'transacao_penal': 32000,
  'liberdade_provisoria': 32000,
  'revogacao_prisao': 32000,

  // ═══════════════════════════════════════════════════════════════
  // PEÇAS GERAIS APLICÁVEIS A TODAS AS ÁREAS - 32K
  // ═══════════════════════════════════════════════════════════════
  'peticao_generica': 32000,
  'manifestacao': 32000,
  'manifestacao_processo': 32000,
  'memorando': 32000,
  'peticao_aditamento': 32000,
  'esclarecimentos': 32000,
  'informacoes': 32000,

  // ═══════════════════════════════════════════════════════════════
  // PEÇAS MÉDIAS - 16K (2x SUPERIOR AO CLAUDE.AI)
  // ═══════════════════════════════════════════════════════════════
  'requerimento': 16000,
  'pedido': 16000,
  'notificacao': 16000,
  'intimacao': 16000,
  'declaracao': 16000,
  'procuracao': 16000,
  'substabelecimento': 16000,
  'peticao_simples': 16000,
  'peticao_intermediaria': 16000,
  'juntada_documentos': 16000,
  'desistencia': 16000,
  'renúncia': 16000,
  'cumprimento_diligencia': 16000,
  'certidao': 16000,
  'ata': 16000,
  'termo': 16000,

  // ═══════════════════════════════════════════════════════════════
  // CHAT E CONSULTAS - 8K (IGUAL AO CLAUDE.AI)
  // ═══════════════════════════════════════════════════════════════
  'chat': 8192,
  'consulta': 8192,
  'pergunta': 8192,
  'esclarecimento': 8192,

  // ═══════════════════════════════════════════════════════════════
  // DEFAULT E OUTROS - 8K (CONSERVADOR)
  // ═══════════════════════════════════════════════════════════════
  'default': 8192,
  'outros': 8192,
  'other': 8192,
  'personalizado': 8192,
  'custom': 8192
};

/**
 * Obter limite de tokens baseado no tipo de peça
 * @param {string} tipoPeca - Tipo da peça jurídica
 * @returns {number} Limite de tokens
 */
export function getMaxTokens(tipoPeca) {
  if (!tipoPeca) return TOKEN_LIMITS.default;

  // Normalizar: lowercase e remover acentos
  const normalized = tipoPeca
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Buscar correspondência exata
  if (TOKEN_LIMITS[normalized]) {
    return TOKEN_LIMITS[normalized];
  }

  // Buscar por palavras-chave
  if (normalized.includes('peticao') && normalized.includes('inicial')) {
    return 64000;
  }
  if (normalized.includes('contestacao')) {
    return 64000;
  }
  if (normalized.includes('recurso')) {
    return 64000;
  }
  if (normalized.includes('analise')) {
    return 64000;
  }
  if (normalized.includes('habeas')) {
    return 64000;
  }
  if (normalized.includes('agravo')) {
    return 32000;
  }
  if (normalized.includes('parecer')) {
    return 32000;
  }
  if (normalized.includes('memorial')) {
    return 32000;
  }
  if (normalized.includes('requerimento')) {
    return 16000;
  }
  if (normalized.includes('pedido')) {
    return 16000;
  }

  // Default
  return TOKEN_LIMITS.default;
}

/**
 * Obter categoria baseada no limite de tokens
 * @param {number} maxTokens - Limite de tokens
 * @returns {string} Categoria
 */
export function getTokenCategory(maxTokens) {
  if (maxTokens >= 64000) return 'SUPERIOR (8x Claude.ai)';
  if (maxTokens >= 32000) return 'LONGA (4x Claude.ai)';
  if (maxTokens >= 16000) return 'MÉDIA (2x Claude.ai)';
  return 'PADRÃO (= Claude.ai)';
}

/**
 * Obter estimativa de custo baseado em tokens
 * @param {number} maxTokens - Limite de tokens
 * @param {number} inputTokens - Tokens de entrada (padrão: 50K)
 * @returns {Object} Estimativa de custo
 */
export function estimateCost(maxTokens, inputTokens = 50000) {
  const COST_PER_MILLION_INPUT = 3.00;
  const COST_PER_MILLION_OUTPUT = 15.00;

  const inputCost = (inputTokens / 1000000) * COST_PER_MILLION_INPUT;
  const outputCost = (maxTokens / 1000000) * COST_PER_MILLION_OUTPUT;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: inputCost.toFixed(2),
    outputCost: outputCost.toFixed(2),
    totalCost: totalCost.toFixed(2),
    vsClaudeAI: ((totalCost / 0.27) * 100).toFixed(0) + '%'
  };
}

/**
 * Listar todos os tipos de peças com seus limites
 * @returns {Array} Lista de tipos e limites
 */
export function listAllLimits() {
  return Object.entries(TOKEN_LIMITS)
    .map(([tipo, limite]) => ({
      tipo,
      limite,
      categoria: getTokenCategory(limite),
      custo: estimateCost(limite)
    }))
    .sort((a, b) => b.limite - a.limite);
}

/**
 * Estatísticas dos limites configurados
 * @returns {Object} Estatísticas
 */
export function getStatistics() {
  const limites = Object.values(TOKEN_LIMITS);
  const tipos = Object.keys(TOKEN_LIMITS).length - 1; // -1 para excluir default

  const superiores = limites.filter(l => l >= 64000).length;
  const longas = limites.filter(l => l >= 32000 && l < 64000).length;
  const medias = limites.filter(l => l >= 16000 && l < 32000).length;
  const padroes = limites.filter(l => l < 16000).length;

  return {
    totalTipos: tipos,
    distribuicao: {
      superiores: `${superiores} tipos (64K - 8x Claude.ai)`,
      longas: `${longas} tipos (32K - 4x Claude.ai)`,
      medias: `${medias} tipos (16K - 2x Claude.ai)`,
      padroes: `${padroes} tipos (8K - = Claude.ai)`
    },
    limiteMaximo: Math.max(...limites),
    limiteMinimo: Math.min(...limites.filter(l => l > 0)),
    limiteMedia: Math.round(limites.reduce((a, b) => a + b, 0) / limites.length)
  };
}

// Exportar configuração padrão
export default {
  TOKEN_LIMITS,
  getMaxTokens,
  getTokenCategory,
  estimateCost,
  listAllLimits,
  getStatistics
};
