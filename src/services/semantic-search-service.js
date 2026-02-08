/**
 * Semantic Search Service - Busca Vetorial com Embeddings
 *
 * Usa AWS Bedrock Titan Embeddings para busca semântica REAL
 * vs busca por keywords (simples e limitada)
 *
 * Features:
 * - Geração de embeddings de mensagens
 * - Busca por similaridade de cosseno
 * - Cache de embeddings
 * - Batch processing para performance
 *
 * @version 1.0.0
 * @since WS6 - Semantic Search
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger.js';

/**
 * Cliente Bedrock para embeddings
 */
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Modelo de embeddings
 */
const EMBEDDING_MODEL = 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSIONS = 1024; // Titan v2

/**
 * Classe principal do serviço de busca semântica
 */
export class SemanticSearchService {
  constructor() {
    this.embeddingCache = new Map(); // Cache de embeddings
    this.cacheTTL = 60 * 60 * 1000; // 1 hora
  }

  /**
   * Gerar embedding de um texto usando AWS Bedrock Titan
   *
   * @param {string} text - Texto para gerar embedding
   * @returns {Promise<Array<number>>} Vetor de embedding
   */
  async generateEmbedding(text) {
    try {
      // Verificar cache primeiro
      const cacheKey = this.getCacheKey(text);
      if (this.embeddingCache.has(cacheKey)) {
        logger.debug('[SemanticSearch] Using cached embedding');
        return this.embeddingCache.get(cacheKey);
      }

      // Truncar texto se muito longo (Titan v2 suporta até 8192 tokens)
      const truncatedText = text.substring(0, 30000); // ~7500 tokens

      // Preparar payload
      const payload = {
        inputText: truncatedText,
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true
      };

      // Invocar modelo
      const command = new InvokeModelCommand({
        modelId: EMBEDDING_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const embedding = responseBody.embedding;

      // Cachear resultado
      this.embeddingCache.set(cacheKey, embedding);
      setTimeout(() => this.embeddingCache.delete(cacheKey), this.cacheTTL);

      logger.debug('[SemanticSearch] Embedding generated', {
        textLength: text.length,
        embeddingDimensions: embedding.length
      });

      return embedding;
    } catch (error) {
      logger.error('[SemanticSearch] Erro ao gerar embedding', {
        error: error.message,
        textLength: text?.length
      });
      throw error;
    }
  }

  /**
   * Gerar embeddings em batch para múltiplos textos
   *
   * @param {Array<string>} texts - Array de textos
   * @returns {Promise<Array<Array<number>>>} Array de embeddings
   */
  async generateEmbeddingsBatch(texts) {
    try {
      const embeddings = [];

      // Processar em paralelo (máximo 5 por vez para não explodir API limits)
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);
      }

      logger.info('[SemanticSearch] Batch embeddings generated', {
        count: texts.length
      });

      return embeddings;
    } catch (error) {
      logger.error('[SemanticSearch] Erro ao gerar embeddings em batch', {
        error: error.message,
        count: texts?.length
      });
      throw error;
    }
  }

  /**
   * Calcular similaridade de cosseno entre dois vetores
   *
   * @param {Array<number>} vecA - Vetor A
   * @param {Array<number>} vecB - Vetor B
   * @returns {number} Similaridade (0-1)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Buscar conversas semanticamente similares
   *
   * @param {string} queryText - Texto da consulta
   * @param {Array<Object>} conversations - Conversas para buscar
   * @param {Object} options - Opções
   * @returns {Promise<Array<Object>>} Conversas ranqueadas por similaridade
   */
  async searchSimilarConversations(queryText, conversations, options = {}) {
    const {
      threshold = 0.7,  // Similaridade mínima (0-1)
      topK = 3,         // Máximo de resultados
      includeMessages = true
    } = options;

    try {
      // 1. Gerar embedding da query
      const queryEmbedding = await this.generateEmbedding(queryText);

      // 2. Gerar embeddings das conversas (título + primeiras mensagens)
      const conversationTexts = conversations.map(conv => {
        const title = conv.title || 'Sem título';
        const messages = conv.messages?.slice(0, 5)
          .map(m => m.content.substring(0, 200))
          .join(' ') || '';
        return `${title}. ${messages}`;
      });

      const conversationEmbeddings = await this.generateEmbeddingsBatch(conversationTexts);

      // 3. Calcular similaridades
      const similarities = conversationEmbeddings.map((embedding, idx) => ({
        conversation: conversations[idx],
        similarity: this.cosineSimilarity(queryEmbedding, embedding)
      }));

      // 4. Filtrar por threshold e ordenar
      const results = similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      logger.info('[SemanticSearch] Similar conversations found', {
        queryLength: queryText.length,
        totalConversations: conversations.length,
        resultsFound: results.length,
        topSimilarity: results[0]?.similarity || 0
      });

      return results.map(item => ({
        ...item.conversation,
        similarity: item.similarity,
        similarityPercent: Math.round(item.similarity * 100)
      }));
    } catch (error) {
      logger.error('[SemanticSearch] Erro ao buscar conversas similares', {
        error: error.message,
        queryLength: queryText?.length,
        conversationsCount: conversations?.length
      });

      // Fallback: retornar as 3 conversas mais recentes
      return conversations.slice(0, topK).map(conv => ({
        ...conv,
        similarity: 0,
        similarityPercent: 0,
        fallback: true
      }));
    }
  }

  /**
   * Buscar mensagens semanticamente similares dentro de conversas
   *
   * @param {string} queryText - Texto da consulta
   * @param {Array<Object>} messages - Mensagens para buscar
   * @param {Object} options - Opções
   * @returns {Promise<Array<Object>>} Mensagens ranqueadas por similaridade
   */
  async searchSimilarMessages(queryText, messages, options = {}) {
    const {
      threshold = 0.7,
      topK = 5
    } = options;

    try {
      // 1. Gerar embedding da query
      const queryEmbedding = await this.generateEmbedding(queryText);

      // 2. Gerar embeddings das mensagens
      const messageTexts = messages.map(m => m.content);
      const messageEmbeddings = await this.generateEmbeddingsBatch(messageTexts);

      // 3. Calcular similaridades
      const similarities = messageEmbeddings.map((embedding, idx) => ({
        message: messages[idx],
        similarity: this.cosineSimilarity(queryEmbedding, embedding)
      }));

      // 4. Filtrar e ordenar
      const results = similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      logger.info('[SemanticSearch] Similar messages found', {
        queryLength: queryText.length,
        totalMessages: messages.length,
        resultsFound: results.length
      });

      return results.map(item => ({
        ...item.message,
        similarity: item.similarity,
        similarityPercent: Math.round(item.similarity * 100)
      }));
    } catch (error) {
      logger.error('[SemanticSearch] Erro ao buscar mensagens similares', {
        error: error.message
      });

      // Fallback: retornar as mensagens mais recentes
      return messages.slice(0, topK).map(msg => ({
        ...msg,
        similarity: 0,
        similarityPercent: 0,
        fallback: true
      }));
    }
  }

  /**
   * Gerar chave de cache para um texto
   */
  getCacheKey(text) {
    // Usar hash simples do texto (primeiros 100 chars)
    return text.substring(0, 100).toLowerCase().trim();
  }

  /**
   * Limpar cache
   */
  clearCache() {
    this.embeddingCache.clear();
    logger.info('[SemanticSearch] Cache cleared');
  }

  /**
   * Estatísticas do cache
   */
  getCacheStats() {
    return {
      size: this.embeddingCache.size,
      ttl: `${this.cacheTTL / 1000}s`
    };
  }
}

// Exportar instância singleton
export default new SemanticSearchService();
