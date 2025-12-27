/**
 * DATABASE CONFIGURATION
 * PostgreSQL connection pool and Redis cache
 * Suporta migração gradual (graceful degradation se DB não disponível)
 */

import pg from 'pg';
import Redis from 'ioredis';
import logger from '../../lib/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL Pool
 * Variáveis de ambiente necessárias:
 * - DATABASE_URL ou
 * - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 */
let pgPool = null;

export function initPostgres() {
  if (pgPool) {
    logger.warn('PostgreSQL pool já inicializado');
    return pgPool;
  }

  try {
    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        }
      : {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          database: process.env.POSTGRES_DB || 'rom_agent',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
          max: parseInt(process.env.POSTGRES_POOL_SIZE || '20'),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        };

    pgPool = new Pool(config);

    // Event handlers
    pgPool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });

    pgPool.on('connect', () => {
      logger.debug('PostgreSQL client connected');
    });

    logger.info('PostgreSQL pool inicializado', {
      host: config.host || 'from DATABASE_URL',
      database: config.database || 'from DATABASE_URL',
      maxConnections: config.max || 20
    });

    return pgPool;
  } catch (error) {
    logger.error('Erro ao inicializar PostgreSQL', { error: error.message });
    return null;
  }
}

/**
 * Get PostgreSQL pool (lazy init)
 */
export function getPostgresPool() {
  if (!pgPool) {
    return initPostgres();
  }
  return pgPool;
}

/**
 * Redis Client
 * Variáveis de ambiente:
 * - REDIS_URL ou
 * - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 */
let redisClient = null;

export function initRedis() {
  if (redisClient) {
    logger.warn('Redis client já inicializado');
    return redisClient;
  }

  try {
    const config = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3
        };

    redisClient = new Redis(config);

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis conectado', {
        host: typeof config === 'string' ? 'from REDIS_URL' : config.host,
        db: typeof config === 'string' ? 0 : config.db
      });
    });

    return redisClient;
  } catch (error) {
    logger.error('Erro ao inicializar Redis', { error: error.message });
    return null;
  }
}

/**
 * Get Redis client (lazy init)
 */
export function getRedisClient() {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}

/**
 * Health check - verifica se DBs estão disponíveis
 */
export async function checkDatabaseHealth() {
  const health = {
    postgres: { available: false, latency: null },
    redis: { available: false, latency: null }
  };

  // Check PostgreSQL
  try {
    const pool = getPostgresPool();
    if (pool) {
      const start = Date.now();
      const result = await pool.query('SELECT NOW()');
      health.postgres = {
        available: true,
        latency: Date.now() - start,
        serverTime: result.rows[0].now
      };
    }
  } catch (error) {
    logger.error('PostgreSQL health check failed', { error: error.message });
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    if (redis) {
      const start = Date.now();
      await redis.ping();
      health.redis = {
        available: true,
        latency: Date.now() - start
      };
    }
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
  }

  return health;
}

/**
 * Graceful shutdown
 */
export async function closeDatabaseConnections() {
  logger.info('Fechando conexões de banco de dados...');

  const promises = [];

  if (pgPool) {
    promises.push(
      pgPool.end().then(() => {
        logger.info('PostgreSQL pool fechado');
        pgPool = null;
      })
    );
  }

  if (redisClient) {
    promises.push(
      redisClient.quit().then(() => {
        logger.info('Redis client fechado');
        redisClient = null;
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Execute query com fallback (não quebra se DB indisponível)
 */
export async function safeQuery(sql, params = []) {
  try {
    const pool = getPostgresPool();
    if (!pool) {
      logger.warn('PostgreSQL não disponível - query ignorada');
      return { rows: [], fallback: true };
    }

    const result = await pool.query(sql, params);
    return { ...result, fallback: false };
  } catch (error) {
    logger.error('Erro ao executar query', {
      error: error.message,
      sql: sql.substring(0, 100)
    });
    return { rows: [], error: error.message, fallback: true };
  }
}

/**
 * Redis cache helper com fallback
 */
export async function cacheGet(key) {
  try {
    const redis = getRedisClient();
    if (!redis) return null;

    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Erro ao ler cache', { key, error: error.message });
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Erro ao gravar cache', { key, error: error.message });
    return false;
  }
}

export async function cacheDel(key) {
  try {
    const redis = getRedisClient();
    if (!redis) return false;

    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Erro ao deletar cache', { key, error: error.message });
    return false;
  }
}

/**
 * Export default
 */
export default {
  initPostgres,
  initRedis,
  getPostgresPool,
  getRedisClient,
  checkDatabaseHealth,
  closeDatabaseConnections,
  safeQuery,
  cacheGet,
  cacheSet,
  cacheDel
};
