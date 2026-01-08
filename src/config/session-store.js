/**
 * SESSION STORE CONFIGURATION
 * PostgreSQL-backed sessions com fallback para MemoryStore
 * Garante que sessões sobrevivem a redeploys quando DB disponível
 */

import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { getPostgresPool } from './database.js';
import logger from '../../lib/logger.js';

const PostgresSessionStore = connectPg(session);

/**
 * Cria session store (PostgreSQL ou fallback para memória)
 */
export function createSessionStore() {
  const pool = getPostgresPool();

  if (!pool) {
    logger.warn('PostgreSQL não disponível - usando MemoryStore (SESSÕES EFÊMERAS!)');
    logger.warn('⚠️  ATENÇÃO: Sessões serão perdidas em redeploy!');
    return new session.MemoryStore();
  }

  logger.info('Usando PostgreSQL SessionStore (sessões persistentes)');

  return new PostgresSessionStore({
    pool,
    tableName: 'sessions',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
    errorLog: (err) => {
      logger.error('PostgreSQL SessionStore error', { error: err.message });
    }
  });
}

/**
 * Configuração de session middleware
 */
export function createSessionMiddleware() {
  const store = createSessionStore();

  // Validar SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    throw new Error('❌ SESSION_SECRET é obrigatório! Configure no .env ou Render.com');
  }

  // Validar SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    throw new Error('❌ SESSION_SECRET é obrigatório! Configure no .env ou Render.com');
  }

  // Validar SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    throw new Error('❌ SESSION_SECRET é obrigatório! Configure no .env ou Render.com');
  }

  const sessionConfig = {
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    },
    name: 'rom.sid'
  };

  if (store instanceof session.MemoryStore) {
    logger.warn('Sessões configuradas com MemoryStore (temporárias)');
  } else {
    logger.info('Sessões configuradas com PostgreSQL (persistentes)', {
      maxAge: '7 dias',
      secure: sessionConfig.cookie.secure
    });
  }

  return session(sessionConfig);
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
  sessionEnhancerMiddleware
};
