import redis from 'redis';
import featureFlags from './feature-flags.js';

/**
 * Cache Manager com Redis
 *
 * Graceful degradation: Se Redis não disponível ou flag desativada,
 * retorna null sem quebrar o sistema.
 */
class CacheManager {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initError = null;
  }

  async init() {
    if (this.initialized) return;
    if (this.initError) return; // Falhou anteriormente, não tentar novamente

    try {
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
        password: process.env.REDIS_PASSWORD || undefined,
      });

      this.client.on('error', (err) => {
        console.error('[CACHE] Redis error:', err.message);
        this.initError = err;
        this.initialized = false;
      });

      this.client.on('connect', () => {
        console.log('[CACHE] Redis connected');
        this.initialized = true;
        this.initError = null;
      });

      this.client.on('ready', () => {
        console.log('[CACHE] Redis ready');
      });

      await this.client.connect();
      this.initialized = true;

    } catch (error) {
      console.error('[CACHE] Redis initialization failed:', error.message);
      this.initError = error;
      this.initialized = false;
      // Não lançar erro - graceful degradation
    }
  }

  async get(key) {
    // Feature flag check
    if (!featureFlags.isEnabled('ENABLE_REDIS_CACHE')) {
      return null; // Cache desativado
    }

    // Initialize if needed
    if (!this.initialized && !this.initError) {
      await this.init();
    }

    // Se não inicializou ou falhou, retornar null (graceful fallback)
    if (!this.initialized) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        console.log(`[CACHE HIT] ${key}`);
        return JSON.parse(value);
      }
      console.log(`[CACHE MISS] ${key}`);
      return null;
    } catch (error) {
      console.error(`[CACHE ERROR] ${key}:`, error.message);
      return null; // Graceful fallback - não quebra o sistema
    }
  }

  async set(key, value, ttl = 86400) {
    // Feature flag check
    if (!featureFlags.isEnabled('ENABLE_REDIS_CACHE')) {
      return; // Cache desativado
    }

    // Initialize if needed
    if (!this.initialized && !this.initError) {
      await this.init();
    }

    // Se não inicializou, apenas retornar sem erro
    if (!this.initialized) {
      return;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      console.log(`[CACHE SET] ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[CACHE ERROR] ${key}:`, error.message);
      // Graceful fallback - não quebra o sistema
    }
  }

  async del(key) {
    if (!this.initialized) return;

    try {
      await this.client.del(key);
      console.log(`[CACHE DEL] ${key}`);
    } catch (error) {
      console.error(`[CACHE ERROR] ${key}:`, error.message);
    }
  }

  async flushAll() {
    if (!this.initialized) return;

    try {
      await this.client.flushAll();
      console.log('[CACHE] Flush all');
    } catch (error) {
      console.error('[CACHE ERROR]:', error.message);
    }
  }

  generateKey(type, ...params) {
    return `iarom:${type}:${params.join(':')}`;
  }

  async close() {
    if (this.client && this.initialized) {
      try {
        await this.client.quit();
        console.log('[CACHE] Redis connection closed');
      } catch (error) {
        console.error('[CACHE] Error closing Redis:', error.message);
      }
    }
  }
}

// Export singleton instance
const cacheManager = new CacheManager();
export default cacheManager;
