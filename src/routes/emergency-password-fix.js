/**
 * ROM Agent - EMERGENCY Password Fix Endpoint
 * TEMPORÁRIO - Endpoint público para resolver senha expirada
 * DELETAR após usar!
 */

import { Router } from 'express';
import { pool } from '../config/database.js';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * POST /api/emergency/fix-password-mota2323
 * Endpoint de emergência para resetar senha
 * Secret key hardcoded para segurança mínima
 */
router.post('/fix-password-mota2323', async (req, res) => {
  try {
    const { secret } = req.body;

    // Validar secret key
    if (secret !== 'mota2323kb-emergency-fix-2026') {
      return res.status(403).json({
        success: false,
        error: 'Invalid secret key'
      });
    }

    const email = 'rodolfo@rom.adv.br';
    const newPassword = 'Mota@2323';

    console.log('🚨 [EMERGENCY] Iniciando reset de senha para:', email);

    // Verificar se usuário existe
    const userCheck = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    );

    if (userCheck.rows.length === 0) {
      console.error('❌ [EMERGENCY] Usuário não encontrado:', email);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Hash da senha
    console.log('🔐 [EMERGENCY] Gerando hash bcrypt...');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Calcular expiração (90 dias)
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Atualizar senha
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
      [passwordHash, now, expiresAt, user.id]
    );

    console.log('✅ [EMERGENCY] Senha resetada com sucesso!');
    console.log(`   Usuário: ${user.name} (${user.email})`);
    console.log(`   Expira em: ${expiresAt.toISOString()}`);

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      passwordInfo: {
        changedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        daysUntilExpiry: 90
      }
    });

  } catch (error) {
    console.error('❌ [EMERGENCY] Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message
    });
  }
});

export default router;
