/**
 * Testes Unitários - Chat e Conversação
 *
 * Testa funcionalidades de chat, gerenciamento de conversas,
 * histórico de mensagens e integração com modelos AI
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

// ============================================================
// TESTES DE FORMATAÇÃO DE MENSAGENS
// ============================================================

describe('Chat - Message Formatting', () => {
  function formatMessage(role, content) {
    if (!['user', 'assistant', 'system'].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }
    return {
      role,
      content: content.trim(),
      timestamp: new Date().toISOString()
    };
  }

  it('deve formatar mensagem do usuário', () => {
    const msg = formatMessage('user', 'Olá, preciso de ajuda');

    assert.strictEqual(msg.role, 'user');
    assert.strictEqual(msg.content, 'Olá, preciso de ajuda');
    assert.ok(msg.timestamp);
  });

  it('deve formatar mensagem do assistente', () => {
    const msg = formatMessage('assistant', 'Como posso ajudar?');

    assert.strictEqual(msg.role, 'assistant');
    assert.strictEqual(msg.content, 'Como posso ajudar?');
  });

  it('deve fazer trim do conteúdo', () => {
    const msg = formatMessage('user', '  Teste com espaços  ');
    assert.strictEqual(msg.content, 'Teste com espaços');
  });

  it('deve rejeitar role inválido', () => {
    assert.throws(
      () => formatMessage('invalid', 'test'),
      { message: /Invalid role/ }
    );
  });

  it('deve rejeitar conteúdo vazio', () => {
    assert.throws(
      () => formatMessage('user', ''),
      { message: /Content must be a non-empty string/ }
    );
  });

  it('deve rejeitar conteúdo não-string', () => {
    assert.throws(
      () => formatMessage('user', null),
      { message: /Content must be a non-empty string/ }
    );
  });
});

// ============================================================
// TESTES DE GERENCIAMENTO DE HISTÓRICO
// ============================================================

describe('Chat - History Management', () => {
  class ConversationHistory {
    constructor(maxMessages = 50) {
      this.messages = [];
      this.maxMessages = maxMessages;
    }

    addMessage(role, content) {
      this.messages.push({
        role,
        content,
        timestamp: Date.now()
      });

      // Limitar histórico
      if (this.messages.length > this.maxMessages) {
        this.messages.shift();
      }
    }

    getHistory(limit) {
      if (!limit) return this.messages;
      return this.messages.slice(-limit);
    }

    clear() {
      this.messages = [];
    }

    getTokenCount() {
      // Aproximação: ~4 caracteres por token
      const totalChars = this.messages.reduce((sum, msg) =>
        sum + msg.content.length, 0
      );
      return Math.ceil(totalChars / 4);
    }

    truncateToTokenLimit(maxTokens) {
      const targetChars = maxTokens * 4;
      let currentChars = 0;
      const kept = [];

      // Manter mensagens mais recentes
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const msg = this.messages[i];
        if (currentChars + msg.content.length <= targetChars) {
          kept.unshift(msg);
          currentChars += msg.content.length;
        } else {
          break;
        }
      }

      this.messages = kept;
    }
  }

  it('deve adicionar mensagem ao histórico', () => {
    const history = new ConversationHistory();
    history.addMessage('user', 'Olá');

    assert.strictEqual(history.messages.length, 1);
    assert.strictEqual(history.messages[0].role, 'user');
    assert.strictEqual(history.messages[0].content, 'Olá');
  });

  it('deve limitar tamanho do histórico', () => {
    const history = new ConversationHistory(3);

    history.addMessage('user', 'Msg 1');
    history.addMessage('assistant', 'Msg 2');
    history.addMessage('user', 'Msg 3');
    history.addMessage('assistant', 'Msg 4');

    assert.strictEqual(history.messages.length, 3);
    assert.strictEqual(history.messages[0].content, 'Msg 2');
    assert.strictEqual(history.messages[2].content, 'Msg 4');
  });

  it('deve retornar histórico limitado', () => {
    const history = new ConversationHistory();

    for (let i = 1; i <= 10; i++) {
      history.addMessage('user', `Mensagem ${i}`);
    }

    const last5 = history.getHistory(5);
    assert.strictEqual(last5.length, 5);
    assert.strictEqual(last5[4].content, 'Mensagem 10');
  });

  it('deve limpar histórico', () => {
    const history = new ConversationHistory();
    history.addMessage('user', 'Test');
    history.clear();

    assert.strictEqual(history.messages.length, 0);
  });

  it('deve calcular contagem de tokens aproximada', () => {
    const history = new ConversationHistory();

    // "Olá!" = 4 chars = ~1 token
    history.addMessage('user', 'Olá!');

    // "Olá! Como posso ajudar?" = ~24 chars = ~6 tokens
    history.addMessage('assistant', 'Olá! Como posso ajudar?');

    const tokens = history.getTokenCount();
    assert.ok(tokens >= 7 && tokens <= 10);
  });

  it('deve truncar histórico por limite de tokens', () => {
    const history = new ConversationHistory();

    // Adicionar 10 mensagens de ~100 chars cada (~250 tokens total)
    for (let i = 0; i < 10; i++) {
      history.addMessage('user', 'A'.repeat(100));
    }

    // Truncar para ~100 tokens (~400 chars)
    history.truncateToTokenLimit(100);

    // Deve ter mantido apenas ~4 mensagens
    assert.ok(history.messages.length <= 5);
    assert.ok(history.getTokenCount() <= 120);
  });
});

// ============================================================
// TESTES DE MAPEAMENTO DE MODELOS
// ============================================================

describe('Chat - Model Mapping', () => {
  const MODEL_MAPPING = {
    'claude-opus-4.5': 'anthropic.claude-opus-4-5-20251101-v1:0',
    'claude-opus-4': 'anthropic.claude-opus-4-20250514-v1:0',
    'claude-sonnet-4.5': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'claude-sonnet-4': 'anthropic.claude-sonnet-4-20250514-v1:0',
    'claude-haiku-4.5': 'anthropic.claude-haiku-4-5-20251001-v1:0',
    'claude-3.5-sonnet': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'claude-3.5-haiku': 'anthropic.claude-3-5-haiku-20241022-v1:0',
  };

  function resolveModel(modelShortName) {
    // Se já for ID completo, retornar
    if (modelShortName.startsWith('anthropic.')) {
      return modelShortName;
    }

    // Mapear nome curto
    const fullId = MODEL_MAPPING[modelShortName];
    if (!fullId) {
      throw new Error(`Unknown model: ${modelShortName}`);
    }

    return fullId;
  }

  it('deve mapear nome curto para ID completo', () => {
    const fullId = resolveModel('claude-sonnet-4.5');
    assert.strictEqual(fullId, 'anthropic.claude-sonnet-4-5-20250929-v1:0');
  });

  it('deve retornar ID completo se já fornecido', () => {
    const fullId = 'anthropic.claude-opus-4-20250514-v1:0';
    assert.strictEqual(resolveModel(fullId), fullId);
  });

  it('deve lançar erro para modelo desconhecido', () => {
    assert.throws(
      () => resolveModel('gpt-4'),
      { message: /Unknown model/ }
    );
  });

  it('deve suportar todos os modelos Claude', () => {
    const models = [
      'claude-opus-4.5',
      'claude-opus-4',
      'claude-sonnet-4.5',
      'claude-haiku-4.5',
      'claude-3.5-sonnet',
      'claude-3.5-haiku'
    ];

    models.forEach(model => {
      const fullId = resolveModel(model);
      assert.ok(fullId.startsWith('anthropic.claude-'));
    });
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO DE PARÂMETROS
// ============================================================

describe('Chat - Parameter Validation', () => {
  function validateChatParams(params) {
    const errors = [];

    // Message obrigatória
    if (!params.message || typeof params.message !== 'string') {
      errors.push('Message is required and must be a string');
    } else if (params.message.trim().length === 0) {
      errors.push('Message cannot be empty');
    } else if (params.message.length > 100000) {
      errors.push('Message exceeds maximum length (100KB)');
    }

    // MaxTokens opcional mas deve ser número válido
    if (params.maxTokens !== undefined) {
      if (typeof params.maxTokens !== 'number' || params.maxTokens <= 0) {
        errors.push('maxTokens must be a positive number');
      }
      if (params.maxTokens > 8000) {
        errors.push('maxTokens cannot exceed 8000');
      }
    }

    // Temperature opcional mas deve estar entre 0 e 1
    if (params.temperature !== undefined) {
      if (typeof params.temperature !== 'number') {
        errors.push('temperature must be a number');
      } else if (params.temperature < 0 || params.temperature > 1) {
        errors.push('temperature must be between 0 and 1');
      }
    }

    // Histórico opcional mas deve ser array
    if (params.historico !== undefined) {
      if (!Array.isArray(params.historico)) {
        errors.push('historico must be an array');
      } else {
        params.historico.forEach((msg, idx) => {
          if (!msg.role || !msg.content) {
            errors.push(`historico[${idx}] must have role and content`);
          }
        });
      }
    }

    return errors;
  }

  it('deve validar mensagem obrigatória', () => {
    const errors = validateChatParams({});
    assert.ok(errors.some(e => e.includes('Message is required')));
  });

  it('deve rejeitar mensagem vazia', () => {
    const errors = validateChatParams({ message: '   ' });
    assert.ok(errors.some(e => e.includes('cannot be empty')));
  });

  it('deve rejeitar mensagem muito longa', () => {
    const errors = validateChatParams({ message: 'A'.repeat(100001) });
    assert.ok(errors.some(e => e.includes('exceeds maximum length')));
  });

  it('deve validar maxTokens positivo', () => {
    const errors = validateChatParams({ message: 'Hi', maxTokens: -100 });
    assert.ok(errors.some(e => e.includes('positive number')));
  });

  it('deve limitar maxTokens a 8000', () => {
    const errors = validateChatParams({ message: 'Hi', maxTokens: 10000 });
    assert.ok(errors.some(e => e.includes('cannot exceed 8000')));
  });

  it('deve validar temperature entre 0 e 1', () => {
    const errors1 = validateChatParams({ message: 'Hi', temperature: -0.5 });
    assert.ok(errors1.some(e => e.includes('between 0 and 1')));

    const errors2 = validateChatParams({ message: 'Hi', temperature: 1.5 });
    assert.ok(errors2.some(e => e.includes('between 0 and 1')));
  });

  it('deve validar formato do histórico', () => {
    const errors = validateChatParams({
      message: 'Hi',
      historico: [{ role: 'user' }] // Faltando content
    });
    assert.ok(errors.some(e => e.includes('must have role and content')));
  });

  it('deve aceitar parâmetros válidos', () => {
    const errors = validateChatParams({
      message: 'Olá!',
      maxTokens: 4000,
      temperature: 0.7,
      historico: [
        { role: 'user', content: 'Pergunta anterior' },
        { role: 'assistant', content: 'Resposta anterior' }
      ]
    });
    assert.strictEqual(errors.length, 0);
  });
});

// ============================================================
// TESTES DE CHUNKING DE RESPOSTA
// ============================================================

describe('Chat - Response Chunking', () => {
  class ResponseChunker {
    constructor() {
      this.chunks = [];
    }

    addChunk(text) {
      this.chunks.push(text);
    }

    getFullResponse() {
      return this.chunks.join('');
    }

    getChunkCount() {
      return this.chunks.length;
    }

    clear() {
      this.chunks = [];
    }

    // Simula processamento de chunk do streaming
    processStreamChunk(delta) {
      if (delta.type === 'content_block_delta') {
        if (delta.delta?.text) {
          this.addChunk(delta.delta.text);
        }
      }
    }
  }

  it('deve acumular chunks', () => {
    const chunker = new ResponseChunker();

    chunker.addChunk('Olá, ');
    chunker.addChunk('como ');
    chunker.addChunk('posso ajudar?');

    assert.strictEqual(chunker.getChunkCount(), 3);
    assert.strictEqual(chunker.getFullResponse(), 'Olá, como posso ajudar?');
  });

  it('deve processar chunk de streaming', () => {
    const chunker = new ResponseChunker();

    chunker.processStreamChunk({
      type: 'content_block_delta',
      delta: { text: 'Teste' }
    });

    assert.strictEqual(chunker.getFullResponse(), 'Teste');
  });

  it('deve ignorar chunks sem texto', () => {
    const chunker = new ResponseChunker();

    chunker.processStreamChunk({
      type: 'content_block_delta',
      delta: {}
    });

    assert.strictEqual(chunker.getChunkCount(), 0);
  });

  it('deve limpar chunks', () => {
    const chunker = new ResponseChunker();
    chunker.addChunk('Test');
    chunker.clear();

    assert.strictEqual(chunker.getChunkCount(), 0);
  });
});

// ============================================================
// TESTES DE CONTEXTO DA KB
// ============================================================

describe('Chat - Knowledge Base Context', () => {
  function buildContextPrompt(kbContext, userMessage) {
    if (!kbContext) {
      return userMessage;
    }

    return `CONTEXTO DA BASE DE CONHECIMENTO:
${kbContext}

---

PERGUNTA DO USUÁRIO:
${userMessage}`;
  }

  it('deve retornar apenas mensagem se sem contexto', () => {
    const result = buildContextPrompt(null, 'Qual é a lei?');
    assert.strictEqual(result, 'Qual é a lei?');
  });

  it('deve incluir contexto da KB', () => {
    const context = 'Artigo 1º: Todos são iguais perante a lei.';
    const message = 'O que diz o artigo 1º?';

    const result = buildContextPrompt(context, message);

    assert.ok(result.includes('CONTEXTO DA BASE DE CONHECIMENTO'));
    assert.ok(result.includes(context));
    assert.ok(result.includes(message));
  });
});

// ============================================================
// TESTES DE RATE LIMITING
// ============================================================

describe('Chat - Rate Limiting', () => {
  class RateLimiter {
    constructor(maxRequests, windowMs) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
      this.requests = new Map(); // userId -> timestamps[]
    }

    checkLimit(userId) {
      const now = Date.now();
      const userRequests = this.requests.get(userId) || [];

      // Remover requests fora da janela
      const validRequests = userRequests.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (validRequests.length >= this.maxRequests) {
        return {
          allowed: false,
          retryAfter: this.windowMs - (now - validRequests[0])
        };
      }

      // Adicionar request atual
      validRequests.push(now);
      this.requests.set(userId, validRequests);

      return {
        allowed: true,
        remaining: this.maxRequests - validRequests.length
      };
    }

    reset(userId) {
      this.requests.delete(userId);
    }
  }

  it('deve permitir requests dentro do limite', () => {
    const limiter = new RateLimiter(5, 60000); // 5 req/min

    const result1 = limiter.checkLimit('user1');
    assert.strictEqual(result1.allowed, true);
    assert.strictEqual(result1.remaining, 4);

    const result2 = limiter.checkLimit('user1');
    assert.strictEqual(result2.allowed, true);
    assert.strictEqual(result2.remaining, 3);
  });

  it('deve bloquear após atingir limite', () => {
    const limiter = new RateLimiter(3, 60000);

    limiter.checkLimit('user1');
    limiter.checkLimit('user1');
    limiter.checkLimit('user1');

    const result = limiter.checkLimit('user1');
    assert.strictEqual(result.allowed, false);
    assert.ok(result.retryAfter > 0);
  });

  it('deve resetar contador de usuário', () => {
    const limiter = new RateLimiter(3, 60000);

    limiter.checkLimit('user1');
    limiter.checkLimit('user1');
    limiter.reset('user1');

    const result = limiter.checkLimit('user1');
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 2);
  });

  it('deve isolar limite por usuário', () => {
    const limiter = new RateLimiter(2, 60000);

    limiter.checkLimit('user1');
    limiter.checkLimit('user1');

    // user1 está no limite, mas user2 não
    const result = limiter.checkLimit('user2');
    assert.strictEqual(result.allowed, true);
  });
});

// ============================================================
// TESTES DE ERRO E RETRY
// ============================================================

describe('Chat - Error Handling', () => {
  class ChatErrorHandler {
    static categorizeError(error) {
      if (error.message.includes('timeout')) {
        return { type: 'timeout', retryable: true };
      }
      if (error.message.includes('rate limit')) {
        return { type: 'rate_limit', retryable: true };
      }
      if (error.message.includes('validation')) {
        return { type: 'validation', retryable: false };
      }
      if (error.message.includes('unauthorized')) {
        return { type: 'auth', retryable: false };
      }
      return { type: 'unknown', retryable: false };
    }

    static shouldRetry(error, attempt, maxAttempts = 3) {
      if (attempt >= maxAttempts) return false;

      const category = this.categorizeError(error);
      return category.retryable;
    }

    static getRetryDelay(attempt) {
      // Exponential backoff: 1s, 2s, 4s, 8s
      return Math.min(1000 * Math.pow(2, attempt), 10000);
    }
  }

  it('deve categorizar erro de timeout como retryable', () => {
    const error = new Error('Request timeout after 30s');
    const category = ChatErrorHandler.categorizeError(error);

    assert.strictEqual(category.type, 'timeout');
    assert.strictEqual(category.retryable, true);
  });

  it('deve categorizar erro de validação como não-retryable', () => {
    const error = new Error('validation failed: message too long');
    const category = ChatErrorHandler.categorizeError(error);

    assert.strictEqual(category.type, 'validation');
    assert.strictEqual(category.retryable, false);
  });

  it('deve decidir retry baseado em tentativas', () => {
    const timeoutError = new Error('timeout');

    assert.strictEqual(ChatErrorHandler.shouldRetry(timeoutError, 0), true);
    assert.strictEqual(ChatErrorHandler.shouldRetry(timeoutError, 1), true);
    assert.strictEqual(ChatErrorHandler.shouldRetry(timeoutError, 2), true);
    assert.strictEqual(ChatErrorHandler.shouldRetry(timeoutError, 3), false);
  });

  it('deve calcular delay exponencial', () => {
    assert.strictEqual(ChatErrorHandler.getRetryDelay(0), 1000);
    assert.strictEqual(ChatErrorHandler.getRetryDelay(1), 2000);
    assert.strictEqual(ChatErrorHandler.getRetryDelay(2), 4000);
    assert.strictEqual(ChatErrorHandler.getRetryDelay(3), 8000);
    assert.strictEqual(ChatErrorHandler.getRetryDelay(10), 10000); // max
  });

  it('não deve retry erro de autenticação', () => {
    const authError = new Error('unauthorized access');
    assert.strictEqual(ChatErrorHandler.shouldRetry(authError, 0), false);
  });
});

console.log('✅ Testes de chat carregados com sucesso');
