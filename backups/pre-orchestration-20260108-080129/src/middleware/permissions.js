// ════════════════════════════════════════════════════════════════
// ROM AGENT - PERMISSIONS MIDDLEWARE (RBAC) v2.8.0
// ════════════════════════════════════════════════════════════════
// Role-Based Access Control (RBAC)
// Define permissões por role e middleware de verificação
// ════════════════════════════════════════════════════════════════

import auditService from '../services/audit-service.js';

/**
 * Definição de roles disponíveis
 */
export const ROLES = {
  ADMIN: 'admin',
  LAWYER: 'lawyer',
  USER: 'user'
};

/**
 * Definição de permissões por role
 *
 * '*' = todas as permissões
 * Permissões seguem padrão: recurso:ação
 * Ex: 'chat:use', 'projects:create', 'users:delete'
 */
export const PERMISSIONS = {
  [ROLES.ADMIN]: ['*'], // Admin tem todas as permissões

  [ROLES.LAWYER]: [
    // Chat e IA
    'chat:use',
    'chat:history',
    'ai:use',

    // Documentos
    'documents:create',
    'documents:read',
    'documents:update',
    'documents:delete',
    'documents:export',
    'upload:document',

    // Pesquisa
    'jurisprudence:search',
    'doctrine:search',
    'legislation:search',

    // Projetos
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',

    // Redação
    'redaction:create',
    'redaction:edit',
    'redaction:review',

    // Auditoria (própria)
    'audit:read:own',

    // Perfil
    'profile:read',
    'profile:update',
    'password:change'
  ],

  [ROLES.USER]: [
    // Chat básico
    'chat:use',
    'chat:history',

    // Upload limitado
    'upload:document',

    // Pesquisa básica
    'jurisprudence:search',
    'doctrine:search',

    // Documentos (apenas leitura e criação básica)
    'documents:read',
    'documents:create',

    // Auditoria (própria)
    'audit:read:own',

    // Perfil
    'profile:read',
    'profile:update',
    'password:change'
  ]
};

/**
 * Verifica se usuário tem permissão específica
 *
 * @param {string} userRole - Role do usuário
 * @param {string} permission - Permissão a verificar (ex: 'projects:create')
 * @returns {boolean} true se tem permissão
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) {
    return false;
  }

  const userPermissions = PERMISSIONS[userRole] || [];

  // Admin tem todas as permissões
  if (userPermissions.includes('*')) {
    return true;
  }

  // Verificação exata
  if (userPermissions.includes(permission)) {
    return true;
  }

  // Verificação com wildcard (ex: 'documents:*' permite 'documents:read')
  const [resource] = permission.split(':');
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Verifica se usuário tem pelo menos uma das permissões
 *
 * @param {string} userRole - Role do usuário
 * @param {Array<string>} permissions - Lista de permissões
 * @returns {boolean} true se tem pelo menos uma
 */
export function hasAnyPermission(userRole, permissions) {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Verifica se usuário tem todas as permissões
 *
 * @param {string} userRole - Role do usuário
 * @param {Array<string>} permissions - Lista de permissões
 * @returns {boolean} true se tem todas
 */
export function hasAllPermissions(userRole, permissions) {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Middleware para verificar autenticação
 */
export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação necessária',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware para verificar permissão específica
 *
 * @param {string} permission - Permissão necessária
 * @returns {Function} Middleware Express
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    // Verificar autenticação primeiro
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.session.user.role || ROLES.USER;

    // Verificar permissão
    if (!hasPermission(userRole, permission)) {
      console.warn(`⚠️ [PERMISSIONS] Acesso negado: ${req.session.user.email} - ${permission}`);

      // Audit log
      try {
        await auditService.log(
          'permission_denied',
          req.session.user.id,
          {
            status: 'failure',
            resource: req.path,
            details: {
              permission,
              userRole,
              method: req.method
            },
            req
          }
        );
      } catch (error) {
        console.error('Erro ao registrar audit log:', error.message);
      }

      return res.status(403).json({
        success: false,
        error: 'Permissão negada',
        code: 'PERMISSION_DENIED',
        details: {
          required: permission,
          userRole
        }
      });
    }

    // Permissão concedida
    next();
  };
};

/**
 * Middleware para verificar múltiplas permissões (qualquer uma)
 *
 * @param {Array<string>} permissions - Lista de permissões (OR)
 * @returns {Function} Middleware Express
 */
export const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.session.user.role || ROLES.USER;

    if (!hasAnyPermission(userRole, permissions)) {
      console.warn(`⚠️ [PERMISSIONS] Acesso negado: ${req.session.user.email} - ${permissions.join(' OR ')}`);

      await auditService.log(
        'permission_denied',
        req.session.user.id,
        {
          status: 'failure',
          resource: req.path,
          details: {
            permissions,
            userRole,
            method: req.method
          },
          req
        }
      );

      return res.status(403).json({
        success: false,
        error: 'Permissão negada',
        code: 'PERMISSION_DENIED',
        details: {
          required: permissions,
          userRole
        }
      });
    }

    next();
  };
};

/**
 * Middleware para verificar role específico
 *
 * @param {string|Array<string>} allowedRoles - Role(s) permitido(s)
 * @returns {Function} Middleware Express
 */
export const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.session.user.role || ROLES.USER;

    if (!roles.includes(userRole)) {
      console.warn(`⚠️ [PERMISSIONS] Role insuficiente: ${req.session.user.email} - ${userRole}`);

      await auditService.log(
        'permission_denied',
        req.session.user.id,
        {
          status: 'failure',
          resource: req.path,
          details: {
            requiredRoles: roles,
            userRole,
            method: req.method
          },
          req
        }
      );

      return res.status(403).json({
        success: false,
        error: 'Role insuficiente',
        code: 'INSUFFICIENT_ROLE',
        details: {
          required: roles,
          current: userRole
        }
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se é admin
 */
export const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Middleware para verificar se é lawyer ou admin
 */
export const requireLawyerOrAdmin = requireRole([ROLES.LAWYER, ROLES.ADMIN]);

/**
 * Middleware para anexar permissões do usuário ao request
 * Útil para lógica condicional
 */
export const attachPermissions = (req, res, next) => {
  if (req.session && req.session.user) {
    const userRole = req.session.user.role || ROLES.USER;
    req.userPermissions = PERMISSIONS[userRole] || [];
    req.userRole = userRole;
    req.isAdmin = userRole === ROLES.ADMIN;
    req.isLawyer = userRole === ROLES.LAWYER || userRole === ROLES.ADMIN;
  } else {
    req.userPermissions = [];
    req.userRole = null;
    req.isAdmin = false;
    req.isLawyer = false;
  }
  next();
};

/**
 * Helper para verificar propriedade de recurso
 * (usuário só pode acessar seus próprios recursos)
 */
export const requireOwnership = (resourceUserIdGetter) => {
  return async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userId = req.session.user.id;
    const userRole = req.session.user.role || ROLES.USER;

    // Admin pode acessar qualquer recurso
    if (userRole === ROLES.ADMIN) {
      return next();
    }

    // Obter ID do dono do recurso
    const resourceUserId = typeof resourceUserIdGetter === 'function'
      ? await resourceUserIdGetter(req)
      : resourceUserIdGetter;

    // Verificar propriedade
    if (resourceUserId !== userId) {
      console.warn(`⚠️ [PERMISSIONS] Acesso negado (ownership): ${req.session.user.email}`);

      await auditService.log(
        'permission_denied',
        userId,
        {
          status: 'failure',
          resource: req.path,
          details: {
            reason: 'ownership_violation',
            resourceUserId,
            method: req.method
          },
          req
        }
      );

      return res.status(403).json({
        success: false,
        error: 'Você não tem permissão para acessar este recurso',
        code: 'OWNERSHIP_REQUIRED'
      });
    }

    next();
  };
};

/**
 * Retorna todas as permissões de um role
 */
export const getPermissionsForRole = (role) => {
  return PERMISSIONS[role] || [];
};

/**
 * Retorna todos os roles disponíveis
 */
export const getAllRoles = () => {
  return Object.values(ROLES);
};

/**
 * Exportação padrão
 */
export default {
  ROLES,
  PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireAuth,
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireAdmin,
  requireLawyerOrAdmin,
  attachPermissions,
  requireOwnership,
  getPermissionsForRole,
  getAllRoles
};
