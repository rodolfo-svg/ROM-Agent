import featureFlags from './feature-flags.js';

/**
 * Proxy Pool para rotação de IPs
 *
 * Gerencia pool de proxies para evitar bloqueios por IP
 * Suporta HTTP/HTTPS proxies
 */

/**
 * Carregar proxies de variáveis de ambiente
 * Formato: PROXY_1=http://user:pass@host:port
 */
function loadProxiesFromEnv() {
  const proxies = [];

  // Tentar carregar até 10 proxies (PROXY_1 até PROXY_10)
  for (let i = 1; i <= 10; i++) {
    const proxyUrl = process.env[`PROXY_${i}`];
    if (proxyUrl) {
      try {
        // Validar formato básico
        const url = new URL(proxyUrl);
        proxies.push({
          id: i,
          url: proxyUrl,
          host: url.hostname,
          port: parseInt(url.port, 10),
          protocol: url.protocol.replace(':', ''),
          username: url.username || null,
          password: url.password || null,
          enabled: true,
          failures: 0,
          lastUsed: null,
          lastFailure: null
        });
      } catch (error) {
        console.error(`[ProxyPool] Proxy inválido PROXY_${i}:`, error.message);
      }
    }
  }

  return proxies;
}

/**
 * Pool de proxies (singleton)
 */
class ProxyPool {
  constructor() {
    this.proxies = loadProxiesFromEnv();
    this.currentIndex = 0;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      proxyRotations: 0
    };

    if (this.proxies.length > 0) {
      console.log(`[ProxyPool] Inicializado com ${this.proxies.length} proxies`);
    }
  }

  /**
   * Obter próximo proxy disponível (round-robin)
   */
  getNextProxy() {
    // Feature flag check
    if (!featureFlags.isEnabled('ENABLE_PROXY_POOL')) {
      return null; // Proxy desativado
    }

    if (this.proxies.length === 0) {
      console.warn('[ProxyPool] Nenhum proxy configurado');
      return null;
    }

    // Filtrar proxies habilitados (failures < 3)
    const enabledProxies = this.proxies.filter(p => p.enabled && p.failures < 3);

    if (enabledProxies.length === 0) {
      console.warn('[ProxyPool] Todos os proxies desabilitados. Resetando contadores...');
      // Reset failures para tentar novamente
      this.proxies.forEach(p => {
        p.failures = 0;
        p.enabled = true;
      });
      return this.getNextProxy(); // Tentar novamente
    }

    // Round-robin através de proxies habilitados
    this.currentIndex = (this.currentIndex + 1) % enabledProxies.length;
    const proxy = enabledProxies[this.currentIndex];

    proxy.lastUsed = new Date();
    this.stats.proxyRotations++;

    console.log(`[ProxyPool] Usando proxy #${proxy.id}: ${proxy.host}:${proxy.port}`);

    return proxy;
  }

  /**
   * Obter proxy aleatório (em vez de round-robin)
   */
  getRandomProxy() {
    if (!featureFlags.isEnabled('ENABLE_PROXY_POOL')) {
      return null;
    }

    if (this.proxies.length === 0) {
      return null;
    }

    const enabledProxies = this.proxies.filter(p => p.enabled && p.failures < 3);

    if (enabledProxies.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * enabledProxies.length);
    const proxy = enabledProxies[randomIndex];

    proxy.lastUsed = new Date();
    this.stats.proxyRotations++;

    return proxy;
  }

  /**
   * Converter proxy para config do Axios
   */
  getProxyConfig(proxy) {
    if (!proxy) return null;

    const config = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol
    };

    // Adicionar autenticação se disponível
    if (proxy.username && proxy.password) {
      config.auth = {
        username: proxy.username,
        password: proxy.password
      };
    }

    return config;
  }

  /**
   * Marcar proxy como falho
   */
  markProxyFailure(proxy) {
    if (!proxy) return;

    const proxyInPool = this.proxies.find(p => p.id === proxy.id);
    if (proxyInPool) {
      proxyInPool.failures++;
      proxyInPool.lastFailure = new Date();
      this.stats.failedRequests++;

      // Desabilitar proxy após 3 falhas consecutivas
      if (proxyInPool.failures >= 3) {
        proxyInPool.enabled = false;
        console.warn(`[ProxyPool] Proxy #${proxy.id} desabilitado (3 falhas)`);
      }
    }
  }

  /**
   * Marcar proxy como sucesso
   */
  markProxySuccess(proxy) {
    if (!proxy) return;

    const proxyInPool = this.proxies.find(p => p.id === proxy.id);
    if (proxyInPool) {
      // Reset failure counter on success
      proxyInPool.failures = 0;
      this.stats.successfulRequests++;
    }
  }

  /**
   * Obter estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      totalProxies: this.proxies.length,
      enabledProxies: this.proxies.filter(p => p.enabled).length,
      disabledProxies: this.proxies.filter(p => !p.enabled).length,
      poolEnabled: featureFlags.isEnabled('ENABLE_PROXY_POOL'),
      proxies: this.proxies.map(p => ({
        id: p.id,
        host: p.host,
        port: p.port,
        enabled: p.enabled,
        failures: p.failures,
        lastUsed: p.lastUsed,
        lastFailure: p.lastFailure
      }))
    };
  }

  /**
   * Resetar estatísticas
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      proxyRotations: 0
    };
    this.proxies.forEach(p => {
      p.failures = 0;
      p.enabled = true;
      p.lastUsed = null;
      p.lastFailure = null
    });
    console.log('[ProxyPool] Estatísticas resetadas');
  }

  /**
   * Recarregar proxies do .env
   */
  reload() {
    this.proxies = loadProxiesFromEnv();
    this.currentIndex = 0;
    console.log(`[ProxyPool] Recarregado: ${this.proxies.length} proxies`);
  }
}

// Export singleton instance
const proxyPool = new ProxyPool();
export default proxyPool;
export { ProxyPool };
