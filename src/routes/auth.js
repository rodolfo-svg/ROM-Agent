/**
 * AUTHENTICATION ROUTES
 * Rotas de login, logout e verificação de autenticação
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { getPostgresPool } from '../config/database.js';
import logger from '../../lib/logger.js';
import { authLimiter } from '../../lib/rate-limiter.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Autentica usuário com email e senha
 * Rate limit: 20 tentativas por 15 minutos
 */
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  // Validação básica
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email e senha são obrigatórios'
    });
  }

  try {
    const pool = getPostgresPool();

    if (!pool) {
      logger.error('PostgreSQL não disponível para autenticação');
      return res.status(503).json({
        success: false,
        error: 'Banco de dados temporariamente indisponível'
      });
    }

    // Buscar usuário no banco
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, oab FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      logger.warn('Tentativa de login com email inexistente', { email });
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    const user = result.rows[0];

    // Verificar senha
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      logger.warn('Tentativa de login com senha incorreta', {
        email,
        userId: user.id
      });
      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    // Atualizar last_login_at
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Criar sessão (formato completo para compatibilidade)
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      oab: user.oab
    };

    // Compatibilidade com rotas que usam req.session.userId diretamente
    req.session.userId = user.id;
    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.userRole = user.role;

    logger.info('Usuário autenticado com sucesso', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        oab: user.oab
      }
    });

  } catch (error) {
    logger.error('Erro ao autenticar usuário', {
      error: error.message,
      email
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar login'
    });
  }
});

/**
 * POST /api/auth/logout
 * Encerra sessão do usuário
 */
router.post('/logout', (req, res) => {
  const userId = req.session?.user?.id;

  req.session.destroy((err) => {
    if (err) {
      logger.error('Erro ao encerrar sessão', {
        error: err.message,
        userId
      });
      return res.status(500).json({
        success: false,
        error: 'Erro ao fazer logout'
      });
    }

    logger.info('Sessão encerrada', { userId });

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  });
});

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    user: req.session.user
  });
});

/**
 * GET /api/auth/check
 * Verifica se usuário está autenticado (para frontend)
 */
router.get('/check', (req, res) => {
  const authenticated = !!(req.session && req.session.user && req.session.user.id);

  res.json({
    authenticated,
    user: authenticated ? req.session.user : null
  });
});

export default router;
