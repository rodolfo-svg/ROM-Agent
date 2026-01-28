/**
 * CONTEXT MANAGER - Gerenciamento Inteligente de Contexto para Chat
 *
 * Resolve o problema de "Input is too long for requested model"
 *
 * Funcionalidades:
 * - Estimativa de tokens
 * - Limitação inteligente de contexto
 * - Resumo automático de documentos grandes
 * - Priorização de conteúdo relevante
 */

import logger from '../../lib/logger.js';

/**
 * Limites de tokens por modelo
 */
const MODEL_LIMITS = {
  // Anthropic Claude Models
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-sonnet-4-20250514': 200000,
  'claude-sonnet-4-turbo-20250901': 200000,
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 200000,
  'anthropic.claude-3-5-haiku-20241022-v1:0': 200000,
  'anthropic.claude-sonnet-4-20250514-v1:0': 200000,
  'anthropic.claude-sonnet-4-5-20250929-v1:0': 200000,  // Sonnet 4.5 (default do sistema)
  'anthropic.claude-opus-4-5-20251101-v1:0': 200000,    // Opus 4.5
  'anthropic.claude-opus-4-20250514-v1:0': 200000,      // Opus 4
  'anthropic.claude-haiku-4-5-20251001-v1:0': 200000,   // Haiku 4.5

  // Amazon Nova Models
  'amazon.nova-pro-v1:0': 300000,       // Nova Pro: 300K tokens
  'amazon.nova-lite-v1:0': 300000,      // Nova Lite: 300K tokens
  'amazon.nova-micro-v1:0': 128000,     // Nova Micro: 128K tokens
  'amazon.titan-text-express-v1': 8000, // Titan: 8K tokens

  // Meta Llama Models
  'meta.llama3-3-70b-instruct-v1:0': 128000,   // Llama 3.3 70B
  'meta.llama3-2-90b-instruct-v1:0': 128000,   // Llama 3.2 90B
  'meta.llama3-2-11b-instruct-v1:0': 128000,   // Llama 3.2 11B
  'meta.llama3-1-70b-instruct-v1:0': 128000,   // Llama 3.1 70B
  'meta.llama3-1-8b-instruct-v1:0': 128000,    // Llama 3.1 8B
  'meta.llama4-scout-17b-instruct-v1:0': 128000,   // Llama 4 Scout
  'meta.llama4-maverick-17b-instruct-v1:0': 128000, // Llama 4 Maverick

  // DeepSeek Models
  'deepseek.r1-v1:0': 64000,            // DeepSeek R1: 64K tokens

  // Mistral Models
  'mistral.mistral-large-3-675b-instruct': 128000,  // Mistral Large 3
  'mistral.pixtral-large-2502-v1:0': 128000,        // Pixtral Large
  'mistral.ministral-3-14b-instruct': 128000,       // Ministral 14B
  'mistral.ministral-3-8b-instruct': 128000,        // Ministral 8B

  // Cohere Models
  'cohere.command-r-plus-v1:0': 128000,  // Command R+
  'cohere.command-r-v1:0': 128000,       // Command R

  'default': 200000
};

/**
 * Estimativa conservadora de tokens
 * Aproximação: 1 token ≈ 3.5 caracteres para português
 * @param {string} text - Texto para estimar
 * @returns {number} Número estimado de tokens
 */
export function estimateTokens(text) {
  if (!text) return 0;
  // Fator conservador: 3.5 caracteres por token
  return Math.ceil(text.length / 3.5);
}

/**
 * Obter limite de tokens para um modelo
 * @param {string} model - Nome do modelo
 * @returns {number} Limite máximo de tokens
 */
export function getModelLimit(model) {
  return MODEL_LIMITS[model] || MODEL_LIMITS.default;
}

/**
 * Obter limite seguro de contexto (deixa espaço para resposta)
 * @param {string} model - Nome do modelo
 * @returns {number} Limite seguro de tokens para o contexto
 */
export function getSafeContextLimit(model) {
  const maxTokens = getModelLimit(model);
  // 🔥 OTIMIZAÇÃO v2.10.0: Reduzido de 70% para 25% (~50k tokens para Claude 200k)
  // Motivo: Latências extremas (47-74s) causadas por contexto muito longo
  // Impacto: Redução esperada de 40-60% na latência + economia de 60% nos custos
  // Reservar 75% para a resposta do modelo
  // Usar 25% para contexto (~50k tokens para Claude 200k)
  return Math.floor(maxTokens * 0.25);
}

/**
 * Resumir documento usando estratégia de extração de trechos relevantes
 * @param {string} content - Conteúdo completo do documento
 * @param {string} query - Pergunta do usuário
 * @param {number} maxTokens - Máximo de tokens para o resumo
 * @returns {object} Resumo e metadados
 */
export function extractRelevantSections(content, query, maxTokens = 30000) {
  const maxChars = maxTokens * 3.5; // Aproximação: 3.5 chars/token
  const lines = content.split('\n');
  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 3) // Apenas palavras com mais de 3 caracteres
    .map(term => term.replace(/[^\w]/g, '')); // Remover pontuação

  logger.info(`🔍 Extraindo seções relevantes - Termos de busca: ${queryTerms.join(', ')}`);

  // Scoring de linhas por relevância
  const scoredLines = lines.map((line, index) => {
    const lowerLine = line.toLowerCase();
    let score = 0;

    // Pontuação por termos da query
    queryTerms.forEach(term => {
      if (lowerLine.includes(term)) {
        score += 5;
      }
    });

    // Pontuação extra para termos jurídicos importantes
    const importantTerms = [
      'sentença', 'decisão', 'dispositivo', 'fundamentação',
      'julg', 'condena', 'absolv', 'procedente', 'improcedente',
      'recurso', 'embargo', 'apelação', 'agravo',
      'folha', 'fl.', 'fls.', 'pág', 'página'
    ];

    importantTerms.forEach(term => {
      if (lowerLine.includes(term)) {
        score += 3;
      }
    });

    // Pontuação extra para cabeçalhos (linhas em maiúsculas ou com marcadores)
    if (line.match(/^[A-ZÀ-Ú\s]{10,}$/) || line.match(/^#+\s/) || line.match(/^\d+\./)) {
      score += 2;
    }

    return { line, index, score };
  });

  // Ordenar por score (mais relevante primeiro)
  scoredLines.sort((a, b) => b.score - a.score);

  // Selecionar linhas mais relevantes
  const selectedSections = [];
  let currentSize = 0;
  const maxSections = 20; // Máximo de seções diferentes

  for (let i = 0; i < scoredLines.length && selectedSections.length < maxSections; i++) {
    const scored = scoredLines[i];

    // Pular linhas com score 0 (não relevantes)
    if (scored.score === 0) continue;

    // Extrair contexto: 30 linhas antes e 30 depois da linha relevante
    const contextStart = Math.max(0, scored.index - 30);
    const contextEnd = Math.min(lines.length, scored.index + 31);
    const section = lines.slice(contextStart, contextEnd).join('\n');

    // Verificar se ainda cabe no limite
    if (currentSize + section.length > maxChars) {
      break;
    }

    selectedSections.push({
      section,
      score: scored.score,
      lineNumber: scored.index
    });

    currentSize += section.length;
  }

  // Se não encontrou seções relevantes, usar estratégia de início + fim
  if (selectedSections.length === 0) {
    logger.warn('⚠️ Nenhuma seção relevante encontrada, usando início + fim do documento');
    const halfSize = Math.floor(maxChars / 2);
    return {
      content: content.substring(0, halfSize) +
               '\n\n...[MEIO DO DOCUMENTO OMITIDO]...\n\n' +
               content.substring(Math.max(0, content.length - halfSize)),
      type: 'inicio-fim',
      originalSize: content.length,
      extractedSize: Math.min(content.length, maxChars),
      compressionRatio: Math.min(content.length, maxChars) / content.length
    };
  }

  // Ordenar seções por ordem de aparição no documento
  selectedSections.sort((a, b) => a.lineNumber - b.lineNumber);

  // Juntar seções
  const extractedContent = selectedSections.map((s, i) =>
    `--- SEÇÃO ${i + 1} (Linha ${s.lineNumber}, Relevância: ${s.score}) ---\n${s.section}`
  ).join('\n\n');

  return {
    content: extractedContent,
    type: 'secoes-relevantes',
    sectionsCount: selectedSections.length,
    originalSize: content.length,
    extractedSize: extractedContent.length,
    compressionRatio: extractedContent.length / content.length,
    averageScore: selectedSections.reduce((sum, s) => sum + s.score, 0) / selectedSections.length
  };
}

/**
 * Gerenciar contexto de múltiplos documentos
 * @param {Array} documents - Array de documentos {file, content, metadata}
 * @param {string} query - Pergunta do usuário
 * @param {string} model - Modelo sendo usado
 * @returns {object} Contexto otimizado e estatísticas
 */
export function manageMultiDocumentContext(documents, query, model) {
  const safeLimit = getSafeContextLimit(model);
  const docsCount = documents.length;

  logger.info(`📚 Gerenciando contexto de ${docsCount} documento(s)`);
  logger.info(`🎯 Limite seguro: ${safeLimit.toLocaleString()} tokens (~${Math.floor(safeLimit * 3.5 / 1000)}KB)`);

  // 🔥 AJUSTE DINÂMICO: Reservar espaço para histórico e system prompt
  // Para análises exaustivas, usar apenas 50% do limite para documentos (70K tokens)
  // Deixar 50% para histórico + system prompt (70K tokens)
  const kbBudget = Math.floor(safeLimit * 0.5); // 70K tokens para KB

  logger.info(`💡 Orçamento ajustado para KB: ${kbBudget.toLocaleString()} tokens (50% do limite)`);
  logger.info(`   Reservado para histórico+system: ${(safeLimit - kbBudget).toLocaleString()} tokens`);

  // Calcular budget de tokens por documento
  const tokensPerDoc = Math.floor(kbBudget / docsCount);
  const maxCharsPerDoc = tokensPerDoc * 3.5;

  logger.info(`📊 Budget por documento: ${tokensPerDoc.toLocaleString()} tokens (~${Math.floor(maxCharsPerDoc / 1000)}KB)`);

  const processedDocs = [];
  let totalTokens = 0;

  for (const doc of documents) {
    const originalTokens = estimateTokens(doc.content);

    logger.info(`\n📄 Processando: ${doc.metadata?.originalFilename || doc.file}`);
    logger.info(`   Tamanho original: ${originalTokens.toLocaleString()} tokens`);

    let processedContent;
    let processingInfo;

    if (originalTokens <= tokensPerDoc) {
      // Documento cabe no budget - enviar completo
      processedContent = doc.content;
      processingInfo = {
        type: 'completo',
        originalTokens,
        finalTokens: originalTokens,
        compressionRatio: 1.0
      };
      logger.info(`   ✅ Enviando COMPLETO`);
    } else {
      // Documento muito grande - extrair seções relevantes
      const extraction = extractRelevantSections(doc.content, query, tokensPerDoc);
      processedContent = extraction.content;
      processingInfo = {
        type: extraction.type,
        originalTokens,
        finalTokens: estimateTokens(processedContent),
        compressionRatio: extraction.compressionRatio,
        sectionsCount: extraction.sectionsCount,
        averageScore: extraction.averageScore
      };
      logger.info(`   🔍 Extraídas ${extraction.sectionsCount || 'N/A'} seções relevantes`);
      logger.info(`   📉 Compressão: ${(extraction.compressionRatio * 100).toFixed(1)}%`);
    }

    processedDocs.push({
      file: doc.file,
      metadata: doc.metadata,
      content: processedContent,
      processingInfo
    });

    totalTokens += processingInfo.finalTokens;
  }

  logger.info(`\n✅ Contexto otimizado:`);
  logger.info(`   Documentos: ${docsCount}`);
  logger.info(`   Tokens totais: ${totalTokens.toLocaleString()} / ${kbBudget.toLocaleString()}`);
  logger.info(`   Uso do budget KB: ${(totalTokens / kbBudget * 100).toFixed(1)}%`);

  return {
    documents: processedDocs,
    stats: {
      documentsCount: docsCount,
      totalTokens,
      limitTokens: kbBudget,  // Usar kbBudget ao invés de safeLimit
      usagePercent: (totalTokens / kbBudget * 100).toFixed(1),
      model
    }
  };
}

/**
 * Formatar contexto para inclusão no prompt
 * @param {object} managedContext - Contexto retornado por manageMultiDocumentContext
 * @returns {string} Contexto formatado para o prompt
 */
export function formatContextForPrompt(managedContext) {
  let context = '\n\n📚 DOCUMENTOS DO KNOWLEDGE BASE:\n\n';

  managedContext.documents.forEach((doc, i) => {
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `📄 DOCUMENTO ${i + 1}: ${doc.metadata?.originalFilename || doc.file}\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Metadados
    if (doc.metadata?.type) context += `📋 Tipo: ${doc.metadata.type}\n`;
    if (doc.metadata?.processNumber) context += `⚖️ Processo: ${doc.metadata.processNumber}\n`;
    if (doc.metadata?.parties) context += `👥 Partes: ${doc.metadata.parties}\n`;
    if (doc.metadata?.court) context += `🏛️ Tribunal: ${doc.metadata.court}\n`;

    // Info de processamento
    const info = doc.processingInfo;
    if (info.type !== 'completo') {
      context += `\n🔍 Processamento: ${info.type}\n`;
      context += `📊 Compressão: ${(info.compressionRatio * 100).toFixed(1)}%\n`;
      context += `📏 Tokens: ${info.finalTokens.toLocaleString()} (original: ${info.originalTokens.toLocaleString()})\n`;
      if (info.sectionsCount) {
        context += `📑 Seções extraídas: ${info.sectionsCount}\n`;
      }
    } else {
      context += `\n✅ Documento COMPLETO incluído\n`;
      context += `📏 Tokens: ${info.finalTokens.toLocaleString()}\n`;
    }

    context += `\n📝 Conteúdo:\n\n${doc.content}\n\n`;
  });

  // Estatísticas finais
  context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  context += `📊 ESTATÍSTICAS DO CONTEXTO:\n`;
  context += `   • Documentos incluídos: ${managedContext.stats.documentsCount}\n`;
  context += `   • Tokens totais: ${managedContext.stats.totalTokens.toLocaleString()}\n`;
  context += `   • Limite seguro: ${managedContext.stats.limitTokens.toLocaleString()}\n`;
  context += `   • Uso: ${managedContext.stats.usagePercent}%\n`;
  context += `   • Modelo: ${managedContext.stats.model}\n`;
  context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  return context;
}

/**
 * Truncar histórico de chat para caber dentro do limite de tokens
 * Mantém as mensagens mais recentes e resume ou descarta mensagens antigas
 * @param {Array} history - Array de mensagens {role, content}
 * @param {number} maxTokens - Limite de tokens para o histórico
 * @param {string} kbContext - Contexto do KB (para subtrair do orçamento total)
 * @param {string} currentMessage - Mensagem atual (para subtrair do orçamento total)
 * @returns {Array} Histórico truncado
 */
export function truncateHistory(history, maxTokens = 20000, kbContext = '', currentMessage = '') {
  if (!history || history.length === 0) return [];

  // Estimar tokens já usados pelo KB e mensagem atual
  const kbTokens = estimateTokens(kbContext);
  const messageTokens = estimateTokens(currentMessage);
  const systemPromptTokens = 5000; // Estimativa conservadora para system prompt jurídico

  // Calcular budget disponível para histórico
  const availableForHistory = Math.max(0, maxTokens - kbTokens - messageTokens - systemPromptTokens);

  logger.info(`\n📝 TRUNCAMENTO DE HISTÓRICO:`);
  logger.info(`   Total budget: ${maxTokens.toLocaleString()} tokens`);
  logger.info(`   KB Context: ${kbTokens.toLocaleString()} tokens`);
  logger.info(`   Current Message: ${messageTokens.toLocaleString()} tokens`);
  logger.info(`   System Prompt: ~${systemPromptTokens.toLocaleString()} tokens`);
  logger.info(`   Available for History: ${availableForHistory.toLocaleString()} tokens`);
  logger.info(`   History size: ${history.length} mensagens`);

  // Se o histórico cabe, retornar completo
  const totalHistoryTokens = history.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

  if (totalHistoryTokens <= availableForHistory) {
    logger.info(`   ✅ Histórico completo cabe (${totalHistoryTokens.toLocaleString()} tokens)`);
    return history;
  }

  // Estratégia: manter as mensagens mais recentes
  const truncatedHistory = [];
  let currentTokens = 0;

  // Percorrer do mais recente para o mais antigo
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokens(msg.content);

    if (currentTokens + msgTokens <= availableForHistory) {
      truncatedHistory.unshift(msg); // Adicionar no início
      currentTokens += msgTokens;
    } else {
      // Não cabe mais - parar
      break;
    }
  }

  const removedCount = history.length - truncatedHistory.length;
  logger.info(`   ✂️ Histórico truncado: ${removedCount} mensagem(ns) antiga(s) removida(s)`);
  logger.info(`   📊 Mantidas ${truncatedHistory.length} mensagens (${currentTokens.toLocaleString()} tokens)`);

  return truncatedHistory;
}

export default {
  estimateTokens,
  getModelLimit,
  getSafeContextLimit,
  extractRelevantSections,
  manageMultiDocumentContext,
  formatContextForPrompt,
  truncateHistory
};
