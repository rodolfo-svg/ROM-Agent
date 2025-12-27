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
    createTableIfMissing: true, // Criar tabela automaticamente se não existir
    pruneSessionInterval: 60 * 15, // Limpar sessões expiradas a cada 15min
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

  const sessionConfig = {
    store,
    secret: process.env.SESSION_SECRET || 'rom-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false, // Não criar sessão até que algo seja armazenado
    rolling: true, // Reset expiration time on every request
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
      sameSite: 'lax'
    },
    name: 'rom.sid' // Nome customizado do cookie
  };

  // Log de configuração
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
  // Adicionar helper para verificar se sessão está autenticada
  req.session.isAuthenticated = function() {
    return !!(this.user && this.user.id);
  };

  // Adicionar helper para obter userId
  req.session.getUserId = function() {
    return this.user ? this.user.id : null;
  };

  // Log de debug (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL === 'debug') {
    logger.debug('Session accessed', {
      sessionId: req.sessionID,
      userId: req.session.getUserId(),
      path: req.path
    });
  }

  next();
}

/**
 * Export default
 */
export default {
  createSessionStore,
  createSessionMiddleware,
  sessionEnhancerMiddleware
};
