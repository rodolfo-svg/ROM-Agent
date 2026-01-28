import featureFlags from './feature-flags.js';

/**
 * User-Agent Rotation para evitar bloqueios WAF/anti-bot
 *
 * Lista de user agents reais e atualizados (2026)
 * Inclui Chrome, Firefox, Edge e Safari em diferentes sistemas operacionais
 */
const USER_AGENTS = [
  // Chrome (Windows, Mac, Linux)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',

  // Firefox (Windows, Mac, Linux)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',

  // Edge (Windows, Mac)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',

  // Safari (Mac, iPad)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// User agent padrão (usado quando flag desativada)
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Obter user agent aleatório
 *
 * Se flag ENABLE_USER_AGENT_ROTATION ativada: retorna agent aleatório
 * Se flag desativada: retorna agent padrão (comportamento original)
 */
function getRandomUserAgent() {
  if (!featureFlags.isEnabled('ENABLE_USER_AGENT_ROTATION')) {
    // Flag desativada: usar user-agent padrão (comportamento original)
    return DEFAULT_USER_AGENT;
  }

  // Flag ativada: usar user-agent aleatório
  const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
  return USER_AGENTS[randomIndex];
}

/**
 * Obter user agent específico por índice (útil para testes)
 */
function getUserAgentByIndex(index) {
  if (index < 0 || index >= USER_AGENTS.length) {
    return DEFAULT_USER_AGENT;
  }
  return USER_AGENTS[index];
}

/**
 * Obter headers HTTP completos com user-agent rotation
 */
function getRotatedHeaders() {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  };
}

/**
 * Estatísticas de uso (para debugging)
 */
const stats = {
  totalRequests: 0,
  uniqueAgentsUsed: new Set()
};

function recordUsage(userAgent) {
  stats.totalRequests++;
  stats.uniqueAgentsUsed.add(userAgent);
}

function getStats() {
  return {
    totalRequests: stats.totalRequests,
    uniqueAgentsUsed: stats.uniqueAgentsUsed.size,
    totalAvailable: USER_AGENTS.length,
    rotationEnabled: featureFlags.isEnabled('ENABLE_USER_AGENT_ROTATION')
  };
}

export {
  getRandomUserAgent,
  getUserAgentByIndex,
  getRotatedHeaders,
  getStats,
  USER_AGENTS,
  DEFAULT_USER_AGENT
};

export default {
  getRandomUserAgent,
  getUserAgentByIndex,
  getRotatedHeaders,
  getStats,
  USER_AGENTS,
  DEFAULT_USER_AGENT
};
