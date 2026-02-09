/**
 * SESSION STORE CONFIGURATION (v2.0.0)
 *
 * Multi-tier session storage:
 * - Primary: Redis (fast, distributed)
 * - Fallback: PostgreSQL (persistent)
 * - Emergency: MemoryStore (ephemeral)
 *
 * Garante que sessoes sobrevivem a redeploys quando DB disponivel
 */

import session from 'express-session';
import connectPg from 'connect-pg-simple';
import RedisStore from 'connect-redis';
import { getPostgresPool, getRedisClient } from './database.js';
import logger from '../../lib/logger.js';

const PostgresSessionStore = connectPg(session);

/**
 * Create Redis session store
 * @returns {RedisStore|null} Redis store or null if unavailable
 */
function createRedisSessionStore() {
  const redisClient = getRedisClient();

  if (!redisClient || redisClient.status !== 'ready') {
    return null;
  }

  try {
    const store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
      ttl: 86400, // 24 hours in seconds
      disableTouch: false, // Update TTL on access
      serializer: {
        stringify: JSON.stringify,
        parse: JSON.parse
      }
    });

    logger.info('Redis SessionStore created (primary, fast)');
    return store;
  } catch (error) {
    logger.warn('Failed to create Redis SessionStore', { error: error.message });
    return null;
  }
}

/**
 * Create PostgreSQL session store (fallback)
 * @returns {PostgresSessionStore|null} PostgreSQL store or null if unavailable
 */
function createPostgresSessionStore() {
  const pool = getPostgresPool();

  if (!pool) {
    return null;
  }

  try {
    const store = new PostgresSessionStore({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // Prune every 15 minutes
      errorLog: (err) => {
        logger.error('PostgreSQL SessionStore error', { error: err.message });
      }
    });

    logger.info('PostgreSQL SessionStore created (fallback, persistent)');
    return store;
  } catch (error) {
    logger.warn('Failed to create PostgreSQL SessionStore', { error: error.message });
    return null;
  }
}

/**
 * Cria session store com hierarquia: Redis > PostgreSQL > Memory
 * @returns {Object} Session store with metadata
 */
export function createSessionStore() {
  // Try Redis first (fastest)
  const redisStore = createRedisSessionStore();
  if (redisStore) {
    return {
      store: redisStore,
      type: 'redis',
      persistent: true,
      distributed: true
    };
  }

  // Fallback to PostgreSQL (persistent)
  const pgStore = createPostgresSessionStore();
  if (pgStore) {
    logger.warn('Redis nao disponivel - usando PostgreSQL SessionStore');
    return {
      store: pgStore,
      type: 'postgresql',
      persistent: true,
      distributed: false
    };
  }

  // Emergency fallback to MemoryStore
  logger.warn('Redis e PostgreSQL nao disponiveis - usando MemoryStore (SESSOES EFEMERAS!)');
  logger.warn('ATENCAO: Sessoes serao perdidas em redeploy!');

  return {
    store: new session.MemoryStore(),
    type: 'memory',
    persistent: false,
    distributed: false
  };
}

/**
 * Configuracao de session middleware
 */
export function createSessionMiddleware() {
  const { store, type, persistent, distributed } = createSessionStore();

  // Validar SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET e obrigatorio! Configure no .env ou Render.com');
  }

  const sessionConfig = {
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.iarom.com.br' : undefined
    },
    name: 'rom.sid',
    proxy: true // Trust proxy headers (Cloudflare/Render)
  };

  // Log session configuration
  logger.info('Session middleware configured', {
    storeType: type,
    persistent,
    distributed,
    maxAge: '7 dias',
    secure: sessionConfig.cookie.secure
  });

  // Attach store info to middleware for health checks
  const middleware = session(sessionConfig);
  middleware._storeInfo = { type, persistent, distributed };

  return middleware;
}

/**
 * Get session store health status
 * @param {Object} storeInfo - Store information from middleware
 * @returns {Object} Health status
 */
export function getSessionStoreHealth(storeInfo) {
  if (!storeInfo) {
    return { healthy: false, error: 'No store info available' };
  }

  return {
    healthy: true,
    type: storeInfo.type,
    persistent: storeInfo.persistent,
    distributed: storeInfo.distributed
  };
}

/**
 * Middleware para adicionar informações ao objeto de sessão
 */
export function sessionEnhancerMiddleware(req, res, next) {
  req.session.isAuthenticated = function() {
    return !!(this.user && this.user.id);
  };

  req.session.getUserId = function() {
    return this.user ? this.user.id : null;
  };

  // COMPATIBILIDADE: Se req.session.user existe mas userId não, adicionar automaticamente
  if (req.session.user && req.session.user.id && !req.session.userId) {
    req.session.userId = req.session.user.id;
    req.session.authenticated = true;
    req.session.username = req.session.user.name;
    req.session.userRole = req.session.user.role;
    logger.info('Session compatibility fix applied', {
      userId: req.session.userId,
      sessionId: req.sessionID
    });
  }

  if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
    logger.debug('Session accessed', {
      sessionId: req.sessionID,
      userId: req.session.getUserId(),
      path: req.path
    });
  }

  next();
}

export default {
  createSessionStore,
  createSessionMiddleware,
  sessionEnhancerMiddleware,
  getSessionStoreHealth
};
