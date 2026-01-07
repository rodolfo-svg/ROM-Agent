// ════════════════════════════════════════════════════════════════
// ROM AGENT - IP BLOCKER MIDDLEWARE v2.8.0
// ════════════════════════════════════════════════════════════════
// Middleware para bloqueio de IPs em blacklist
// Integrado com brute-force-service.js
// ════════════════════════════════════════════════════════════════

import bruteForceService from '../services/brute-force-service.js';
import auditService from '../services/audit-service.js';

/**
 * Extrai IP real do request (considerando proxies e load balancers)
 */
function extractRealIp(req) {
  // Prioridade:
  // 1. X-Forwarded-For (primeiro IP da lista)
  // 2. X-Real-IP
  // 3. req.ip
  // 4. req.connection.remoteAddress
  // 5. req.socket.remoteAddress

  let ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown';

  // Remover prefixo IPv6 se presente (::ffff:)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip;
}

/**
 * Lista de IPs sempre permitidos (whitelist)
 * Adicionar IPs confiáveis aqui
 */
const WHITELISTED_IPS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  // Adicionar IPs de servidores confiáveis aqui
  ...(process.env.WHITELISTED_IPS?.split(',').map(ip => ip.trim()) || [])
]);

/**
 * Middleware principal de bloqueio de IP
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.logBlocked - Se deve logar IPs bloqueados (padrão: true)
 * @param {Array<string>} options.exemptPaths - Caminhos isentos de bloqueio
 * @returns {Function} Middleware Express
 */
export const ipBlockerMiddleware = (options = {}) => {
  const {
    logBlocked = true,
    exemptPaths = []
  } = options;

  return async (req, res, next) => {
    const ip = extractRealIp(req);

    // 1. Verificar se caminho está isento
    const isExempt = exemptPaths.some(path => {
      if (path.endsWith('*')) {
        return req.path.startsWith(path.slice(0, -1));
      }
      return req.path === path;
    });

    if (isExempt) {
      return next();
    }

    // 2. Verificar whitelist
    if (WHITELISTED_IPS.has(ip)) {
      return next();
    }

    // 3. Verificar blacklist
    try {
      const blacklistCheck = await bruteForceService.isIpBlacklisted(ip);

      if (blacklistCheck.blocked) {
        if (logBlocked) {
          console.warn(`🚫 [IP-BLOCKER] Acesso bloqueado: ${ip} - Motivo: ${blacklistCheck.reason}`);

          // Audit log (não bloquear por erro de log)
          try {
            await auditService.log(
              'ip_blocked_access_attempt',
              null,
              {
                status: 'failure',
                resource: req.path,
                details: {
                  reason: blacklistCheck.reason,
                  blockedUntil: blacklistCheck.until,
                  method: req.method,
                  userAgent: req.headers['user-agent']
                },
                ipAddress: ip,
                userAgent: req.headers['user-agent']
              }
            );
          } catch (auditError) {
            console.error('Erro ao registrar audit log:', auditError.message);
          }
        }

        // Calcular tempo restante
        const minutesRemaining = blacklistCheck.until
          ? Math.ceil((new Date(blacklistCheck.until) - new Date()) / (1000 * 60))
          : 0;

        return res.status(403).json({
          success: false,
          error: 'Acesso bloqueado devido a múltiplas tentativas de login falhadas',
          code: 'IP_BLOCKED',
          details: {
            blockedUntil: blacklistCheck.until,
            minutesRemaining,
            reason: 'Detecção de força bruta'
          }
        });
      }

      // IP não está bloqueado, continuar
      next();
    } catch (error) {
      console.error(`❌ [IP-BLOCKER] Erro ao verificar blacklist:`, error.message);
      // Em caso de erro, permitir acesso (fail open) para não quebrar sistema
      next();
    }
  };
};

/**
 * Middleware para verificar e adicionar IP à whitelist dinamicamente
 * (Apenas para admins)
 */
export const whitelistIp = (ip) => {
  if (ip && typeof ip === 'string') {
    WHITELISTED_IPS.add(ip);
    console.log(`✅ [IP-BLOCKER] IP adicionado à whitelist: ${ip}`);
    return true;
  }
  return false;
};

/**
 * Middleware para remover IP da whitelist
 */
export const removeFromWhitelist = (ip) => {
  if (WHITELISTED_IPS.has(ip)) {
    WHITELISTED_IPS.delete(ip);
    console.log(`🗑️ [IP-BLOCKER] IP removido da whitelist: ${ip}`);
    return true;
  }
  return false;
};

/**
 * Obtém lista de IPs na whitelist
 */
export const getWhitelistedIps = () => {
  return Array.from(WHITELISTED_IPS);
};

/**
 * Middleware específico para rotas de autenticação
 * Aplica bloqueio mais rigoroso
 */
export const authIpBlocker = ipBlockerMiddleware({
  logBlocked: true,
  exemptPaths: [] // Nenhum caminho isento em auth
});

/**
 * Middleware para rotas públicas
 * Mais permissivo, apenas bloqueia IPs críticos
 */
export const publicIpBlocker = ipBlockerMiddleware({
  logBlocked: true,
  exemptPaths: [
    '/health',
    '/api/health',
    '/favicon.ico',
    '/robots.txt',
    '/api/info',
    '/api/chat',
    '/api/chat/stream',
    '/api/stream',
    '/api/messages'
  ]
});

/**
 * Middleware para extrair e anexar IP ao request
 * Útil para logging e debugging
 */
export const attachIpToRequest = (req, res, next) => {
  req.realIp = extractRealIp(req);
  next();
};

/**
 * Verifica se IP está bloqueado (função utilitária)
 */
export const isIpBlocked = async (ip) => {
  try {
    const result = await bruteForceService.isIpBlacklisted(ip);
    return result.blocked;
  } catch (error) {
    console.error('Erro ao verificar bloqueio de IP:', error.message);
    return false;
  }
};

/**
 * Estatísticas de bloqueio
 */
export const getBlockingStats = async () => {
  try {
    const blockedIps = await bruteForceService.getBlockedIps();
    return {
      totalBlocked: blockedIps.length,
      blockedIps: blockedIps.map(b => ({
        ip: b.ip_address,
        reason: b.reason,
        blockedUntil: b.blocked_until,
        createdAt: b.created_at
      })),
      whitelistedCount: WHITELISTED_IPS.size
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas de bloqueio:', error.message);
    return {
      totalBlocked: 0,
      blockedIps: [],
      whitelistedCount: WHITELISTED_IPS.size
    };
  }
};

/**
 * Exportação padrão
 */
export default {
  middleware: ipBlockerMiddleware,
  auth: authIpBlocker,
  public: publicIpBlocker,
  whitelist: whitelistIp,
  removeFromWhitelist,
  getWhitelistedIps,
  attachIp: attachIpToRequest,
  isBlocked: isIpBlocked,
  getStats: getBlockingStats,
  extractIp: extractRealIp
};
