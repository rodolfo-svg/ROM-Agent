/**
 * Unified Rate Limiter (v2.7.1)
 *
 * Sistema unificado de rate limiting usando express-rate-limit
 * Substitui implementações duplicadas e customizadas
 *
 * Features:
 * - Rate limiting por IP
 * - Configurável via environment variables
 * - Skip de rotas específicas (health, metrics)
 * - Headers padrão RFC 7231
 *
 * @module rate-limiter-unified
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false'; // default true
const GENERAL_MAX = parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '500', 10);
const CHAT_MAX = parseInt(process.env.RATE_LIMIT_CHAT_MAX || '60', 10);
const API_MAX = parseInt(process.env.RATE_LIMIT_API_MAX || '200', 10);
const UPLOAD_MAX = parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '20', 10);

// Rotas excluídas de rate limiting
const SKIP_ROUTES = [
  '/metrics',
  '/api/info',
  '/health',
  '/api/health',
  '/api/diagnostic'
];

logger.info('✅ Rate Limiter Unificado configurado', {
  enabled: RATE_LIMIT_ENABLED,
  general: GENERAL_MAX,
  chat: CHAT_MAX,
  api: API_MAX,
  upload: UPLOAD_MAX
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Skip function para rotas excluídas
 */
function createSkipFunction(additionalSkips = []) {
  const allSkips = [...SKIP_ROUTES, ...additionalSkips];
  return (req) => {
    if (!RATE_LIMIT_ENABLED) return true;
    return allSkips.some(route => req.path === route || req.path.startsWith(route));
  };
}

/**
 * Handler customizado para rate limit exceeded
 */
function createHandler(limit, window) {
  return (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      limit,
      window
    });

    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Você excedeu o limite de ${limit} requisições por ${window}. Por favor, aguarde antes de tentar novamente.`,
      retryAfter: window,
      limit,
      remaining: 0
    });
  };
}

// ============================================================
// RATE LIMITERS
// ============================================================

/**
 * Rate limiter geral - 500 req/hora
 * Aplica-se a todas as rotas não excluídas
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: GENERAL_MAX,
  skip: createSkipFunction(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createHandler(GENERAL_MAX, '1 hora')
});

/**
 * Rate limiter para rotas de chat - 60 req/hora
 * Mais restritivo devido ao custo de IA
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: CHAT_MAX,
  skip: createSkipFunction(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createHandler(CHAT_MAX, '1 hora'),
  keyGenerator: (req) => {
    // Rate limit por usuário se autenticado, senão por IP
    return req.user?.id || req.ip;
  }
});

/**
 * Rate limiter para rotas de API - 200 req/hora
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: API_MAX,
  skip: createSkipFunction(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createHandler(API_MAX, '1 hora')
});

/**
 * Rate limiter para upload - 20 uploads/hora
 * Mais restritivo para evitar abuso
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: UPLOAD_MAX,
  skip: createSkipFunction(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createHandler(UPLOAD_MAX, '1 hora'),
  skipSuccessfulRequests: false, // Conta mesmo uploads bem-sucedidos
  skipFailedRequests: true // Não conta falhas (4xx, 5xx)
});

/**
 * Rate limiter estrito - 10 req/minuto
 * Para endpoints críticos ou sensíveis
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  skip: createSkipFunction(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: createHandler(10, '1 minuto')
});

// ============================================================
// FACTORY FUNCTION
// ============================================================

/**
 * Cria rate limiter customizado
 * @param {Object} options - Opções do rate limiter
 * @returns {Function} Middleware do rate limiter
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 60 * 1000,
    max = 100,
    skipRoutes = [],
    message = 'Rate limit exceeded'
  } = options;

  return rateLimit({
    windowMs,
    max,
    skip: createSkipFunction(skipRoutes),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter: windowMs,
        limit: max
      });
    }
  });
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  generalLimiter,
  chatLimiter,
  apiLimiter,
  uploadLimiter,
  strictLimiter,
  createRateLimiter
};
