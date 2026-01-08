import rateLimit from 'express-rate-limit';

// Rate limiter geral (100 requests por 15 minutos)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para login (5 tentativas por 15 minutos)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Rate limiter para upload (10 uploads por hora)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many uploads, please try again later.',
});

// Rate limiter para API (50 requests por minuto)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: 'API rate limit exceeded.',
});
