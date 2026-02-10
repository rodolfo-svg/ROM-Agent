/**
 * DATABASE CONFIGURATION (v2.0.0)
 * PostgreSQL + Redis connection management with graceful degradation
 *
 * Redis Enhancements (WS8):
 * - Optimized connection pooling
 * - Automatic reconnection with exponential backoff
 * - Command timeout configuration
 * - Connection health monitoring
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
  console.log('🔍 [PG] initPostgres() INICIADO');
  console.log('🔍 [PG] DATABASE_URL existe:', !!process.env.DATABASE_URL);
  console.log('🔍 [PG] NODE_ENV:', process.env.NODE_ENV);

  if (pgPool) {
    console.log('🔍 [PG] Pool já existe, retornando existente');
    return pgPool;
  }

  try {
    // Optimized pool configuration for production performance
    const poolConfig = {
      max: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
      min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'ROM-Agent'
    };

    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
          ...poolConfig
        }
      : {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DB || 'rom_agent',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD,
          ...poolConfig
        };

    console.log('🔍 [PG] Usando DATABASE_URL:', !!process.env.DATABASE_URL);
    console.log('🔍 [PG] SSL habilitado:', !!config.ssl);
    console.log('🔍 [PG] Pool size:', config.max, '(min:', config.min + ')');
    console.log('🔍 [PG] Connection timeout:', config.connectionTimeoutMillis + 'ms');
    console.log('🔍 [PG] Statement timeout:', config.statement_timeout + 'ms');
    console.log('🔍 [PG] Application name:', config.application_name);

    console.log('🔍 [PG] Criando pg.Pool...');
    pgPool = new pg.Pool(config);

    // Configurar schema (para separar staging/production)
    const schema = process.env.DATABASE_SCHEMA || 'public';

    // Hook para configurar schema em TODAS as conexões do pool
    if (schema !== 'public') {
      pgPool.on('connect', async (client) => {
        await client.query(`SET search_path TO ${schema}, public`);
      });
    }

    console.log('🔍 [PG] Testando conexão com SELECT NOW()...');
    const startTime = Date.now();
    await pgPool.query('SELECT NOW()');
    const latency = Date.now() - startTime;

    // Criar schema se não existir
    if (schema !== 'public') {
      console.log(`🔍 [PG] Criando e configurando schema: ${schema}`);
      await pgPool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      await pgPool.query(`SET search_path TO ${schema}, public`);
      console.log(`✅ [PG] Schema ${schema} configurado`);
    }

    console.log('✅ [PG] PostgreSQL CONECTADO em ' + latency + 'ms');
    logger.info('PostgreSQL conectado', {
      latency: `${latency}ms`,
      poolSize: config.max
    });

    pgPool.on('error', (err) => {
      console.error('❌ [PG] Pool error:', err.message);
      logger.error('PostgreSQL pool error', { error: err.message });
    });

    return pgPool;
  } catch (error) {
    console.error('━'.repeat(70));
    console.error('❌ [PG] ERRO AO CONECTAR POSTGRESQL');
    console.error('❌ [PG] Error message:', error.message);
    console.error('❌ [PG] Error code:', error.code);
    console.error('❌ [PG] Error stack:', error.stack);
    console.error('━'.repeat(70));

    logger.warn('PostgreSQL INDISPONÍVEL - dados serão perdidos em redeploy!', {
      error: error.message
    });
    logger.warn('Configure DATABASE_URL para persistência de dados');
    pgPool = null;
    return null;
  }
}

/**
 * Inicializa conexao Redis com configuracao otimizada
 * @returns {Redis|null} Cliente Redis ou null se falhar
 */
export async function initRedis() {
  if (redisClient) {
    return redisClient;
  }

  console.log('[Redis] initRedis() INICIADO');
  console.log('[Redis] REDIS_URL existe:', !!process.env.REDIS_URL);

  // 🚫 Skip Redis if explicitly disabled or not configured
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('⚠️  [Redis] DESABILITADO via ENV (DISABLE_REDIS=true)');
    logger.info('Redis desabilitado - sessions e cache usarão memória/file');
    return null;
  }

  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.log('⚠️  [Redis] NÃO CONFIGURADO (sem REDIS_URL ou REDIS_HOST)');
    console.log('ℹ️  [Redis] Sistema continuará sem cache Redis (usando memory/file)');
    console.log('ℹ️  [Redis] Para habilitar: adicione REDIS_URL ou DISABLE_REDIS=true para remover este aviso');
    logger.info('Redis não configurado - usando fallback memory/file');
    return null;
  }

  try {
    // Enhanced retry strategy with exponential backoff
    const retryStrategy = (times) => {
      if (times > 3) {
        logger.warn('Redis max retries exceeded, giving up');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      logger.info(`Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    };

    // Base configuration for optimized performance
    const baseConfig = {
      // Connection settings
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 30000,

      // Retry configuration
      retryStrategy,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,

      // Performance optimizations
      enableOfflineQueue: true,
      enableAutoPipelining: true,
      autoPipeliningIgnoredCommands: ['subscribe', 'psubscribe', 'unsubscribe', 'punsubscribe'],

      // Connection pool (for cluster mode)
      family: 4, // IPv4

      // Logging
      showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
    };

    let config;

    if (process.env.REDIS_URL) {
      // Parse REDIS_URL and merge with base config
      config = {
        ...baseConfig
      };
      console.log('[Redis] Usando REDIS_URL');
      redisClient = new Redis(process.env.REDIS_URL, config);
    } else {
      // Use individual environment variables
      config = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
        ...baseConfig
      };
      console.log('[Redis] Usando configuracao individual');
      console.log('[Redis] Host:', config.host, 'Port:', config.port, 'DB:', config.db);
      redisClient = new Redis(config);
    }

    // ✅ CRITICAL: Register error handler BEFORE connecting
    // Prevents unhandled error events that crash the server
    redisClient.on('error', (err) => {
      console.error('[Redis] Erro de conexão (servidor continuará sem cache):', err.message);
      logger.error('Redis error', { error: err.message });
    });

    // Connect and test
    const startTime = Date.now();
    await redisClient.connect();
    await redisClient.ping();
    const latency = Date.now() - startTime;

    console.log('[Redis] Redis CONECTADO em ' + latency + 'ms');
    logger.info('Redis conectado (otimizado)', {
      latency: `${latency}ms`,
      autoPipelining: true,
      commandTimeout: '5000ms'
    });

    redisClient.on('reconnecting', (delay) => {
      logger.info('Redis reconnecting', { delay });
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready');
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] ERRO AO CONECTAR REDIS');
    console.error('[Redis] Error message:', error.message);

    logger.warn('Redis INDISPONIVEL - cache e sessoes serao efemeros!', {
      error: error.message
    });
    logger.warn('Configure REDIS_URL para sessoes persistentes');
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
    postgres: { available: false, latency: null, poolSize: null, idleCount: null },
    redis: { available: false, latency: null, status: null, memoryUsage: null }
  };

  // Check PostgreSQL
  if (pgPool) {
    try {
      const start = Date.now();
      await pgPool.query('SELECT 1');
      health.postgres.available = true;
      health.postgres.latency = Date.now() - start;
      health.postgres.poolSize = pgPool.totalCount;
      health.postgres.idleCount = pgPool.idleCount;
      health.postgres.waitingCount = pgPool.waitingCount;
    } catch (error) {
      logger.error('PostgreSQL health check failed', { error: error.message });
      health.postgres.error = error.message;
    }
  }

  // Check Redis with enhanced info
  if (redisClient) {
    try {
      const start = Date.now();
      await redisClient.ping();
      health.redis.available = true;
      health.redis.latency = Date.now() - start;
      health.redis.status = redisClient.status;

      // Get memory info
      try {
        const info = await redisClient.info('memory');
        const usedMemoryMatch = info.match(/used_memory_human:(\S+)/);
        if (usedMemoryMatch) {
          health.redis.memoryUsage = usedMemoryMatch[1];
        }
      } catch {
        // Ignore memory info errors
      }

      // Get connection info
      try {
        const clientInfo = await redisClient.info('clients');
        const connectedClientsMatch = clientInfo.match(/connected_clients:(\d+)/);
        if (connectedClientsMatch) {
          health.redis.connectedClients = parseInt(connectedClientsMatch[1]);
        }
      } catch {
        // Ignore client info errors
      }
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      health.redis.error = error.message;
    }
  }

  return health;
}

/**
 * Get Redis client status
 * @returns {Object} Redis status info
 */
export function getRedisStatus() {
  if (!redisClient) {
    return { connected: false, status: 'disconnected' };
  }

  return {
    connected: redisClient.status === 'ready',
    status: redisClient.status,
    commandQueueLength: redisClient.commandQueue?.length || 0
  };
}

export default {
  initPostgres,
  initRedis,
  getPostgresPool,
  getRedisClient,
  getRedisStatus,
  safeQuery,
  closeDatabaseConnections,
  checkDatabaseHealth
};
