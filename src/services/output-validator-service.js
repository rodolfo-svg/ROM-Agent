/**
 * ROM Agent - Validador de Output
 * Remove emojis, markdown excessivo e sinais de IA das respostas
 *
 * @version 1.0.0
 * @created 2026-04-23
 */

/**
 * Regex para detectar emojis
 */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]/gu;

/**
 * Termos que indicam IA e devem ser removidos ou substituidos
 */
const IA_TERMS = [
  { pattern: /\b(como IA|como uma IA|enquanto IA|sou uma IA|sou um modelo|como modelo de linguagem)\b/gi, replacement: '' },
  { pattern: /\b(Claude|GPT|ChatGPT|OpenAI|Anthropic|modelo de linguagem|inteligencia artificial)\b/gi, replacement: '' },
  { pattern: /\b(como assistente|assistente virtual|assistente de IA)\b/gi, replacement: '' },
  { pattern: /\bIA\b(?!\s*[A-Z])/g, replacement: '' }, // Remove "IA" solto mas preserva siglas como "IA-ROM"
  { pattern: /eu nao (tenho|possuo) (a capacidade|capacidade) de/gi, replacement: 'nao e possivel' },
  { pattern: /como (um|uma) (modelo|IA|assistente)/gi, replacement: '' },
];

/**
 * Markdown patterns excessivos para limpar
 */
const MARKDOWN_PATTERNS = [
  { pattern: /\*\*\*(.+?)\*\*\*/g, replacement: '$1' }, // ***bold italic*** -> text
  { pattern: /\*\*(.+?)\*\*/g, replacement: '$1' }, // **bold** -> text
  { pattern: /\*(.+?)\*/g, replacement: '$1' }, // *italic* -> text
  { pattern: /_{2}(.+?)_{2}/g, replacement: '$1' }, // __underline__ -> text
  { pattern: /_(.+?)_/g, replacement: '$1' }, // _italic_ -> text
  { pattern: /~~(.+?)~~/g, replacement: '$1' }, // ~~strikethrough~~ -> text
  { pattern: /^#+\s*/gm, replacement: '' }, // # headers -> text
  { pattern: /^\s*[-*+]\s+/gm, replacement: '- ' }, // Normaliza listas
  { pattern: /^\s*\d+\.\s+/gm, replacement: '' }, // Remove numeracao de listas
  { pattern: /`{3}[\s\S]*?`{3}/g, replacement: '' }, // Remove code blocks
  { pattern: /`([^`]+)`/g, replacement: '$1' }, // Remove inline code
];

/**
 * Limpa texto removendo emojis
 * @param {string} text - Texto para limpar
 * @returns {string} Texto sem emojis
 */
function removeEmojis(text) {
  if (!text) return '';
  return text.replace(EMOJI_REGEX, '').trim();
}

/**
 * Remove termos relacionados a IA
 * @param {string} text - Texto para limpar
 * @returns {string} Texto sem mencoes a IA
 */
function removeAITerms(text) {
  if (!text) return '';

  let result = text;
  for (const { pattern, replacement } of IA_TERMS) {
    result = result.replace(pattern, replacement);
  }

  // Limpar espacos duplos resultantes
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Remove markdown excessivo
 * @param {string} text - Texto com markdown
 * @returns {string} Texto limpo
 */
function removeExcessiveMarkdown(text) {
  if (!text) return '';

  let result = text;
  for (const { pattern, replacement } of MARKDOWN_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

/**
 * Corrige pontuacao comum
 * @param {string} text - Texto para corrigir
 * @returns {string} Texto com pontuacao corrigida
 */
function fixPunctuation(text) {
  if (!text) return '';

  let result = text;

  // Remove espacos antes de pontuacao
  result = result.replace(/\s+([.,;:!?])/g, '$1');

  // Adiciona espaco apos pontuacao se nao houver
  result = result.replace(/([.,;:!?])([A-Za-z])/g, '$1 $2');

  // Remove pontuacao duplicada
  result = result.replace(/([.,;:!?])\1+/g, '$1');

  // Corrige aspas
  result = result.replace(/[""](?!s\b)/g, '"');
  result = result.replace(/['']/g, "'");

  // Primeira letra maiuscula apos ponto
  result = result.replace(/\.\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);

  return result;
}

/**
 * Remove linhas vazias excessivas
 * @param {string} text - Texto com linhas vazias
 * @returns {string} Texto formatado
 */
function normalizeWhitespace(text) {
  if (!text) return '';

  // Maximo 2 quebras de linha consecutivas
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Validador principal - aplica todas as correcoes
 * @param {string} text - Texto do output da IA
 * @param {Object} options - Opcoes de validacao
 * @param {boolean} options.removeEmojis - Remover emojis (default: true)
 * @param {boolean} options.removeAI - Remover mencoes a IA (default: true)
 * @param {boolean} options.removeMarkdown - Remover markdown (default: true)
 * @param {boolean} options.fixPunctuation - Corrigir pontuacao (default: true)
 * @returns {string} Texto validado e limpo
 */
function validateOutput(text, options = {}) {
  if (!text) return '';

  const {
    removeEmojis: doRemoveEmojis = true,
    removeAI = true,
    removeMarkdown = true,
    fixPunctuation: doFixPunctuation = true
  } = options;

  let result = text;

  // 1. Remover emojis
  if (doRemoveEmojis) {
    result = removeEmojis(result);
  }

  // 2. Remover mencoes a IA
  if (removeAI) {
    result = removeAITerms(result);
  }

  // 3. Remover markdown excessivo
  if (removeMarkdown) {
    result = removeExcessiveMarkdown(result);
  }

  // 4. Corrigir pontuacao
  if (doFixPunctuation) {
    result = fixPunctuation(result);
  }

  // 5. Normalizar espacos em branco
  result = normalizeWhitespace(result);

  return result;
}

/**
 * Versao leve do validador - apenas remove emojis e mencoes a IA
 * Util para respostas em streaming onde performance e critica
 * @param {string} text - Texto para limpar
 * @returns {string} Texto limpo
 */
function validateOutputLight(text) {
  if (!text) return '';
  return normalizeWhitespace(removeAITerms(removeEmojis(text)));
}

/**
 * Verifica se o texto contem sinais de IA
 * @param {string} text - Texto para verificar
 * @returns {boolean} True se contem sinais de IA
 */
function hasAIIndicators(text) {
  if (!text) return false;

  const aiPatterns = [
    /\bcomo IA\b/i,
    /\bsou uma? (IA|modelo|assistente)\b/i,
    /\bClaude\b/i,
    /\bGPT\b/i,
    /\bmodelo de linguagem\b/i,
    /\binteligencia artificial\b/i
  ];

  return aiPatterns.some(pattern => pattern.test(text));
}

/**
 * Conta emojis no texto
 * @param {string} text - Texto para verificar
 * @returns {number} Quantidade de emojis
 */
function countEmojis(text) {
  if (!text) return 0;
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

export {
  validateOutput,
  validateOutputLight,
  removeEmojis,
  removeAITerms,
  removeExcessiveMarkdown,
  fixPunctuation,
  normalizeWhitespace,
  hasAIIndicators,
  countEmojis
};

export default validateOutput;
