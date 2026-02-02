/**
 * Middleware de Autorização para Custom Instructions
 *
 * HIERARQUIA DE PERMISSÕES:
 * - master_admin (usuário ROM): Pode editar Custom Instructions de ROM ou TODOS os escritórios
 * - partner_admin: Pode editar apenas Custom Instructions do próprio escritório
 * - user: Apenas visualiza Custom Instructions do próprio escritório
 *
 * ARQUITETURA:
 * Cada parceiro tem suas próprias Custom Instructions em:
 * data/custom-instructions/{partnerId}/custom-instructions.json
 */

/**
 * Middleware para verificar se usuário pode editar Custom Instructions
 *
 * REGRAS:
 * - master_admin: Pode editar ROM ou TODOS os escritórios
 * - partner_admin: Pode editar apenas o próprio escritório
 * - user: NÃO pode editar
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware
 */
export function canEditCustomInstructions(req, res, next) {
  const { partnerId } = req.params || req.body;
  const user = req.user;

  // Validação: partnerId é obrigatório
  if (!partnerId) {
    return res.status(400).json({
      success: false,
      error: 'partnerId é obrigatório'
    });
  }

  // Validação: usuário autenticado
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }

  // MASTER_ADMIN: Pode editar qualquer escritório (ROM ou parceiros)
  if (user.role === 'master_admin') {
    console.log(`[CustomInstructions Auth] master_admin ${user.id} autorizado a editar partnerId: ${partnerId}`);
    return next();
  }

  // PARTNER_ADMIN: Pode editar apenas o próprio escritório
  if (user.role === 'partner_admin') {
    if (user.partnerId === partnerId) {
      console.log(`[CustomInstructions Auth] partner_admin ${user.id} autorizado a editar próprio partnerId: ${partnerId}`);
      return next();
    } else {
      console.warn(`[CustomInstructions Auth] partner_admin ${user.id} tentou editar partnerId diferente: ${partnerId} (próprio: ${user.partnerId})`);
      return res.status(403).json({
        success: false,
        error: 'Você só pode editar Custom Instructions do seu próprio escritório',
        details: {
          attemptedPartnerId: partnerId,
          userPartnerId: user.partnerId
        }
      });
    }
  }

  // USER: Não pode editar
  console.warn(`[CustomInstructions Auth] user ${user.id} (role: ${user.role}) tentou editar Custom Instructions`);
  return res.status(403).json({
    success: false,
    error: 'Você não tem permissão para editar Custom Instructions',
    details: {
      userRole: user.role,
      requiredRole: 'partner_admin ou master_admin'
    }
  });
}

/**
 * Middleware para verificar se usuário pode visualizar Custom Instructions
 *
 * REGRAS:
 * - master_admin: Pode visualizar qualquer escritório
 * - partner_admin: Pode visualizar apenas o próprio escritório
 * - user: Pode visualizar apenas o próprio escritório
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware
 */
export function canViewCustomInstructions(req, res, next) {
  const { partnerId } = req.params;
  const user = req.user;

  // Validação: partnerId é obrigatório
  if (!partnerId) {
    return res.status(400).json({
      success: false,
      error: 'partnerId é obrigatório'
    });
  }

  // Validação: usuário autenticado
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }

  // MASTER_ADMIN: Pode visualizar qualquer escritório
  if (user.role === 'master_admin') {
    console.log(`[CustomInstructions Auth] master_admin ${user.id} autorizado a visualizar partnerId: ${partnerId}`);
    return next();
  }

  // PARTNER_ADMIN e USER: Podem visualizar apenas o próprio escritório
  if (user.partnerId === partnerId) {
    console.log(`[CustomInstructions Auth] ${user.role} ${user.id} autorizado a visualizar próprio partnerId: ${partnerId}`);
    return next();
  }

  // Negado: Tentou visualizar outro escritório
  console.warn(`[CustomInstructions Auth] ${user.role} ${user.id} tentou visualizar partnerId diferente: ${partnerId} (próprio: ${user.partnerId})`);
  return res.status(403).json({
    success: false,
    error: 'Você não tem permissão para visualizar Custom Instructions deste escritório',
    details: {
      attemptedPartnerId: partnerId,
      userPartnerId: user.partnerId
    }
  });
}

/**
 * Middleware para verificar se usuário pode listar Custom Instructions de múltiplos escritórios
 *
 * REGRAS:
 * - master_admin: Pode listar TODOS os escritórios
 * - partner_admin/user: Podem listar apenas o próprio escritório
 *
 * Este middleware NÃO bloqueia, apenas adiciona informações ao req para filtragem posterior
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware
 */
export function canListCustomInstructions(req, res, next) {
  const user = req.user;

  // Validação: usuário autenticado
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }

  // Adiciona informações de filtro ao request
  if (user.role === 'master_admin') {
    req.customInstructionsFilter = {
      canViewAll: true,
      partnerIds: null // null = todos
    };
    console.log(`[CustomInstructions Auth] master_admin ${user.id} pode listar todos os escritórios`);
  } else {
    req.customInstructionsFilter = {
      canViewAll: false,
      partnerIds: [user.partnerId] // apenas o próprio
    };
    console.log(`[CustomInstructions Auth] ${user.role} ${user.id} pode listar apenas partnerId: ${user.partnerId}`);
  }

  next();
}

/**
 * Middleware para verificar se usuário pode aplicar sugestões de IA
 *
 * REGRAS:
 * - Mesmas regras de canEditCustomInstructions
 * - Somente quem pode editar pode aplicar sugestões
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware
 */
export function canApplySuggestions(req, res, next) {
  // Reutiliza a mesma lógica de edição
  return canEditCustomInstructions(req, res, next);
}

/**
 * Middleware para verificar se usuário pode fazer rollback de versões
 *
 * REGRAS:
 * - Apenas master_admin pode fazer rollback
 * - Partner_admin NÃO pode fazer rollback (apenas editar versão atual)
 *
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware
 */
export function canRollbackVersion(req, res, next) {
  const { partnerId } = req.params;
  const user = req.user;

  // Validação: partnerId é obrigatório
  if (!partnerId) {
    return res.status(400).json({
      success: false,
      error: 'partnerId é obrigatório'
    });
  }

  // Validação: usuário autenticado
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Usuário não autenticado'
    });
  }

  // APENAS MASTER_ADMIN pode fazer rollback
  if (user.role === 'master_admin') {
    console.log(`[CustomInstructions Auth] master_admin ${user.id} autorizado a fazer rollback de partnerId: ${partnerId}`);
    return next();
  }

  // Negado para todos os outros
  console.warn(`[CustomInstructions Auth] ${user.role} ${user.id} tentou fazer rollback (operação restrita a master_admin)`);
  return res.status(403).json({
    success: false,
    error: 'Apenas o administrador geral (master_admin) pode fazer rollback de versões',
    details: {
      userRole: user.role,
      requiredRole: 'master_admin'
    }
  });
}
