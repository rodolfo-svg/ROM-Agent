// ════════════════════════════════════════════════════════════════
// ROM AGENT - SECURITY HEADERS MIDDLEWARE v2.8.0
// ════════════════════════════════════════════════════════════════
// Implementa headers HTTP de segurança via Helmet
// Protege contra XSS, clickjacking, MIME sniffing, etc.
// ════════════════════════════════════════════════════════════════

import helmet from 'helmet';

/**
 * Middleware de headers de segurança HTTP
 * Usa Helmet.js para configurar headers seguros
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Necessário para React inline scripts
        "'unsafe-eval'", // Necessário para desenvolvimento (remover em produção se possível)
        "https://cse.google.com", // Google Custom Search
        "https://www.google.com",
        "https://static.cloudflareinsights.com" // Cloudflare Analytics
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Necessário para styled-components e CSS inline
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:" // Para fontes base64
      ],
      imgSrc: [
        "'self'",
        "data:", // Para imagens base64
        "https:", // Permitir imagens HTTPS externas
        "blob:" // Para imagens geradas dinamicamente
      ],
      connectSrc: [
        "'self'",
        "https://api.anthropic.com", // Claude API
        "https://cloudflareinsights.com", // Cloudflare Analytics
        "wss://*", // WebSocket para Socket.IO
        "ws://*" // WebSocket local
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com" // Google Custom Search
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"], // Service Workers
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },

  // X-Frame-Options (protege contra clickjacking)
  frameguard: {
    action: 'deny' // Não permite que o site seja embedado em iframe
  },

  // Strict-Transport-Security (força HTTPS)
  hsts: {
    maxAge: 31536000, // 1 ano em segundos
    includeSubDomains: true,
    preload: true
  },

  // X-Content-Type-Options (previne MIME sniffing)
  noSniff: true,

  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },

  // X-Download-Options (IE8+ downloads)
  ieNoOpen: true,

  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false
  },

  // X-Powered-By (remove header que expõe tecnologia)
  hidePoweredBy: true,

  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Desabilitado para compatibilidade

  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin-allow-popups'
  },

  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin' // Permitir recursos cross-origin
  },

  // Permissions-Policy (Feature-Policy)
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  }
});

/**
 * Middleware adicional para headers customizados
 */
export const customSecurityHeaders = (req, res, next) => {
  // X-XSS-Protection (navegadores antigos)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // X-Content-Type-Options (força respeitar Content-Type)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Permissions-Policy (anteriormente Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Cache-Control para páginas HTML (não cachear)
  if (req.path.endsWith('.html') || req.path === '/' || req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Server header (remover informação do servidor)
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * Configuração específica para ambiente de produção
 */
export const productionSecurityHeaders = () => {
  if (process.env.NODE_ENV === 'production') {
    return [
      securityHeaders,
      customSecurityHeaders,
      // HSTS preload em produção
      (req, res, next) => {
        res.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload'
        );
        next();
      }
    ];
  }

  return [securityHeaders, customSecurityHeaders];
};

/**
 * Middleware para desenvolvimento (mais permissivo)
 */
export const developmentSecurityHeaders = helmet({
  contentSecurityPolicy: false, // Desabilitar CSP em dev para facilitar
  hsts: false, // Sem HSTS em dev
  hidePoweredBy: true
});

/**
 * Exporta middleware apropriado baseado no ambiente
 */
export default process.env.NODE_ENV === 'production'
  ? productionSecurityHeaders()
  : [developmentSecurityHeaders, customSecurityHeaders];
