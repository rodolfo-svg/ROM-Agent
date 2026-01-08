/**
 * ════════════════════════════════════════════════════════════════
 * ROM AGENT - USER MANAGEMENT ROUTES
 * ════════════════════════════════════════════════════════════════
 * Rotas de gerenciamento de usuários (ADMIN ONLY)
 * - Listar usuários
 * - Criar usuário
 * - Editar usuário
 * - Deletar usuário
 * ════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { getPostgresPool } from '../config/database.js';
import logger from '../../lib/logger.js';

// Importar serviços de segurança
import auditService from '../services/audit-service.js';
import passwordPolicyService from '../services/password-policy-service.js';

// Importar middleware
import { requireAuth, requireAdmin } from '../middleware/permissions.js';

const router = express.Router();

/**
 * GET /api/users
 * Lista todos os usuários (apenas admin)
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pool = getPostgresPool();

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    const result = await pool.query(
      `SELECT
        id,
        email,
        name,
        role,
        oab,
        created_at as "createdAt",
        last_login_at as "lastLoginAt"
       FROM users
       ORDER BY created_at DESC`
    );

    logger.info('Admin listou usuários', {
      adminId: req.session.user.id,
      totalUsers: result.rows.length
    });

    res.json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    logger.error('Erro ao listar usuários', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Erro ao listar usuários'
    });
  }
});

/**
 * POST /api/users
 * Cria novo usuário (apenas admin)
 */
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role, oab } = req.body;

  // 1. Validação básica
  if (!email || !password || !name || !role) {
    return res.status(400).json({
      success: false,
      error: 'Email, senha, nome e função são obrigatórios'
    });
  }

  // 2. Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Email inválido'
    });
  }

  // 3. Validar role
  if (!['admin', 'user', 'viewer'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Função inválida'
    });
  }

  // 4. Validar complexidade de senha
  const passwordValidation = passwordPolicyService.validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return res.status(400).json({
      success: false,
      error: 'Senha não atende aos requisitos de segurança',
      details: passwordValidation.errors
    });
  }

  try {
    const pool = getPostgresPool();

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    // 5. Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email já cadastrado'
      });
    }

    // 6. Hash da senha
    const passwordHash = await passwordPolicyService.hashPassword(password);

    // 7. Calcular expiração da senha (90 dias)
    const passwordChangedAt = new Date();
    const passwordExpiresAt = passwordPolicyService.calculatePasswordExpiry(passwordChangedAt);

    // 8. Criar usuário
    const result = await pool.query(
      `INSERT INTO users
       (email, password_hash, name, oab, role, password_changed_at, password_expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, email, name, role, oab, created_at as "createdAt"`,
      [
        email.toLowerCase().trim(),
        passwordHash,
        name.trim(),
        oab || null,
        role,
        passwordChangedAt,
        passwordExpiresAt
      ]
    );

    const newUser = result.rows[0];

    // 9. Adicionar ao histórico de senhas
    await passwordPolicyService.addToPasswordHistory(newUser.id, passwordHash);

    // 10. Audit log
    await auditService.log(
      'user_created',
      req.session.user.id,
      {
        status: 'success',
        details: {
          createdUserId: newUser.id,
          createdUserEmail: newUser.email,
          createdUserRole: newUser.role
        },
        req
      }
    );

    logger.info('Usuário criado por admin', {
      adminId: req.session.user.id,
      newUserId: newUser.id,
      newUserEmail: newUser.email,
      role: newUser.role
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: newUser
    });

  } catch (error) {
    logger.error('Erro ao criar usuário', {
      error: error.message,
      adminId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao criar usuário'
    });
  }
});

/**
 * PUT /api/users/:id
 * Atualiza usuário (apenas admin)
 */
router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, password, name, role, oab } = req.body;

  // 1. Validação básica
  if (!email || !name || !role) {
    return res.status(400).json({
      success: false,
      error: 'Email, nome e função são obrigatórios'
    });
  }

  // 2. Validar role
  if (!['admin', 'user', 'viewer'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Função inválida'
    });
  }

  try {
    const pool = getPostgresPool();

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    // 3. Verificar se usuário existe
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // 4. Se senha foi fornecida, validar e atualizar
    if (password && password.trim() !== '') {
      const passwordValidation = passwordPolicyService.validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Senha não atende aos requisitos de segurança',
          details: passwordValidation.errors
        });
      }

      // Atualizar senha
      const updateResult = await passwordPolicyService.updatePassword(
        id,
        password,
        { forceChange: false }
      );

      if (!updateResult.success) {
        return res.status(400).json({
          success: false,
          error: updateResult.error
        });
      }
    }

    // 5. Atualizar dados do usuário
    const result = await pool.query(
      `UPDATE users
       SET email = $1, name = $2, role = $3, oab = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, name, role, oab, created_at as "createdAt"`,
      [email.toLowerCase().trim(), name.trim(), role, oab || null, id]
    );

    const updatedUser = result.rows[0];

    // 6. Audit log
    await auditService.log(
      'user_updated',
      req.session.user.id,
      {
        status: 'success',
        details: {
          updatedUserId: updatedUser.id,
          updatedUserEmail: updatedUser.email,
          passwordChanged: !!(password && password.trim())
        },
        req
      }
    );

    logger.info('Usuário atualizado por admin', {
      adminId: req.session.user.id,
      updatedUserId: updatedUser.id
    });

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      user: updatedUser
    });

  } catch (error) {
    logger.error('Erro ao atualizar usuário', {
      error: error.message,
      userId: id,
      adminId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar usuário'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Deleta usuário (apenas admin)
 */
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const pool = getPostgresPool();

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Banco de dados indisponível'
      });
    }

    // 1. Verificar se usuário existe e obter informações
    const userCheck = await pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userToDelete = userCheck.rows[0];

    // 2. Não permitir que admin delete a si mesmo
    if (id === req.session.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Você não pode deletar sua própria conta'
      });
    }

    // 3. Deletar usuário (hard delete por enquanto)
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // 4. Audit log
    await auditService.log(
      'user_deleted',
      req.session.user.id,
      {
        status: 'success',
        details: {
          deletedUserId: id,
          deletedUserEmail: userToDelete.email,
          deletedUserName: userToDelete.name
        },
        req
      }
    );

    logger.info('Usuário deletado por admin', {
      adminId: req.session.user.id,
      deletedUserId: id,
      deletedUserEmail: userToDelete.email
    });

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao deletar usuário', {
      error: error.message,
      userId: id,
      adminId: req.session.user.id
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao deletar usuário'
    });
  }
});

export default router;
