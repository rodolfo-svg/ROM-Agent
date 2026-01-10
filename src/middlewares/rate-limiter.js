/**
 * Rate Limiting Middleware
 * Previne abuso de APIs
 */

const rateLimit = require('express-rate-limit');

// Limitar tentativas de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Muitas tentativas de login',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você excedeu o número de tentativas. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitar requisições de API gerais
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições por minuto
  message: {
    error: 'Limite de requisições excedido',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você fez muitas requisições. Aguarde alguns segundos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limitar uploads pesados
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 uploads a cada 5 minutos
  message: {
    error: 'Limite de uploads excedido',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Você fez muitos uploads. Aguarde alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  loginLimiter,
  apiLimiter,
  uploadLimiter
};
