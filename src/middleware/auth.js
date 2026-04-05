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

  // Rotas /api/* SEMPRE retornam JSON (401), nunca redirect
  // ⚠️ IMPORTANTE: req.path pode não incluir /api quando router é montado com app.use('/api', router)
  // Então verificamos tanto req.path quanto req.originalUrl
  const isApiRoute = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');

  if (isApiRoute) {
    return res.status(401).json({
      error: 'Não autenticado',
      message: 'Você precisa fazer login para acessar este recurso'
    });
  }

  // Se for requisição HTML (páginas), redirecionar para login
  // ⚠️ ATENÇÃO: req.accepts('html') retorna true para Accept: */*
  // Apenas redirecionar se Accept header indica preferência por HTML sobre JSON
  const acceptHeader = req.get('Accept') || '';
  const prefersHtml = acceptHeader.includes('text/html') && !acceptHeader.includes('application/json');

  if (prefersHtml) {
    return res.redirect('/login.html');
  }

  // Fallback: retornar 401 JSON
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
