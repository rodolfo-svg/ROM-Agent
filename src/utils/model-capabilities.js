/**
 * ROM Agent - Model Capabilities Detection
 * Detecta automaticamente quais features cada modelo suporta
 * Garante compatibilidade com modelos gratuitos e pagos
 *
 * @module model-capabilities
 * @version 1.0.0
 */

/**
 * Modelos que suportam Tool Use (Function Calling)
 * Baseado em documentação oficial AWS Bedrock e testes
 */
const TOOL_USE_SUPPORTED_MODELS = [
  // Anthropic Claude - TODOS suportam tool use
  /anthropic\.claude/i,
  /claude-opus/i,
  /claude-sonnet/i,
  /claude-haiku/i,

  // Amazon Nova - APENAS Pro e Premier suportam tool use
  /amazon\.nova-pro/i,
  /amazon\.nova-premier/i,

  // Mistral - Large e Pixtral suportam
  /mistral\.mistral-large/i,
  /mistral\.pixtral/i,

  // Cohere Command R+ suporta
  /cohere\.command-r-plus/i
];

/**
 * Modelos que NÃO suportam Tool Use
 * Precisam de fallback manual para pesquisas
 */
const NO_TOOL_USE_MODELS = [
  // Amazon - Modelos básicos
  /amazon\.nova-lite/i,
  /amazon\.nova-micro/i,
  /amazon\.titan/i,

  // Meta Llama - Nenhum suporta tool use nativamente
  /meta\.llama/i,

  // DeepSeek - Não suporta tool use
  /deepseek/i,

  // Mistral - Modelos menores
  /mistral\.ministral/i,

  // Cohere - Command R básico
  /cohere\.command-r(?!-plus)/i
];

/**
 * Detecta se um modelo suporta Tool Use
 *
 * @param {string} modelId - ID do modelo AWS Bedrock
 * @returns {boolean} True se suporta tool use
 */
export function supportsToolUse(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return false;
  }

  // Verifica lista de não-suportados primeiro (mais específico)
  const isUnsupported = NO_TOOL_USE_MODELS.some(regex => regex.test(modelId));
  if (isUnsupported) {
    return false;
  }

  // Verifica lista de suportados
  const isSupported = TOOL_USE_SUPPORTED_MODELS.some(regex => regex.test(modelId));
  return isSupported;
}

/**
 * Detecta se um modelo suporta streaming
 * (Praticamente todos os modelos Bedrock suportam)
 *
 * @param {string} modelId - ID do modelo AWS Bedrock
 * @returns {boolean} True se suporta streaming
 */
export function supportsStreaming(modelId) {
  // Todos os modelos Bedrock suportam streaming
  return true;
}

/**
 * Obtém capacidades completas de um modelo
 *
 * @param {string} modelId - ID do modelo AWS Bedrock
 * @returns {Object} Capabilities object
 */
export function getModelCapabilities(modelId) {
  return {
    toolUse: supportsToolUse(modelId),
    streaming: supportsStreaming(modelId),
    modelId,

    // Metadata
    provider: modelId.split('.')[0] || 'unknown',
    isEconomical: /nova-lite|nova-micro|llama|ministral/.test(modelId),
    isPremium: /opus|premier|large-3/.test(modelId)
  };
}

/**
 * Verifica se deve habilitar tools para este modelo
 * Considera tanto suporte quanto configuração do usuário
 *
 * @param {string} modelId - ID do modelo
 * @param {boolean} userPreference - Preferência do usuário (enableTools)
 * @returns {boolean} True se deve habilitar tools
 */
export function shouldEnableTools(modelId, userPreference = true) {
  // Se usuário explicitamente desabilitou, respeitar
  if (userPreference === false) {
    return false;
  }

  // Se modelo não suporta, não habilitar
  if (!supportsToolUse(modelId)) {
    return false;
  }

  // Modelo suporta e usuário não desabilitou
  return true;
}

/**
 * Obtém mensagem explicativa quando tools não estão disponíveis
 *
 * @param {string} modelId - ID do modelo
 * @returns {string} Mensagem para o usuário
 */
export function getToolsUnavailableMessage(modelId) {
  const capabilities = getModelCapabilities(modelId);

  if (!capabilities.toolUse) {
    return `⚠️ Nota: Este modelo (${capabilities.provider}) não suporta busca automática. ` +
           `Resposta baseada em conhecimento interno. ` +
           `Para buscas em tempo real, use Claude Sonnet/Opus ou Amazon Nova Pro.`;
  }

  return '';
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  supportsToolUse,
  supportsStreaming,
  getModelCapabilities,
  shouldEnableTools,
  getToolsUnavailableMessage
};
