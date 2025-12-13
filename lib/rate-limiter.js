/**
 * ROM Agent - Rate Limiter Middleware
 * Implementa limite de requisições por IP para proteger o servidor
 * Usando express-rate-limit
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter geral - 100 requisições por hora por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // 100 requisições por hora
  message: {
    error: 'Muitas requisições deste IP, por favor tente novamente mais tarde.',
    retryAfter: '1 hora'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de requisições excedido',
      message: 'Você excedeu o limite de 100 requisições por hora. Por favor, aguarde antes de tentar novamente.',
      retryAfter: '1 hora'
    });
  }
});

/**
 * Rate limiter para API de chat - 10 requisições por minuto por IP
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 requisições por minuto
  message: {
    error: 'Muitas mensagens enviadas rapidamente, por favor aguarde um momento.',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de mensagens excedido',
      message: 'Você está enviando mensagens muito rapidamente. Por favor, aguarde um momento antes de continuar.',
      retryAfter: '1 minuto',
      tip: 'Tente descrever sua solicitação de forma mais completa em uma única mensagem.'
    });
  }
});

/**
 * Rate limiter para upload de arquivos - 20 uploads por hora
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 uploads por hora
  message: {
    error: 'Limite de uploads excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de uploads excedido',
      message: 'Você excedeu o limite de 20 uploads por hora. Por favor, aguarde antes de enviar mais arquivos.',
      retryAfter: '1 hora',
      tip: 'Considere enviar múltiplos arquivos em um único upload para economizar requisições.'
    });
  }
});

/**
 * Rate limiter para autenticação - 5 tentativas por 15 minutos
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Muitas tentativas de login',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
  handler: (req, res) => {
    res.status(429).json({
      error: 'Muitas tentativas de login',
      message: 'Você excedeu o limite de tentativas de login. Por favor, aguarde 15 minutos antes de tentar novamente.',
      retryAfter: '15 minutos',
      tip: 'Se esqueceu sua senha, use a opção de recuperação.'
    });
  }
});

/**
 * Rate limiter para API admin - 50 requisições por hora
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // 50 requisições por hora
  message: {
    error: 'Limite de requisições admin excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de requisições excedido',
      message: 'Você excedeu o limite de 50 requisições administrativas por hora.',
      retryAfter: '1 hora'
    });
  }
});

/**
 * Rate limiter para busca semântica - 30 buscas por hora
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // 30 buscas por hora
  message: {
    error: 'Limite de buscas excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de buscas excedido',
      message: 'Você excedeu o limite de 30 buscas por hora. Por favor, aguarde antes de fazer novas buscas.',
      retryAfter: '1 hora',
      tip: 'Refine seus termos de busca para encontrar resultados mais precisos.'
    });
  }
});

/**
 * Criar rate limiter customizado
 * @param {Object} options - Opções do rate limiter
 * @returns {Function} Middleware de rate limiting
 */
export function createCustomLimiter(options = {}) {
  const {
    windowMs = 60 * 60 * 1000, // 1 hora por padrão
    max = 100, // 100 requisições por padrão
    message = 'Limite de requisições excedido',
    onLimitReached = null
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: `${windowMs / 60000} minutos`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      if (onLimitReached) {
        onLimitReached(req);
      }

      res.status(429).json({
        error: 'Limite de requisições excedido',
        message: message,
        retryAfter: `${windowMs / 60000} minutos`
      });
    }
  });
}

/**
 * Obter estatísticas de rate limiting (para monitoramento)
 */
export function getRateLimitStats() {
  return {
    general: { windowMs: 3600000, max: 100, message: '100 req/hora' },
    chat: { windowMs: 60000, max: 10, message: '10 req/minuto' },
    upload: { windowMs: 3600000, max: 20, message: '20 uploads/hora' },
    auth: { windowMs: 900000, max: 5, message: '5 tentativas/15min' },
    admin: { windowMs: 3600000, max: 50, message: '50 req/hora' },
    search: { windowMs: 3600000, max: 30, message: '30 buscas/hora' }
  };
}

export default {
  generalLimiter,
  chatLimiter,
  uploadLimiter,
  authLimiter,
  adminLimiter,
  searchLimiter,
  createCustomLimiter,
  getRateLimitStats
};
