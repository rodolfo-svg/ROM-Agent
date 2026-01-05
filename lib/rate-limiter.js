/**
 * ROM Agent - Rate Limiter Middleware
 * Implementa limite de requisições por IP para proteger o servidor
 * Usando express-rate-limit
 *
 * ENV configurável:
 * - RATE_LIMIT_ENABLED: true|false (default: true)
 * - RATE_LIMIT_GENERAL_MAX: número (default: 500)
 * - RATE_LIMIT_CHAT_MAX: número (default: 60)
 */

import rateLimit from 'express-rate-limit';

// Configuração via environment variables
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false'; // default true
const GENERAL_MAX = parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '500', 10);
const CHAT_MAX = parseInt(process.env.RATE_LIMIT_CHAT_MAX || '60', 10);

// Skip de rotas que não devem ter rate limit (métricas, health check, etc)
const SKIP_ROUTES = ['/metrics', '/api/info', '/health', '/api/health'];

/**
 * Função skip padrão para rotas excluídas
 */
function defaultSkip(req) {
  if (!RATE_LIMIT_ENABLED) return true; // Desabilita rate limit se env var false
  return SKIP_ROUTES.some(route => req.path === route);
}

/**
 * Rate limiter geral - Configurável via env (default: 500 req/hora)
 * AUMENTADO de 100 para 500 para permitir uso intenso do sistema
 * Em staging, pode ser desabilitado com RATE_LIMIT_ENABLED=false
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: GENERAL_MAX,
  skip: defaultSkip,
  message: {
    error: 'Muitas requisições deste IP, por favor tente novamente mais tarde.',
    retryAfter: '1 hora'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { trustProxy: false }, // Confiar no proxy configurado no Express
  handler: (req, res) => {
    res.status(429).json({
      error: 'Limite de requisições excedido',
      message: `Você excedeu o limite de ${GENERAL_MAX} requisições por hora. Por favor, aguarde antes de tentar novamente.`,
      retryAfter: '1 hora'
    });
  }
});

/**
 * Rate limiter para API de chat - Configurável via env (default: 60 req/min)
 * AUMENTADO de 10 para 60 para permitir análises exaustivas do KB
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: CHAT_MAX,
  skip: defaultSkip,
  message: {
    error: 'Muitas mensagens enviadas rapidamente, por favor aguarde um momento.',
    retryAfter: '1 minuto'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
  skip: defaultSkip,
  message: {
    error: 'Limite de uploads excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
 * Rate limiter para autenticação - 20 tentativas por 15 minutos
 * AUMENTADO de 5 para 20 para permitir erros de digitação e múltiplos usuários
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 tentativas (aumentado de 5)
  skip: defaultSkip,
  message: {
    error: 'Muitas tentativas de login',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
  skip: defaultSkip,
  message: {
    error: 'Limite de requisições admin excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
  skip: defaultSkip,
  message: {
    error: 'Limite de buscas excedido',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
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
    onLimitReached = null,
    skip = defaultSkip
  } = options;

  return rateLimit({
    windowMs,
    max,
    skip,
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
    enabled: RATE_LIMIT_ENABLED,
    general: { windowMs: 3600000, max: GENERAL_MAX, message: `${GENERAL_MAX} req/hora` },
    chat: { windowMs: 60000, max: CHAT_MAX, message: `${CHAT_MAX} req/minuto` },
    upload: { windowMs: 3600000, max: 20, message: '20 uploads/hora' },
    auth: { windowMs: 900000, max: 5, message: '5 tentativas/15min' },
    admin: { windowMs: 3600000, max: 50, message: '50 req/hora' },
    search: { windowMs: 3600000, max: 30, message: '30 buscas/hora' },
    skipRoutes: SKIP_ROUTES
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
