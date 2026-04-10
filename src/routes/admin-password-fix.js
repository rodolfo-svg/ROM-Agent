/**
 * ROM Agent - Admin Password Fix Endpoint (TEMPORÁRIO)
 *
 * Endpoint temporário para diagnosticar e corrigir problemas de senha
 * ATENÇÃO: Remover após resolver o problema
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPostgresPool } from '../config/database.js';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * POST /api/admin/password-fix/diagnose
 * Diagnosticar status de senha de um usuário
 */
router.post('/diagnose', requireAuth, async (req, res) => {
  try {
    const pool = getPostgresPool();

    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem usar este endpoint'
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório'
      });
    }

    // Buscar usuário
    const result = await pool.query(
      `SELECT
        id, email, name, role,
        password_changed_at,
        password_expires_at,
        force_password_change,
        account_locked,
        account_locked_until,
        created_at,
        updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Usuário com email ${email} não encontrado`
      });
    }

    const user = result.rows[0];
    const now = new Date();

    // Calcular status
    let passwordStatus = 'válida';
    let daysUntilExpiry = null;
    let expired = false;

    if (user.password_expires_at) {
      const expiresAt = new Date(user.password_expires_at);
      daysUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (expiresAt < now) {
        passwordStatus = 'expirada';
        expired = true;
      } else if (daysUntilExpiry <= 7) {
        passwordStatus = 'expirando em breve';
      }
    } else {
      passwordStatus = 'sem data de expiração (NULL)';
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      passwordInfo: {
        changedAt: user.password_changed_at,
        expiresAt: user.password_expires_at,
        status: passwordStatus,
        daysUntilExpiry,
        expired,
        forceChange: user.force_password_change,
        accountLocked: user.account_locked,
        accountLockedUntil: user.account_locked_until
      },
      diagnosis: expired
        ? 'Senha expirada - execute /reset para corrigir'
        : passwordStatus === 'sem data de expiração (NULL)'
        ? 'Campo password_expires_at está NULL - execute /reset para corrigir'
        : 'Senha está válida'
    });

  } catch (error) {
    console.error('[AdminPasswordFix] Error in diagnose:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao diagnosticar senha',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/password-fix/reset
 * Resetar senha e estender expiração
 */
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const pool = getPostgresPool();

    // Verificar se é admin
    if (req.session.user.role !== 'master_admin' && req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Apenas administradores podem usar este endpoint'
      });
    }

    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email e newPassword são obrigatórios'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Senha deve ter no mínimo 8 caracteres'
      });
    }

    // Verificar se usuário existe
    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Usuário com email ${email} não encontrado`
      });
    }

    const user = userResult.rows[0];

    // Gerar hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Calcular nova data de expiração (90 dias)
    const passwordChangedAt = new Date();
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + 90);

    // Atualizar senha no banco
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           force_password_change = false,
           account_locked = false,
           account_locked_until = NULL,
           updated_at = NOW()
       WHERE id = $4`,
      [passwordHash, passwordChangedAt, passwordExpiresAt, user.id]
    );

    console.log(`✅ [AdminPasswordFix] Senha resetada para usuário: ${email}`);

    res.json({
      success: true,
      message: 'Senha resetada com sucesso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      passwordInfo: {
        changedAt: passwordChangedAt.toISOString(),
        expiresAt: passwordExpiresAt.toISOString(),
        daysUntilExpiry: 90
      }
    });

  } catch (error) {
    console.error('[AdminPasswordFix] Error in reset:', error);
    res.status(500).json({
      success: false,
      error: 'Falha ao resetar senha',
      message: error.message
    });
  }
});

export default router;
