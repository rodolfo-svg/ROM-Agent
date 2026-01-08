/**
 * Middleware de Autenticação
 * Protege rotas que requerem usuário logado ou admin
 */

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      message: 'Você precisa estar logado para acessar este recurso'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.session.userRole !== 'admin' && req.session.userRole !== 'master_admin') {
    return res.status(403).json({
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }

  next();
};

const requirePartnerAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }

  const allowedRoles = ['admin', 'master_admin', 'partner_admin'];
  if (!allowedRoles.includes(req.session.userRole)) {
    return res.status(403).json({
      error: 'Acesso restrito',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Você não tem permissão para acessar este recurso'
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requirePartnerAdmin
};
