/**
 * Conversation Memory Service - Sistema de Memória Hierárquica Avançada
 *
 * SUPERIOR ao claude.ai com 3 níveis de memória:
 * 1. SHORT-TERM: Últimas 100 mensagens (contexto completo)
 * 2. MEDIUM-TERM: Resumos das últimas 500 mensagens
 * 3. LONG-TERM: Índice semântico de TODAS conversas anteriores
 *
 * Features:
 * - Recuperação automática de contexto de conversas passadas
 * - Compressão inteligente preservando informações críticas
 * - Busca semântica cross-conversacional
 * - Cache de resumos para performance
 *
 * @version 3.0.0
 * @since WS6 - Advanced Memory System
 */

import { conversarStream } from '../modules/bedrock.js';
import { logger } from '../utils/logger.js';
import * as ConversationRepository from '../repositories/conversation-repository.js';
import semanticSearchService from './semantic-search-service.js';

/**
 * Configuração de limites de memória
 */
const MEMORY_LIMITS = {
  // Memória de curto prazo: contexto completo
  shortTerm: {
    maxMessages: 100,        // vs 30 atual, vs ~40 claude.ai
    maxTokens: 150000,       // ~150k tokens de contexto
    description: 'Últimas mensagens com contexto completo'
  },

  // Memória de médio prazo: resumos compactados
  mediumTerm: {
    maxMessages: 500,        // Até 500 mensagens resumidas
    maxTokens: 50000,        // ~50k tokens de resumos
    compressionRatio: 0.2,   // Comprimir para 20% do tamanho original
    description: 'Resumos das mensagens mais antigas'
  },

  // Memória de longo prazo: índice semântico
  longTerm: {
    maxConversations: 1000,  // Até 1000 conversas indexadas
    maxTokens: 20000,        // ~20k tokens de índices
    description: 'Índice de todas conversas anteriores'
  }
};

/**
 * Classe principal do serviço de memória
 */
export class ConversationMemoryService {
  constructor() {
    this.summaryCache = new Map(); // Cache de resumos
    this.indexCache = new Map();   // Cache de índices semânticos
  }

  /**
   * Construir contexto hierárquico para uma conversa
   *
   * @param {string} conversationId - ID da conversa atual
   * @param {string} userId - ID do usuário
   * @param {string} currentMessage - Mensagem atual do usuário
   * @returns {Promise<Object>} Contexto hierárquico completo
   */
  async buildHierarchicalContext(conversationId, userId, currentMessage) {
    const startTime = Date.now();

    try {
      // 1. MEMÓRIA DE CURTO PRAZO: Últimas 100 mensagens
      const shortTermMemory = await this.getShortTermMemory(conversationId);

      // 2. MEMÓRIA DE MÉDIO PRAZO: Resumos das mensagens antigas
      const mediumTermMemory = await this.getMediumTermMemory(conversationId);

      // 3. MEMÓRIA DE LONGO PRAZO: Contexto de conversas anteriores relevantes
      const longTermMemory = await this.getLongTermMemory(userId, currentMessage);

      // 4. Calcular estatísticas
      const stats = this.calculateMemoryStats(shortTermMemory, mediumTermMemory, longTermMemory);

      const totalTime = Date.now() - startTime;

      logger.info('[ConversationMemory] Contexto hierárquico construído', {
        conversationId,
        userId,
        stats,
        totalTime: `${totalTime}ms`
      });

      return {
        shortTerm: shortTermMemory,
        mediumTerm: mediumTermMemory,
        longTerm: longTermMemory,
        stats,
        metadata: {
          buildTime: totalTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao construir contexto hierárquico', {
        error: error.message,
        conversationId,
        userId
      });

      // Fallback: retornar apenas short-term em caso de erro
      return {
        shortTerm: await this.getShortTermMemory(conversationId),
        mediumTerm: { messages: [], summary: null },
        longTerm: { relevantContext: [], index: null },
        stats: { error: error.message }
      };
    }
  }

  /**
   * MEMÓRIA DE CURTO PRAZO: Últimas 100 mensagens (contexto completo)
   */
  async getShortTermMemory(conversationId) {
    try {
      // Para novas conversas (conversationId null), não há histórico curto prazo ainda
      if (!conversationId) {
        return {
          messages: [],
          count: 0,
          estimatedTokens: 0,
          type: 'full_context'
        };
      }

      const messages = await ConversationRepository.getConversationMessages(conversationId, {
        limit: MEMORY_LIMITS.shortTerm.maxMessages,
        offset: 0
      });

      // Mensagens já vêm em ordem cronológica (ASC)
      const sortedMessages = messages;

      // Calcular tokens estimados
      const totalTokens = this.estimateTokens(sortedMessages);

      logger.debug('[ConversationMemory] Short-term memory loaded', {
        conversationId,
        messageCount: sortedMessages.length,
        estimatedTokens: totalTokens
      });

      return {
        messages: sortedMessages,
        count: sortedMessages.length,
        estimatedTokens: totalTokens,
        type: 'full_context'
      };
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao carregar short-term memory', {
        error: error.message,
        conversationId
      });
      return { messages: [], count: 0, estimatedTokens: 0, type: 'full_context' };
    }
  }

  /**
   * MEMÓRIA DE MÉDIO PRAZO: Resumos das mensagens 100-500
   */
  async getMediumTermMemory(conversationId) {
    try {
      // Para novas conversas (conversationId null), não há histórico médio prazo ainda
      if (!conversationId) {
        return { messages: [], summary: null, count: 0, estimatedTokens: 0, type: 'compressed_summary' };
      }

      // Verificar cache primeiro
      const cacheKey = `summary_${conversationId}`;
      if (this.summaryCache.has(cacheKey)) {
        logger.debug('[ConversationMemory] Using cached medium-term summary');
        return this.summaryCache.get(cacheKey);
      }

      // Buscar mensagens antigas (offset 100)
      const oldMessages = await ConversationRepository.getConversationMessages(conversationId, {
        limit: MEMORY_LIMITS.mediumTerm.maxMessages,
        offset: MEMORY_LIMITS.shortTerm.maxMessages
      });

      if (oldMessages.length === 0) {
        return { messages: [], summary: null, estimatedTokens: 0 };
      }

      // Mensagens já vêm em ordem cronológica
      const sortedOldMessages = oldMessages;

      // Gerar resumo compactado
      const summary = await this.generateCompressedSummary(sortedOldMessages, conversationId);

      const result = {
        messages: sortedOldMessages,
        summary,
        count: sortedOldMessages.length,
        estimatedTokens: this.estimateTokens([{ content: summary }]),
        type: 'compressed_summary'
      };

      // Cachear resultado (TTL: 5 minutos)
      this.summaryCache.set(cacheKey, result);
      setTimeout(() => this.summaryCache.delete(cacheKey), 5 * 60 * 1000);

      logger.info('[ConversationMemory] Medium-term memory summarized', {
        conversationId,
        originalMessages: sortedOldMessages.length,
        summaryTokens: result.estimatedTokens
      });

      return result;
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao carregar medium-term memory', {
        error: error.message,
        conversationId
      });
      return { messages: [], summary: null, estimatedTokens: 0 };
    }
  }

  /**
   * MEMÓRIA DE LONGO PRAZO: Busca semântica em conversas anteriores
   */
  async getLongTermMemory(userId, currentMessage) {
    try {
      if (!userId || userId === 'anonymous') {
        // Usuários anônimos não têm acesso a memória de longo prazo
        return { relevantContext: [], index: null };
      }

      // Buscar conversas anteriores do usuário
      const previousConversations = await ConversationRepository.listUserConversations(userId, {
        limit: MEMORY_LIMITS.longTerm.maxConversations,
        includeArchived: false
      });

      if (previousConversations.length === 0) {
        return { relevantContext: [], index: null };
      }

      // Encontrar conversas relevantes baseado na mensagem atual
      const relevantContext = await this.findRelevantContext(
        previousConversations,
        currentMessage,
        userId
      );

      logger.info('[ConversationMemory] Long-term memory retrieved', {
        userId,
        totalConversations: previousConversations.length,
        relevantConversations: relevantContext.length
      });

      return {
        relevantContext,
        index: previousConversations.length,
        type: 'semantic_index'
      };
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao carregar long-term memory', {
        error: error.message,
        userId
      });
      return { relevantContext: [], index: null };
    }
  }

  /**
   * Gerar resumo compactado de mensagens usando Claude
   */
  async generateCompressedSummary(messages, conversationId) {
    try {
      // Concatenar mensagens
      const conversationText = messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');

      // Prompt para resumir preservando informações críticas
      const summaryPrompt = `Você é um assistente especializado em resumir conversas jurídicas preservando TODAS as informações críticas.

Analise a conversa abaixo e crie um resumo ULTRA-COMPACTO (máximo 20% do tamanho original) que preserve:
1. Todos os números de processo mencionados
2. Todas as datas importantes
3. Todos os nomes de partes, advogados, juízes
4. Todos os pedidos e decisões
5. Todas as conclusões jurídicas
6. Contexto essencial para continuidade

CONVERSA:
${conversationText}

RESUMO COMPACTO (máximo ${Math.round(conversationText.length * 0.2)} caracteres):`;

      let summary = '';

      // Usar streaming para gerar resumo
      await conversarStream(summaryPrompt, (chunk) => {
        summary += chunk;
      }, {
        modelo: 'anthropic.claude-haiku-4-5-20251001-v1:0', // Usar Haiku (rápido e barato)
        maxTokens: Math.round(this.estimateTokens(messages) * MEMORY_LIMITS.mediumTerm.compressionRatio),
        systemPrompt: 'Você é um resumidor ultra-eficiente. Seja extremamente conciso preservando todas informações críticas.',
        enableTools: false
      });

      return summary.trim();
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao gerar resumo compactado', {
        error: error.message,
        conversationId
      });

      // Fallback: resumo simples por truncamento
      const conversationText = messages
        .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
        .join('\n');
      return conversationText.substring(0, 1000) + '...';
    }
  }

  /**
   * Encontrar contexto relevante de conversas anteriores usando BUSCA SEMÂNTICA REAL
   */
  async findRelevantContext(previousConversations, currentMessage, userId) {
    try {
      // ESTRATÉGIA HÍBRIDA: Busca semântica (vetorial) + Keywords (fallback)

      // 1. BUSCA SEMÂNTICA VETORIAL (Primary)
      try {
        logger.debug('[ConversationMemory] Iniciando busca semântica vetorial...');

        // Preparar conversas com mensagens para embedding
        const conversationsWithMessages = await Promise.all(
          previousConversations.slice(0, 20).map(async (conv) => {
            const messages = await ConversationRepository.getConversationMessages(conv.id, {
              limit: 10,
              offset: 0
            });
            return {
              ...conv,
              messages
            };
          })
        );

        // Buscar conversas semanticamente similares
        const similarConversations = await semanticSearchService.searchSimilarConversations(
          currentMessage,
          conversationsWithMessages,
          {
            threshold: 0.60,  // 60% de similaridade mínima (reduzido de 65% para melhor recall)
            topK: 3,          // Máximo 3 conversas
            includeMessages: true
          }
        );

        if (similarConversations.length > 0) {
          // Sucesso! Encontrou conversas similares por busca vetorial
          const relevantConvs = await Promise.all(
            similarConversations.map(async (conv) => {
              // Buscar mensagens mais similares dentro da conversa
              const messages = await ConversationRepository.getConversationMessages(conv.id, {
                limit: 20,
                offset: 0
              });

              const similarMessages = await semanticSearchService.searchSimilarMessages(
                currentMessage,
                messages,
                {
                  threshold: 0.65,  // 65% para mensagens individuais (reduzido de 70% para melhor recall)
                  topK: 3
                }
              );

              return {
                conversationId: conv.id,
                title: conv.title,
                date: conv.created_at,
                similarity: conv.similarity,
                similarityPercent: conv.similarityPercent,
                relevantMessages: similarMessages,
                searchType: 'semantic_vector'
              };
            })
          );

          logger.info('[ConversationMemory] Busca semântica vetorial bem-sucedida', {
            conversationsFound: relevantConvs.length,
            avgSimilarity: Math.round(
              relevantConvs.reduce((sum, c) => sum + c.similarity, 0) / relevantConvs.length * 100
            )
          });

          return relevantConvs;
        }
      } catch (semanticError) {
        logger.warn('[ConversationMemory] Busca semântica falhou, usando fallback por keywords', {
          error: semanticError.message
        });
        // Continuar para fallback por keywords
      }

      // 2. FALLBACK: BUSCA POR KEYWORDS (Secondary)
      logger.debug('[ConversationMemory] Usando busca por keywords (fallback)...');

      const keywords = this.extractKeywords(currentMessage);
      const relevantConvs = [];

      for (const conv of previousConversations.slice(0, 10)) {
        const messages = await ConversationRepository.getConversationMessages(conv.id, {
          limit: 20,
          offset: 0
        });

        // Verificar se alguma mensagem contém keywords
        const hasRelevantContent = messages.some(msg =>
          keywords.some(keyword => msg.content.toLowerCase().includes(keyword.toLowerCase()))
        );

        if (hasRelevantContent) {
          relevantConvs.push({
            conversationId: conv.id,
            title: conv.title,
            date: conv.created_at,
            similarity: 0,
            similarityPercent: 0,
            relevantMessages: messages.filter(msg =>
              keywords.some(keyword => msg.content.toLowerCase().includes(keyword.toLowerCase()))
            ).slice(0, 3),
            searchType: 'keyword_fallback'
          });
        }

        if (relevantConvs.length >= 3) break;
      }

      if (relevantConvs.length > 0) {
        logger.info('[ConversationMemory] Busca por keywords retornou resultados', {
          conversationsFound: relevantConvs.length
        });
      }

      return relevantConvs;
    } catch (error) {
      logger.error('[ConversationMemory] Erro ao buscar contexto relevante', {
        error: error.message,
        userId
      });
      return [];
    }
  }

  /**
   * Extrair palavras-chave de uma mensagem
   */
  extractKeywords(message) {
    // Extrair números de processo
    const processos = message.match(/\d{7}-?\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g) || [];

    // Extrair nomes próprios (palavras com maiúscula inicial)
    const nomes = message.match(/\b[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*\b/g) || [];

    // Extrair palavras jurídicas importantes
    const palavrasJuridicas = message.toLowerCase().match(/\b(petição|recurso|apelação|agravo|sentença|acórdão|processo|ação|autor|réu|advogado|juiz|tribunal|decisão|liminar|tutela|contestação|réplica|embargos|habeas corpus|mandado)\b/g) || [];

    // Combinar e remover duplicatas
    const keywords = [...new Set([...processos, ...nomes, ...palavrasJuridicas])];

    return keywords.slice(0, 10); // Máximo 10 keywords
  }

  /**
   * Estimar tokens de mensagens
   */
  estimateTokens(messages) {
    if (!messages || messages.length === 0) return 0;

    // Estimativa: ~4 caracteres = 1 token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg === 'string' ? msg : (msg.content || '');
      return sum + content.length;
    }, 0);

    return Math.ceil(totalChars / 4);
  }

  /**
   * Calcular estatísticas de memória
   */
  calculateMemoryStats(shortTerm, mediumTerm, longTerm) {
    return {
      shortTerm: {
        messages: shortTerm.count || 0,
        tokens: shortTerm.estimatedTokens || 0,
        type: shortTerm.type
      },
      mediumTerm: {
        messages: mediumTerm.count || 0,
        tokens: mediumTerm.estimatedTokens || 0,
        type: mediumTerm.type,
        compressed: !!mediumTerm.summary
      },
      longTerm: {
        conversations: longTerm.index || 0,
        relevantItems: longTerm.relevantContext?.length || 0,
        type: longTerm.type
      },
      totalTokens: (shortTerm.estimatedTokens || 0) + (mediumTerm.estimatedTokens || 0),
      limits: {
        shortTerm: MEMORY_LIMITS.shortTerm,
        mediumTerm: MEMORY_LIMITS.mediumTerm,
        longTerm: MEMORY_LIMITS.longTerm
      }
    };
  }

  /**
   * Formatar contexto hierárquico para o prompt
   */
  formatContextForPrompt(hierarchicalContext) {
    const parts = [];

    // 1. Memória de longo prazo (se houver)
    if (hierarchicalContext.longTerm?.relevantContext?.length > 0) {
      parts.push('═══════════════════════════════════════════════════════');
      parts.push('MEMÓRIA DE LONGO PRAZO - Contexto de Conversas Anteriores');
      parts.push('═══════════════════════════════════════════════════════\n');

      // ⚠️ INSTRUÇÃO CRÍTICA: Dizer ao Claude para MENCIONAR EXPLICITAMENTE as conversas anteriores
      parts.push('🔔 IMPORTANTE: As informações abaixo são de conversas anteriores do usuário.');
      parts.push('Quando essas informações forem RELEVANTES para responder a pergunta atual:');
      parts.push('  • MENCIONE EXPLICITAMENTE que são de conversas anteriores');
      parts.push('  • Use frases como: "Como discutimos anteriormente...", "Em nossa conversa anterior sobre...", "Você já havia mencionado..."');
      parts.push('  • Isso demonstra continuidade e memória de longo prazo ao usuário');
      parts.push('  • Se as informações NÃO forem relevantes para a pergunta atual, ignore-as\n');

      hierarchicalContext.longTerm.relevantContext.forEach((conv, idx) => {
        // Incluir informação de similaridade se disponível
        const similarityInfo = conv.similarity > 0
          ? ` [Similaridade: ${conv.similarityPercent}% - Busca ${conv.searchType === 'semantic_vector' ? 'SEMÂNTICA VETORIAL' : 'por Keywords'}]`
          : '';

        parts.push(`[CONVERSA ANTERIOR ${idx + 1}] ${conv.title || 'Sem título'} (${conv.date})${similarityInfo}`);

        conv.relevantMessages?.forEach(msg => {
          const msgSimilarity = msg.similarity > 0 ? ` [${msg.similarityPercent}%]` : '';
          const preview = msg.content.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content;
          parts.push(`  ${msg.role}${msgSimilarity}: ${preview}`);
        });
        parts.push('');
      });

      parts.push('');
    }

    // 2. Memória de médio prazo (resumo)
    if (hierarchicalContext.mediumTerm?.summary) {
      parts.push('═══════════════════════════════════════════════════════');
      parts.push(`MEMÓRIA DE MÉDIO PRAZO - Resumo das Mensagens Antigas (${hierarchicalContext.mediumTerm.count} mensagens)`);
      parts.push('═══════════════════════════════════════════════════════\n');
      parts.push(hierarchicalContext.mediumTerm.summary);
      parts.push('\n');
    }

    // 3. Memória de curto prazo não precisa ser formatada aqui
    // Será incluída como histórico normal na chamada do Bedrock

    return parts.join('\n');
  }

  /**
   * Limpar caches (chamado periodicamente)
   */
  clearCaches() {
    this.summaryCache.clear();
    this.indexCache.clear();
    logger.info('[ConversationMemory] Caches cleared');
  }
}

// Exportar instância singleton
export default new ConversationMemoryService();
