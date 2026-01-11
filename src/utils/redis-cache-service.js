/**
 * REDIS CACHE SERVICE (v1.0.0)
 *
 * Optimized Redis caching service for ROM-Agent with:
 * - Session caching (24h TTL)
 * - Jurisprudence caching (1h TTL)
 * - Rate limiting with sliding window
 * - Hit/miss statistics tracking
 * - Graceful fallback when Redis is unavailable
 *
 * @module redis-cache-service
 */

import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Redis Cache Service for optimized caching operations
 */
export class RedisCacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.hitCount = 0;
    this.missCount = 0;
    this.operationCount = 0;
    this.errorCount = 0;
    this.lastError = null;

    // TTL configurations (in seconds)
    this.ttlConfig = {
      session: 86400,        // 24 hours
      jurisprudencia: 3600,  // 1 hour
      legislation: 604800,   // 7 days
      templates: 2592000,    // 30 days
      rateLimit: 60,         // 1 minute default window
      short: 300,            // 5 minutes
      medium: 1800,          // 30 minutes
      long: 86400            // 24 hours
    };

    // Cache key prefixes for namespacing
    this.prefixes = {
      session: 'session:',
      jurisprudencia: 'juris:',
      legislation: 'leg:',
      templates: 'tmpl:',
      rateLimit: 'ratelimit:',
      warmup: 'warmup:',
      generic: 'cache:'
    };

    logger.info('RedisCacheService initialized', {
      available: !!this.redis
    });
  }

  /**
   * Check if Redis is available
   * @returns {boolean} True if Redis client is connected
   */
  isAvailable() {
    return !!(this.redis && this.redis.status === 'ready');
  }

  /**
   * Generate MD5 hash for cache key
   * @param {string} input - String to hash
   * @returns {string} MD5 hash
   */
  _hash(input) {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Safely execute Redis operation with error handling
   * @param {Function} operation - Redis operation to execute
   * @param {*} fallbackValue - Value to return on error
   * @returns {Promise<*>} Operation result or fallback
   */
  async _safeExecute(operation, fallbackValue = null) {
    if (!this.isAvailable()) {
      return fallbackValue;
    }

    try {
      this.operationCount++;
      return await operation();
    } catch (error) {
      this.errorCount++;
      this.lastError = error;
      logger.error('Redis operation failed', {
        error: error.message,
        stack: error.stack
      });
      return fallbackValue;
    }
  }

  // ============================================================
  // SESSION CACHING (24h TTL)
  // ============================================================

  /**
   * Store session data in Redis
   * @param {string} userId - User identifier
   * @param {Object} sessionData - Session data to store
   * @param {number} ttl - Time to live in seconds (default: 24h)
   * @returns {Promise<boolean>} Success status
   */
  async setSession(userId, sessionData, ttl = this.ttlConfig.session) {
    return await this._safeExecute(async () => {
      const key = `${this.prefixes.session}${userId}`;
      const data = JSON.stringify({
        ...sessionData,
        _cachedAt: Date.now(),
        _expiresAt: Date.now() + (ttl * 1000)
      });

      await this.redis.setex(key, ttl, data);

      logger.debug('Session cached', { userId, ttl });
      return true;
    }, false);
  }

  /**
   * Retrieve session data from Redis
   * @param {string} userId - User identifier
   * @returns {Promise<Object|null>} Session data or null
   */
  async getSession(userId) {
    return await this._safeExecute(async () => {
      const key = `${this.prefixes.session}${userId}`;
      const data = await this.redis.get(key);

      if (data) {
        this.hitCount++;
        logger.debug('Session cache HIT', { userId });
        return JSON.parse(data);
      }

      this.missCount++;
      logger.debug('Session cache MISS', { userId });
      return null;
    }, null);
  }

  /**
   * Delete session from cache
   * @param {string} userId - User identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteSession(userId) {
    return await this._safeExecute(async () => {
      const key = `${this.prefixes.session}${userId}`;
      await this.redis.del(key);
      logger.debug('Session deleted', { userId });
      return true;
    }, false);
  }

  /**
   * Refresh session TTL without changing data
   * @param {string} userId - User identifier
   * @param {number} ttl - New TTL in seconds
   * @returns {Promise<boolean>} Success status
   */
  async refreshSessionTTL(userId, ttl = this.ttlConfig.session) {
    return await this._safeExecute(async () => {
      const key = `${this.prefixes.session}${userId}`;
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    }, false);
  }

  // ============================================================
  // JURISPRUDENCIA CACHING (1h TTL)
  // ============================================================

  /**
   * Store jurisprudencia search results
   * @param {string} query - Search query
   * @param {Object} results - Search results
   * @param {number} ttl - Time to live in seconds (default: 1h)
   * @returns {Promise<boolean>} Success status
   */
  async setJurisprudencia(query, results, ttl = this.ttlConfig.jurisprudencia) {
    return await this._safeExecute(async () => {
      const hash = this._hash(query.toLowerCase().trim());
      const key = `${this.prefixes.jurisprudencia}${hash}`;

      const data = JSON.stringify({
        query,
        results,
        _cachedAt: Date.now(),
        _resultCount: Array.isArray(results) ? results.length : 0
      });

      await this.redis.setex(key, ttl, data);

      logger.debug('Jurisprudencia cached', {
        queryHash: hash.substring(0, 8),
        resultCount: Array.isArray(results) ? results.length : 0,
        ttl
      });
      return true;
    }, false);
  }

  /**
   * Retrieve jurisprudencia search results
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} Cached results or null
   */
  async getJurisprudencia(query) {
    return await this._safeExecute(async () => {
      const hash = this._hash(query.toLowerCase().trim());
      const key = `${this.prefixes.jurisprudencia}${hash}`;
      const data = await this.redis.get(key);

      if (data) {
        this.hitCount++;
        const parsed = JSON.parse(data);
        logger.debug('Jurisprudencia cache HIT', {
          queryHash: hash.substring(0, 8),
          resultCount: parsed._resultCount
        });
        return parsed.results;
      }

      this.missCount++;
      logger.debug('Jurisprudencia cache MISS', {
        queryHash: hash.substring(0, 8)
      });
      return null;
    }, null);
  }

  /**
   * Invalidate jurisprudencia cache for a specific query
   * @param {string} query - Search query
   * @returns {Promise<boolean>} Success status
   */
  async invalidateJurisprudencia(query) {
    return await this._safeExecute(async () => {
      const hash = this._hash(query.toLowerCase().trim());
      const key = `${this.prefixes.jurisprudencia}${hash}`;
      await this.redis.del(key);
      return true;
    }, false);
  }

  /**
   * Clear all jurisprudencia cache entries
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearAllJurisprudencia() {
    return await this._safeExecute(async () => {
      const pattern = `${this.prefixes.jurisprudencia}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Jurisprudencia cache cleared', { count: keys.length });
      }

      return keys.length;
    }, 0);
  }

  // ============================================================
  // RATE LIMITING
  // ============================================================

  /**
   * Check and update rate limit for IP/endpoint combination
   * @param {string} ip - Client IP address
   * @param {string} endpoint - API endpoint
   * @param {number} limit - Maximum requests allowed
   * @param {number} window - Time window in seconds
   * @returns {Promise<{allowed: boolean, current: number, remaining: number, resetIn: number}>}
   */
  async checkRateLimit(ip, endpoint, limit = 100, window = 60) {
    const fallbackResult = { allowed: true, current: 0, remaining: limit, resetIn: 0 };

    return await this._safeExecute(async () => {
      const key = `${this.prefixes.rateLimit}${ip}:${endpoint}`;

      // Atomic increment
      const current = await this.redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await this.redis.expire(key, window);
      }

      // Get remaining TTL
      const ttl = await this.redis.ttl(key);

      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);

      if (!allowed) {
        logger.warn('Rate limit exceeded', {
          ip,
          endpoint,
          current,
          limit
        });
      }

      return {
        allowed,
        current,
        remaining,
        resetIn: ttl > 0 ? ttl : window
      };
    }, fallbackResult);
  }

  /**
   * Get current rate limit status without incrementing
   * @param {string} ip - Client IP address
   * @param {string} endpoint - API endpoint
   * @param {number} limit - Maximum requests allowed
   * @returns {Promise<{current: number, remaining: number, resetIn: number}>}
   */
  async getRateLimitStatus(ip, endpoint, limit = 100) {
    return await this._safeExecute(async () => {
      const key = `${this.prefixes.rateLimit}${ip}:${endpoint}`;

      const current = parseInt(await this.redis.get(key) || '0');
      const ttl = await this.redis.ttl(key);

      return {
        current,
        remaining: Math.max(0, limit - current),
        resetIn: ttl > 0 ? ttl : 0
      };
    }, { current: 0, remaining: limit, resetIn: 0 });
  }

  /**
   * Reset rate limit for IP/endpoint
   * @param {string} ip - Client IP address
   * @param {string} endpoint - API endpoint (optional, clears all if not provided)
   * @returns {Promise<boolean>} Success status
   */
  async resetRateLimit(ip, endpoint = null) {
    return await this._safeExecute(async () => {
      if (endpoint) {
        const key = `${this.prefixes.rateLimit}${ip}:${endpoint}`;
        await this.redis.del(key);
      } else {
        const pattern = `${this.prefixes.rateLimit}${ip}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      return true;
    }, false);
  }

  // ============================================================
  // GENERIC CACHING
  // ============================================================

  /**
   * Set a generic cache value
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @param {string} prefix - Key prefix (default: 'cache:')
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = this.ttlConfig.medium, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const fullKey = `${prefix}${key}`;
      const data = JSON.stringify({
        value,
        _cachedAt: Date.now()
      });

      await this.redis.setex(fullKey, ttl, data);
      return true;
    }, false);
  }

  /**
   * Get a generic cache value
   * @param {string} key - Cache key
   * @param {string} prefix - Key prefix (default: 'cache:')
   * @returns {Promise<*>} Cached value or null
   */
  async get(key, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const fullKey = `${prefix}${key}`;
      const data = await this.redis.get(fullKey);

      if (data) {
        this.hitCount++;
        const parsed = JSON.parse(data);
        return parsed.value;
      }

      this.missCount++;
      return null;
    }, null);
  }

  /**
   * Delete a cache entry
   * @param {string} key - Cache key
   * @param {string} prefix - Key prefix
   * @returns {Promise<boolean>} Success status
   */
  async delete(key, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const fullKey = `${prefix}${key}`;
      await this.redis.del(fullKey);
      return true;
    }, false);
  }

  /**
   * Check if a key exists
   * @param {string} key - Cache key
   * @param {string} prefix - Key prefix
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const fullKey = `${prefix}${key}`;
      const result = await this.redis.exists(fullKey);
      return result === 1;
    }, false);
  }

  /**
   * Set multiple values at once (pipeline)
   * @param {Array<{key: string, value: *, ttl: number}>} items - Items to cache
   * @param {string} prefix - Key prefix
   * @returns {Promise<boolean>} Success status
   */
  async mset(items, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const pipeline = this.redis.pipeline();

      for (const item of items) {
        const fullKey = `${prefix}${item.key}`;
        const data = JSON.stringify({
          value: item.value,
          _cachedAt: Date.now()
        });
        const ttl = item.ttl || this.ttlConfig.medium;
        pipeline.setex(fullKey, ttl, data);
      }

      await pipeline.exec();
      return true;
    }, false);
  }

  /**
   * Get multiple values at once
   * @param {Array<string>} keys - Cache keys
   * @param {string} prefix - Key prefix
   * @returns {Promise<Object>} Map of key -> value
   */
  async mget(keys, prefix = this.prefixes.generic) {
    return await this._safeExecute(async () => {
      const fullKeys = keys.map(k => `${prefix}${k}`);
      const values = await this.redis.mget(...fullKeys);

      const result = {};
      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          this.hitCount++;
          const parsed = JSON.parse(values[i]);
          result[keys[i]] = parsed.value;
        } else {
          this.missCount++;
          result[keys[i]] = null;
        }
      }

      return result;
    }, {});
  }

  // ============================================================
  // CACHE WARMUP SUPPORT
  // ============================================================

  /**
   * Mark a warmup key as loaded
   * @param {string} key - Warmup key identifier
   * @returns {Promise<boolean>} Success status
   */
  async markWarmupComplete(key) {
    return await this._safeExecute(async () => {
      const fullKey = `${this.prefixes.warmup}${key}`;
      await this.redis.set(fullKey, Date.now().toString());
      return true;
    }, false);
  }

  /**
   * Check if warmup was completed for a key
   * @param {string} key - Warmup key identifier
   * @returns {Promise<boolean>} True if warmup completed
   */
  async isWarmupComplete(key) {
    return await this._safeExecute(async () => {
      const fullKey = `${this.prefixes.warmup}${key}`;
      const result = await this.redis.exists(fullKey);
      return result === 1;
    }, false);
  }

  /**
   * Clear all warmup markers
   * @returns {Promise<boolean>} Success status
   */
  async clearWarmupMarkers() {
    return await this._safeExecute(async () => {
      const pattern = `${this.prefixes.warmup}*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    }, false);
  }

  // ============================================================
  // STATISTICS & MONITORING
  // ============================================================

  /**
   * Get cache hit rate percentage
   * @returns {string} Hit rate as percentage
   */
  getHitRate() {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total * 100).toFixed(2) : '0.00';
  }

  /**
   * Get comprehensive cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      available: this.isAvailable(),
      hitCount: this.hitCount,
      missCount: this.missCount,
      totalRequests: total,
      hitRate: `${this.getHitRate()}%`,
      operationCount: this.operationCount,
      errorCount: this.errorCount,
      errorRate: this.operationCount > 0
        ? `${(this.errorCount / this.operationCount * 100).toFixed(2)}%`
        : '0.00%',
      lastError: this.lastError ? this.lastError.message : null
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats() {
    this.hitCount = 0;
    this.missCount = 0;
    this.operationCount = 0;
    this.errorCount = 0;
    this.lastError = null;
  }

  /**
   * Get Redis server info
   * @returns {Promise<Object>} Redis server information
   */
  async getRedisInfo() {
    return await this._safeExecute(async () => {
      const info = await this.redis.info();
      const lines = info.split('\n');
      const parsed = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          parsed[key.trim()] = value ? value.trim() : '';
        }
      }

      return {
        version: parsed.redis_version,
        uptime: parseInt(parsed.uptime_in_seconds) || 0,
        connectedClients: parseInt(parsed.connected_clients) || 0,
        usedMemory: parsed.used_memory_human,
        usedMemoryPeak: parsed.used_memory_peak_human,
        totalKeys: parseInt(parsed.db0?.match(/keys=(\d+)/)?.[1] || '0'),
        hitRate: parsed.keyspace_hits && parsed.keyspace_misses
          ? ((parseInt(parsed.keyspace_hits) /
             (parseInt(parsed.keyspace_hits) + parseInt(parsed.keyspace_misses))) * 100).toFixed(2) + '%'
          : 'N/A'
      };
    }, {
      available: false,
      error: 'Redis not available'
    });
  }

  /**
   * Health check for Redis connection
   * @returns {Promise<{healthy: boolean, latency: number}>}
   */
  async healthCheck() {
    if (!this.redis) {
      return { healthy: false, latency: -1, error: 'No Redis client' };
    }

    const start = Date.now();

    return await this._safeExecute(async () => {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { healthy: true, latency };
    }, { healthy: false, latency: Date.now() - start, error: 'Ping failed' });
  }

  // ============================================================
  // CLEANUP & MAINTENANCE
  // ============================================================

  /**
   * Clear all cache entries with a specific prefix
   * @param {string} prefix - Key prefix to clear
   * @returns {Promise<number>} Number of keys deleted
   */
  async clearByPrefix(prefix) {
    return await this._safeExecute(async () => {
      const pattern = `${prefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info('Cache cleared by prefix', { prefix, count: keys.length });
      }

      return keys.length;
    }, 0);
  }

  /**
   * Flush all cache (use with caution)
   * @returns {Promise<boolean>} Success status
   */
  async flushAll() {
    return await this._safeExecute(async () => {
      await this.redis.flushdb();
      logger.warn('Redis cache flushed');
      return true;
    }, false);
  }
}

// Singleton instance
let redisCacheServiceInstance = null;

/**
 * Initialize RedisCacheService singleton
 * @param {Object} redisClient - Redis client instance
 * @returns {RedisCacheService} Service instance
 */
export function initRedisCacheService(redisClient) {
  if (!redisCacheServiceInstance) {
    redisCacheServiceInstance = new RedisCacheService(redisClient);
  }
  return redisCacheServiceInstance;
}

/**
 * Get RedisCacheService instance
 * @returns {RedisCacheService|null} Service instance or null
 */
export function getRedisCacheService() {
  return redisCacheServiceInstance;
}

export default {
  RedisCacheService,
  initRedisCacheService,
  getRedisCacheService
};
