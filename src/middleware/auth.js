/**
 * AUTHENTICATION MIDDLEWARE
 * Verifica se usuário está autenticado via sessão
 */

import logger from '../../lib/logger.js';

/**
 * Middleware que verifica autenticação
 * Redireciona para /login.html se não estiver autenticado
 */
export function requireAuth(req, res, next) {
  // Verificar se usuário está autenticado
  if (req.session && req.session.user && req.session.user.id) {
    // Usuário autenticado, continuar
    return next();
  }

  // Usuário não autenticado
  logger.debug('Acesso negado - usuário não autenticado', {
    path: req.path,
    ip: req.ip
  });

  // Se for requisição HTML, redirecionar para login
  if (req.accepts('html')) {
    return res.redirect('/login.html');
  }

  // Se for requisição API, retornar 401
  return res.status(401).json({
    error: 'Não autenticado',
    message: 'Você precisa fazer login para acessar este recurso'
  });
}

/**
 * Middleware opcional que adiciona informações do usuário
 * mas não bloqueia acesso
 */
export function addUserInfo(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Middleware para rotas públicas (não requer autenticação)
 */
export function publicRoute(req, res, next) {
  next();
}

export default {
  requireAuth,
  addUserInfo,
  publicRoute
};
