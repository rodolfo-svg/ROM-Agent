/**
 * DATABASE CONFIGURATION
 * PostgreSQL + Redis connection management with graceful degradation
 */

import pg from 'pg';
import Redis from 'ioredis';
import logger from '../../lib/logger.js';

let pgPool = null;
let redisClient = null;

/**
 * Inicializa conexão PostgreSQL
 * @returns {pg.Pool|null} Pool de conexões ou null se falhar
 */
export async function initPostgres() {
  if (pgPool) {
    return pgPool;
  }

  try {
    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
          max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        }
      : {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DB || 'rom_agent',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD,
          max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        };

    pgPool = new pg.Pool(config);

    const startTime = Date.now();
    await pgPool.query('SELECT NOW()');
    const latency = Date.now() - startTime;

    logger.info('PostgreSQL conectado', {
      latency: `${latency}ms`,
      poolSize: config.max
    });

    pgPool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });

    return pgPool;
  } catch (error) {
    logger.warn('PostgreSQL INDISPONÍVEL - dados serão perdidos em redeploy!', {
      error: error.message
    });
    logger.warn('Configure DATABASE_URL para persistência de dados');
    pgPool = null;
    return null;
  }
}

/**
 * Inicializa conexão Redis
 * @returns {Redis|null} Cliente Redis ou null se falhar
 */
export async function initRedis() {
  if (redisClient) {
    return redisClient;
  }

  try {
    const config = process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableReadyCheck: true
    };

    redisClient = new Redis(config);

    const startTime = Date.now();
    await redisClient.connect();
    await redisClient.ping();
    const latency = Date.now() - startTime;

    logger.info('Redis conectado', {
      latency: `${latency}ms`
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    return redisClient;
  } catch (error) {
    logger.warn('Redis INDISPONÍVEL - cache e sessões serão efêmeros!', {
      error: error.message
    });
    logger.warn('Configure REDIS_URL para sessões persistentes');
    redisClient = null;
    return null;
  }
}

export function getPostgresPool() {
  return pgPool;
}

export function getRedisClient() {
  return redisClient;
}

export async function safeQuery(sql, params = []) {
  const pool = getPostgresPool();

  if (!pool) {
    logger.debug('safeQuery: PostgreSQL indisponível, usando fallback');
    return { rows: [], fallback: true };
  }

  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    logger.error('Database query failed', {
      error: error.message,
      sql: sql.substring(0, 100) + '...'
    });
    return { rows: [], error, fallback: true };
  }
}

export async function closeDatabaseConnections() {
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
        logger.info('Redis desconectado');
        redisClient = null;
      })
    );
  }

  await Promise.all(promises);
}

export async function checkDatabaseHealth() {
  const health = {
    postgres: { available: false, latency: null },
    redis: { available: false, latency: null }
  };

  if (pgPool) {
    try {
      const start = Date.now();
      await pgPool.query('SELECT 1');
      health.postgres.available = true;
      health.postgres.latency = Date.now() - start;
    } catch (error) {
      logger.error('PostgreSQL health check failed', { error: error.message });
    }
  }

  if (redisClient) {
    try {
      const start = Date.now();
      await redisClient.ping();
      health.redis.available = true;
      health.redis.latency = Date.now() - start;
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
    }
  }

  return health;
}

export default {
  initPostgres,
  initRedis,
  getPostgresPool,
  getRedisClient,
  safeQuery,
  closeDatabaseConnections,
  checkDatabaseHealth
};
