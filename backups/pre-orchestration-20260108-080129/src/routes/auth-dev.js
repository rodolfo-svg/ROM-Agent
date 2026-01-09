/**
 * DEV AUTHENTICATION ROUTES
 * Rotas de autenticação para desenvolvimento local SEM banco de dados
 * APENAS para NODE_ENV !== 'production'
 */

import express from 'express';
import logger from '../../lib/logger.js';

const router = express.Router();

// Usuário de desenvolvimento em memória
const DEV_USER = {
  id: 'dev-user-1',
  email: 'dev@localhost',
  name: 'Desenvolvedor Local',
  role: 'admin',
  oab: 'DEV/0000'
};

/**
 * POST /api/auth/dev-login
 * Autentica usuário de desenvolvimento (qualquer email/senha)
 */
router.post('/dev-login', async (req, res) => {
  const { email, password } = req.body;

  // Só permite em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Dev login não disponível em produção'
    });
  }

  logger.info('Dev login attempt', { email });

  // Aceita qualquer credencial em dev
  // Cria sessão
  req.session.user = DEV_USER;
  req.session.userId = DEV_USER.id;
  req.session.authenticated = true;
  req.session.username = DEV_USER.name;
  req.session.userRole = DEV_USER.role;

  logger.info('Dev user authenticated', {
    userId: DEV_USER.id,
    email,
    mode: 'development'
  });

  res.json({
    success: true,
    user: {
      id: DEV_USER.id,
      email: DEV_USER.email,
      name: DEV_USER.name,
      role: DEV_USER.role,
      oab: DEV_USER.oab
    }
  });
});

/**
 * GET /api/auth/dev-status
 * Verifica se dev mode está ativo
 */
router.get('/dev-status', (req, res) => {
  res.json({
    devMode: process.env.NODE_ENV !== 'production',
    user: req.session?.user || null
  });
});

export default router;
