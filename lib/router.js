/**
 * ROM Agent - Biblioteca de Roteamento Inteligente
 *
 * Seleciona automaticamente o modelo ideal para cada tipo de peça
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar configurações
const configPath = path.join(__dirname, '..', 'config');
const routerConfig = JSON.parse(fs.readFileSync(path.join(configPath, 'router_config.json'), 'utf8'));
const pieceRouting = JSON.parse(fs.readFileSync(path.join(configPath, 'piece_routing.json'), 'utf8'));
const cacheConfig = JSON.parse(fs.readFileSync(path.join(configPath, 'cache_config.json'), 'utf8'));

/**
 * Determina o tier ideal para uma peça jurídica
 * @param {string} pieceType - Tipo da peça (ex: "recurso_especial")
 * @param {string} area - Área do direito (ex: "criminal")
 * @returns {string} - Tier recomendado
 */
export function determineTier(pieceType, area = null) {
  // 1. Verifica override explícito TIER_4_ULTRA
  if (pieceRouting.explicit_overrides.TIER_4_ULTRA.includes(pieceType)) {
    return 'TIER_4_ULTRA';
  }

  // 2. Verifica override explícito TIER_3_PREMIUM
  if (pieceRouting.explicit_overrides.TIER_3_PREMIUM.includes(pieceType)) {
    return 'TIER_3_PREMIUM';
  }

  // 3. Verifica override explícito TIER_1_FAST
  if (pieceRouting.explicit_overrides.TIER_1_FAST.includes(pieceType)) {
    return 'TIER_1_FAST';
  }

  // 4. Verifica em judiciais_base
  if (pieceRouting.judiciais_base && pieceRouting.judiciais_base[pieceType]) {
    return pieceRouting.judiciais_base[pieceType];
  }

  // 5. Verifica em extrajudiciais_base
  if (pieceRouting.extrajudiciais_base && pieceRouting.extrajudiciais_base[pieceType]) {
    return pieceRouting.extrajudiciais_base[pieceType];
  }

  // 6. Usa default da área
  if (area && pieceRouting.area_defaults[area]) {
    return pieceRouting.area_defaults[area];
  }

  // 7. Fallback
  return pieceRouting.fallback_tier;
}

/**
 * Obtém configuração do profile para um tier
 * @param {string} tier - Tier (ex: "TIER_3_PREMIUM")
 * @returns {object} - Configuração do profile
 */
export function getProfileConfig(tier) {
  const profileName = pieceRouting.tier_definitions[tier].profile;
  return routerConfig.router_profiles[profileName];
}

/**
 * Seleciona automaticamente o modelo ideal
 * @param {string} pieceType - Tipo da peça
 * @param {string} area - Área do direito (opcional)
 * @param {string} modeOverride - Override manual do modo (opcional)
 * @returns {object} - Configuração completa para a chamada
 */
export function selectModel(pieceType, area = null, modeOverride = null) {
  // Se há override manual
  if (modeOverride && routerConfig.mode_to_profile_mapping[modeOverride]) {
    const profileName = routerConfig.mode_to_profile_mapping[modeOverride];
    return {
      tier: modeOverride,
      profile: profileName,
      config: routerConfig.router_profiles[profileName],
      isOverride: true
    };
  }

  // Determina automaticamente
  const tier = determineTier(pieceType, area);
  const profileName = pieceRouting.tier_definitions[tier].profile;
  const config = routerConfig.router_profiles[profileName];

  return {
    tier: tier,
    profile: profileName,
    config: config,
    isOverride: false
  };
}

/**
 * Verifica se uma peça deve usar pipeline multi-modelo
 * @param {string} pieceType - Tipo da peça
 * @returns {boolean}
 */
export function requiresPipeline(pieceType) {
  return pieceRouting.explicit_overrides.TIER_4_ULTRA.includes(pieceType);
}

/**
 * Obtém configuração do pipeline para peças ULTRA
 * @returns {object} - Configuração do pipeline
 */
export function getPipelineConfig() {
  const ultraConfig = routerConfig.router_profiles.ULTRA;
  return {
    stages: ultraConfig.pipeline_stages,
    models: {
      reasoning: ultraConfig.preprocessing_model,
      drafting: ultraConfig.primary_model,
      review: ultraConfig.review_model
    }
  };
}

/**
 * Constrói prompt otimizado para cache
 * @param {object} staticContent - Conteúdo estático
 * @param {object} dynamicContent - Conteúdo dinâmico
 * @returns {string} - Prompt completo
 */
export function buildOptimizedPrompt(staticContent = {}, dynamicContent = {}) {
  const base = cacheConfig.system_prompt_base;

  // PARTE ESTÁTICA (cacheada)
  let staticPart = `${base.role}

## Capacidades
${base.capabilities.map(c => '- ' + c).join('\n')}

## Regras de Formatação
- Metodologia: ${base.formatting_rules.methodology}
- Citações: ${base.formatting_rules.citation_format}
- Estrutura: ${base.formatting_rules.structure}
- Jurisprudência: ${base.formatting_rules.jurisprudence}
`;

  if (staticContent.additional) {
    staticPart += '\n' + staticContent.additional;
  }

  // PARTE DINÂMICA (não cacheada)
  let dynamicPart = '';

  if (dynamicContent.caseData) {
    dynamicPart += `\n## Dados do Caso\n${dynamicContent.caseData}\n`;
  }
  if (dynamicContent.documents) {
    dynamicPart += `\n## Documentos\n${dynamicContent.documents}\n`;
  }
  if (dynamicContent.jurisprudence) {
    dynamicPart += `\n## Jurisprudência\n${dynamicContent.jurisprudence}\n`;
  }
  if (dynamicContent.instruction) {
    dynamicPart += `\n## Instrução\n${dynamicContent.instruction}\n`;
  }

  return staticPart + '\n---\n' + dynamicPart;
}

/**
 * Estima custo para uma tarefa
 * @param {string} pieceType - Tipo da peça
 * @param {number} estimatedTokens - Tokens estimados (em milhões)
 * @returns {object} - Estimativa de custo
 */
export function estimateCost(pieceType, estimatedTokens = 0.1) {
  const selection = selectModel(pieceType);
  const costPer1M = selection.config.estimated_cost_per_1m_tokens;
  const estimated = costPer1M * estimatedTokens;

  // Comparar com se usasse sempre Sonnet
  const sonnetCost = 18.00 * estimatedTokens;
  const savings = ((sonnetCost - estimated) / sonnetCost * 100).toFixed(1);

  return {
    model: selection.config.primary_model,
    tier: selection.tier,
    estimatedCost: '$' + estimated.toFixed(2),
    vsAlwaysSonnet: '$' + sonnetCost.toFixed(2),
    savings: savings + '%'
  };
}

// Exportar configs
export { routerConfig, pieceRouting, cacheConfig };

// Export default
export default {
  determineTier,
  getProfileConfig,
  selectModel,
  requiresPipeline,
  getPipelineConfig,
  buildOptimizedPrompt,
  estimateCost,
  routerConfig,
  pieceRouting,
  cacheConfig
};

// Se executado diretamente, mostrar exemplos
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('=== ROM Agent - Teste de Roteamento ===\n');

  const testes = [
    { piece: 'recurso_especial', area: 'criminal' },
    { piece: 'peticao_inicial', area: 'civel_geral' },
    { piece: 'notificacao_extrajudicial', area: null },
    { piece: 'apelação', area: 'criminal' },
    { piece: 'habeas_corpus_liminar', area: 'criminal' }
  ];

  testes.forEach(t => {
    const result = selectModel(t.piece, t.area);
    const cost = estimateCost(t.piece);
    console.log(`${t.piece}:`);
    console.log(`  Tier: ${result.tier}`);
    console.log(`  Modelo: ${result.config.primary_model}`);
    console.log(`  Custo est.: ${cost.estimatedCost} (economia: ${cost.savings})`);
    console.log('');
  });
}
