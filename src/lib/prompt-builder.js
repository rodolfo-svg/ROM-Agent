/**
 * PromptBuilder - Modular Prompt Construction System
 * Version: 1.0
 *
 * Features:
 * - Conditional loading of prompt modules (base + tools + ABNT)
 * - 79% token reduction vs original prompts
 * - Feature flag support for A/B testing
 * - Hash-based user bucketing for deterministic assignment
 * - Prompt caching for performance
 *
 * Token Estimates:
 * - Base only: ~438 tokens
 * - Base + Tools: ~1,488 tokens
 * - Base + ABNT: ~1,463 tokens
 * - Base + Tools + ABNT: ~2,513 tokens
 * - Original (legacy): ~2,058 tokens
 */

import {
  OPTIMIZED_SYSTEM_PROMPT,
  TOOL_SPECIFIC_INSTRUCTIONS,
  ABNT_FORMATTING_RULES,
  DOCUMENT_TYPE_MAP,
  TOOL_KEYWORDS,
  ABNT_KEYWORDS
} from '../modules/optimized-prompts.js';

// Simple cache for built prompts
const promptCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * PromptBuilder Class
 * Constructs optimized system prompts based on context
 */
export class PromptBuilder {
  constructor(options = {}) {
    this.version = options.version || process.env.PROMPTS_VERSION || 'optimized';
    this.trafficPercentage = parseFloat(options.trafficPercentage || process.env.TRAFFIC_PERCENTAGE || '100');
    this.enableCaching = options.enableCaching !== false;
    this.legacyPromptLoader = options.legacyPromptLoader || null;
  }

  /**
   * Build system prompt based on options
   * @param {Object} options - Build options
   * @param {boolean} options.includeTools - Load tool instructions
   * @param {boolean} options.includeABNT - Load ABNT formatting rules
   * @param {string} options.documentType - Specific document template
   * @param {string} options.userId - User ID for A/B bucketing
   * @returns {Object} { prompt: string, tokens: number, modules: string[] }
   */
  build(options = {}) {
    const {
      includeTools = false,
      includeABNT = false,
      documentType = null,
      userId = null
    } = options;

    // Check if user is in optimized bucket
    const useOptimized = this.shouldUseOptimized(userId);

    if (!useOptimized && this.legacyPromptLoader) {
      return this.buildLegacy();
    }

    // Generate cache key
    const cacheKey = `${includeTools}-${includeABNT}-${documentType || 'none'}`;

    // Check cache
    if (this.enableCaching && promptCache.has(cacheKey)) {
      const cached = promptCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.result;
      }
      promptCache.delete(cacheKey);
    }

    // Build prompt
    const parts = [OPTIMIZED_SYSTEM_PROMPT];
    const modules = ['core'];
    let estimatedTokens = 438; // Base tokens

    // Add tool instructions if needed
    if (includeTools) {
      parts.push('\n\n---\n\n');
      parts.push(TOOL_SPECIFIC_INSTRUCTIONS);
      modules.push('tools');
      estimatedTokens += 1050;
    }

    // Add ABNT formatting if needed
    if (includeABNT) {
      parts.push('\n\n---\n\n');
      parts.push(ABNT_FORMATTING_RULES);
      modules.push('abnt');
      estimatedTokens += 1025;
    }

    const prompt = parts.join('');

    const result = {
      prompt,
      tokens: estimatedTokens,
      modules,
      size: prompt.length,
      version: 'optimized'
    };

    // Cache result
    if (this.enableCaching) {
      promptCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Build legacy prompt using original system
   * @returns {Object} { prompt: string, tokens: number, modules: string[] }
   */
  buildLegacy() {
    if (!this.legacyPromptLoader) {
      throw new Error('Legacy prompt loader not configured');
    }

    const prompt = this.legacyPromptLoader();
    return {
      prompt,
      tokens: Math.ceil(prompt.length / 4), // Rough estimate
      modules: ['legacy'],
      size: prompt.length,
      version: 'legacy'
    };
  }

  /**
   * Determine if user should get optimized prompts based on traffic percentage
   * Uses deterministic hash-based bucketing for consistent assignment
   * @param {string} userId - User identifier
   * @returns {boolean}
   */
  shouldUseOptimized(userId) {
    // If explicitly set to legacy, always use legacy
    if (this.version === 'legacy' || this.version === 'original') {
      return false;
    }

    // If 100% traffic, always use optimized
    if (this.trafficPercentage >= 100) {
      return true;
    }

    // If 0% traffic, always use legacy
    if (this.trafficPercentage <= 0) {
      return false;
    }

    // If no userId, use random bucketing
    if (!userId) {
      return Math.random() * 100 < this.trafficPercentage;
    }

    // Hash-based deterministic bucketing
    const hash = this.hashString(userId);
    const bucket = hash % 100;
    return bucket < this.trafficPercentage;
  }

  /**
   * Simple string hash function for deterministic bucketing
   * @param {string} str - String to hash
   * @returns {number} Hash value (0-99)
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Clear the prompt cache
   */
  static clearCache() {
    promptCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} { size: number, keys: string[] }
   */
  static getCacheStats() {
    return {
      size: promptCache.size,
      keys: Array.from(promptCache.keys())
    };
  }
}

/**
 * Auto-detect if tools are needed based on user message
 * @param {string} userMessage - User's input
 * @returns {boolean}
 */
export function shouldIncludeTools(userMessage) {
  if (!userMessage) return false;

  const lowerMessage = userMessage.toLowerCase();
  return TOOL_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Auto-detect if ABNT rules are needed based on user message
 * @param {string} userMessage - User's input
 * @returns {boolean}
 */
export function shouldIncludeABNT(userMessage) {
  if (!userMessage) return false;

  const lowerMessage = userMessage.toLowerCase();
  return ABNT_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Detect document type from user message
 * @param {string} userMessage - User's input
 * @returns {string|null}
 */
export function detectDocumentType(userMessage) {
  if (!userMessage) return null;

  const lowerMessage = userMessage.toLowerCase();

  for (const [key, value] of Object.entries(DOCUMENT_TYPE_MAP)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }

  return null;
}

/**
 * Factory function to create a PromptBuilder with default options
 * @param {Object} options - Builder options
 * @returns {PromptBuilder}
 */
export function createPromptBuilder(options = {}) {
  return new PromptBuilder(options);
}

/**
 * Convenience function to build optimized system prompt
 * Auto-detects modules based on user message
 *
 * @param {Object} options - Build options
 * @param {string} options.userMessage - User message for auto-detection
 * @param {boolean} options.includeTools - Override: include tools
 * @param {boolean} options.includeABNT - Override: include ABNT
 * @param {string} options.documentType - Document type
 * @param {string} options.userId - User ID for A/B testing
 * @returns {Object} { prompt: string, tokens: number, modules: string[] }
 */
export function buildSystemPrompt(options = {}) {
  const {
    userMessage = '',
    includeTools,
    includeABNT,
    documentType,
    userId
  } = options;

  // Auto-detect or use explicit values
  const toolsNeeded = includeTools !== undefined
    ? includeTools
    : shouldIncludeTools(userMessage);

  const abntNeeded = includeABNT !== undefined
    ? includeABNT
    : shouldIncludeABNT(userMessage);

  const docType = documentType || detectDocumentType(userMessage);

  const builder = new PromptBuilder();
  return builder.build({
    includeTools: toolsNeeded,
    includeABNT: abntNeeded,
    documentType: docType,
    userId
  });
}

/**
 * Get the raw optimized system prompt (for backward compatibility)
 */
export { OPTIMIZED_SYSTEM_PROMPT };

export default {
  PromptBuilder,
  buildSystemPrompt,
  shouldIncludeTools,
  shouldIncludeABNT,
  detectDocumentType,
  createPromptBuilder,
  OPTIMIZED_SYSTEM_PROMPT
};
