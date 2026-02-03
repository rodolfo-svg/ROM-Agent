/**
 * ════════════════════════════════════════════════════════════════
 * ROM AGENT - AUTHENTICATION ROUTES v2.8.0
 * ════════════════════════════════════════════════════════════════
 * Rotas completas de autenticação com segurança robusta
 * - Login/Logout
 * - Registro de usuários
 * - Recuperação de senha
 * - Troca de senha
 * - Políticas de segurança integradas
 * ════════════════════════════════════════════════════════════════
 */

import express from 'express';
import crypto from 'crypto';
import { getPostgresPool } from '../config/database.js';
import logger from '../../lib/logger.js';
import { authLimiter } from '../../lib/rate-limiter.js';

// Importar serviços de segurança
import auditService from '../services/audit-service.js';
import passwordPolicyService from '../services/password-policy-service.js';
import bruteForceService from '../services/brute-force-service.js';
import emailService from '../services/email-service.js';

// Importar middleware
import { requireAuth } from '../middleware/permissions.js';
import { regenerateCsrfToken } from '../middleware/csrf-protection.js';

const router = express.Router();

/**
 * GET /api/csrf-token
 * Retorna CSRF token para o frontend
 * Público - não requer autenticação
 */
router.get('/csrf-token', (req, res) => {
  if (!req.session) {
    return res.status(500).json({
      success: false,
      error: 'Sessão não inicializada'
    });
  }

  // Token já foi gerado pelo middleware csrfTokenGenerator
  const csrfToken = req.session.csrfToken || res.locals.csrfToken;

  if (!csrfToken) {
    return res.status(500).json({
      success: false,
      error: 'CSRF token não disponível'
    });
  }

  res.json({
    success: true,
    csrfToken
  });
});

/**
 * POST /api/auth/register
 * Registra novo usuário no sistema
 * Rate limit: 5 tentativas por hora
 */
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name, oab } = req.body;

  // 1. Validação básica
  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      error: 'Email, senha e nome são obrigatórios'
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

  // 3. Validar complexidade de senha
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
      logger.error('PostgreSQL não disponível para registro');
      return res.status(503).json({
        success: false,
        error: 'Banco de dados temporariamente indisponível'
      });
    }

    // 4. Verificar se email já existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      await auditService.log(
        'register',
        null,
        {
          status: 'failure',
          details: { reason: 'Email já existe', email },
          req
        }
      );

      return res.status(400).json({
        success: false,
        error: 'Email já cadastrado'
      });
    }

    // 5. Hash da senha
    const passwordHash = await passwordPolicyService.hashPassword(password);

    // 6. Calcular expiração da senha (90 dias)
    const passwordChangedAt = new Date();
    const passwordExpiresAt = passwordPolicyService.calculatePasswordExpiry(passwordChangedAt);

    // 7. Criar usuário (role padrão: 'user')
    const result = await pool.query(
      `INSERT INTO users
       (email, password_hash, name, oab, role, password_changed_at, password_expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, email, name, role, oab`,
      [
        email.toLowerCase().trim(),
        passwordHash,
        name.trim(),
        oab || null,
        'user',
        passwordChangedAt,
        passwordExpiresAt
      ]
    );

    const newUser = result.rows[0];

    // 8. Adicionar ao histórico de senhas
    await passwordPolicyService.addToPasswordHistory(newUser.id, passwordHash);

    // 9. Audit log
    await auditService.log(
      'register',
      newUser.id,
      {
        status: 'success',
        details: { email: newUser.email, name: newUser.name },
        req
      }
    );

    // 10. Enviar email de boas-vindas (não bloquear por falha de email)
    emailService.sendWelcomeEmail(newUser.email, newUser.name).catch(err => {
      logger.error('Erro ao enviar email de boas-vindas', { error: err.message });
    });

    logger.info('Novo usuário registrado', {
      userId: newUser.id,
      email: newUser.email
    });

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        oab: newUser.oab
      }
    });

  } catch (error) {
    logger.error('Erro ao registrar usuário', {
      error: error.message,
      email
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar registro'
    });
  }
});

/**
 * POST /api/auth/login
 * Autentica usuário com email e senha
 * Integrado com proteções anti-brute-force
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

  const ipAddress = auditService.extractIpAddress(req);

  try {
    const pool = getPostgresPool();

    if (!pool) {
      logger.error('PostgreSQL não disponível para autenticação');
      return res.status(503).json({
        success: false,
        error: 'Banco de dados temporariamente indisponível'
      });
    }

    // 1. Buscar usuário
    const result = await pool.query(
      `SELECT id, email, password_hash, name, role, oab,
              password_expires_at, force_password_change, account_locked_until
       FROM users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      // Audit log (falha - usuário não existe)
      await auditService.log(
        'login_failed',
        null,
        {
          status: 'failure',
          details: { reason: 'Email não encontrado', email },
          req
        }
      );

      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos'
      });
    }

    const user = result.rows[0];

    // 2. Verificar se conta está bloqueada
    const lockCheck = await bruteForceService.isAccountLocked(user.id);
    if (lockCheck.locked) {
      await auditService.log(
        'login_failed',
        user.id,
        {
          status: 'failure',
          details: {
            reason: 'Conta bloqueada',
            lockedUntil: lockCheck.until,
            minutesRemaining: lockCheck.minutesRemaining
          },
          req
        }
      );

      return res.status(403).json({
        success: false,
        error: `Conta temporariamente bloqueada. Tente novamente em ${lockCheck.minutesRemaining} minutos`,
        code: 'ACCOUNT_LOCKED',
        minutesRemaining: lockCheck.minutesRemaining
      });
    }

    // 3. Verificar senha
    const passwordValid = await passwordPolicyService.comparePassword(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      // Registrar falha e verificar bloqueios
      const bruteForceResult = await bruteForceService.recordFailedLogin(
        user.id,
        ipAddress,
        email
      );

      // Audit log
      await auditService.log(
        'login_failed',
        user.id,
        {
          status: 'failure',
          details: {
            reason: 'Senha incorreta',
            attemptsRemaining: bruteForceResult.attemptsRemaining
          },
          req
        }
      );

      // Enviar email se conta foi bloqueada
      if (bruteForceResult.accountLocked) {
        const lockMinutes = bruteForceService.config.accountLockDurationMinutes;
        emailService.sendAccountLockedEmail(user.email, user.name, lockMinutes).catch(err => {
          logger.error('Erro ao enviar email de bloqueio', { error: err.message });
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Email ou senha incorretos',
        attemptsRemaining: bruteForceResult.attemptsRemaining
      });
    }

    // 4. Senha correta - resetar contador de falhas
    await bruteForceService.resetFailedAttempts(user.id);

    // 5. Verificar se senha expirou
    const passwordExpired = passwordPolicyService.isPasswordExpired(user);
    if (passwordExpired) {
      await auditService.log(
        'password_expired',
        user.id,
        {
          status: 'success',
          details: { expiresAt: user.password_expires_at },
          req
        }
      );

      return res.status(403).json({
        success: false,
        error: 'Sua senha expirou. Por favor, redefina sua senha',
        code: 'PASSWORD_EXPIRED',
        requiresPasswordChange: true
      });
    }

    // 6. Verificar se precisa forçar troca de senha
    if (user.force_password_change) {
      return res.status(403).json({
        success: false,
        error: 'Você precisa alterar sua senha antes de continuar',
        code: 'PASSWORD_CHANGE_REQUIRED',
        requiresPasswordChange: true
      });
    }

    // 7. Atualizar last_login_at
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // 8. Criar sessão
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      oab: user.oab
    };

    // Compatibilidade com código legacy
    req.session.userId = user.id;
    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.userRole = user.role;

    // LOG DETALHADO: Verificar role sendo salvo na sessão
    console.log('🔐 [AUTH] Sessão criada com sucesso:', {
      userId: user.id,
      email: user.email,
      role: user.role,
      roleInSession: req.session.user.role,
      userRoleInSession: req.session.userRole,
      sessionId: req.sessionID,
      authenticated: req.session.authenticated
    });

    // 9. Regenerar CSRF token por segurança
    regenerateCsrfToken(req, res, () => {});

    // 10. Audit log (sucesso)
    await auditService.log(
      'login',
      user.id,
      {
        status: 'success',
        details: { email: user.email },
        req
      }
    );

    logger.info('Login bem-sucedido', {
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
router.post('/logout', async (req, res) => {
  const userId = req.session?.user?.id;

  // Audit log
  if (userId) {
    await auditService.log(
      'logout',
      userId,
      {
        status: 'success',
        req
      }
    );
  }

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
 * POST /api/auth/forgot-password
 * Solicita recuperação de senha por email
 * Rate limit: 3 tentativas por hora
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email é obrigatório'
    });
  }

  try {
    const pool = getPostgresPool();

    // 1. Buscar usuário
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    // Sempre retornar sucesso (não revelar se email existe)
    if (result.rows.length === 0) {
      await auditService.log(
        'password_reset_request',
        null,
        {
          status: 'failure',
          details: { reason: 'Email não encontrado', email },
          req
        }
      );

      // Retornar sucesso mesmo assim (segurança)
      return res.json({
        success: true,
        message: 'Se o email existir, você receberá instruções para redefinir sua senha'
      });
    }

    const user = result.rows[0];

    // 2. Gerar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // 3. Invalidar tokens antigos do usuário
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id]
    );

    // 4. Salvar novo token
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, resetToken, expiresAt]
    );

    // 5. Enviar email
    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetToken
    );

    // 6. Audit log
    await auditService.log(
      'password_reset_request',
      user.id,
      {
        status: 'success',
        details: { emailSent: emailResult.success },
        req
      }
    );

    if (!emailResult.success) {
      logger.error('Falha ao enviar email de reset', {
        userId: user.id,
        error: emailResult.error
      });
    }

    logger.info('Token de recuperação gerado', {
      userId: user.id,
      expiresAt
    });

    res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir sua senha'
    });

  } catch (error) {
    logger.error('Erro ao processar forgot-password', {
      error: error.message,
      email
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar solicitação'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Completa reset de senha usando token
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Token e nova senha são obrigatórios'
    });
  }

  try {
    const pool = getPostgresPool();

    // 1. Buscar token válido
    const tokenResult = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.name
       FROM password_reset_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }

    const tokenData = tokenResult.rows[0];

    // 2. Verificar se token já foi usado
    if (tokenData.used_at) {
      return res.status(400).json({
        success: false,
        error: 'Este token já foi utilizado'
      });
    }

    // 3. Verificar se token expirou
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Token expirado. Solicite um novo reset de senha'
      });
    }

    // 4. Atualizar senha com serviço (valida complexidade + histórico)
    const updateResult = await passwordPolicyService.updatePassword(
      tokenData.user_id,
      newPassword,
      { forceChange: false }
    );

    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        error: updateResult.error
      });
    }

    // 5. Marcar token como usado
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenData.id]
    );

    // 6. Invalidar todas as sessões do usuário
    await pool.query(
      'DELETE FROM sessions WHERE sess::json->\'user\'->>\'id\' = $1',
      [tokenData.user_id]
    );

    // 7. Enviar email de confirmação
    emailService.sendPasswordChangedEmail(tokenData.email, tokenData.name).catch(err => {
      logger.error('Erro ao enviar email de confirmação', { error: err.message });
    });

    // 8. Audit log
    await auditService.log(
      'password_reset_complete',
      tokenData.user_id,
      {
        status: 'success',
        req
      }
    );

    logger.info('Senha redefinida com sucesso', {
      userId: tokenData.user_id
    });

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Você pode fazer login agora'
    });

  } catch (error) {
    logger.error('Erro ao resetar senha', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar reset de senha'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Troca senha do usuário autenticado
 */
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Senha atual e nova senha são obrigatórias'
    });
  }

  try {
    const pool = getPostgresPool();

    // 1. Buscar usuário
    const result = await pool.query(
      'SELECT password_hash, email, name FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    // 2. Verificar senha atual
    const currentPasswordValid = await passwordPolicyService.comparePassword(
      currentPassword,
      user.password_hash
    );

    if (!currentPasswordValid) {
      await auditService.log(
        'password_change',
        userId,
        {
          status: 'failure',
          details: { reason: 'Senha atual incorreta' },
          req
        }
      );

      return res.status(401).json({
        success: false,
        error: 'Senha atual incorreta'
      });
    }

    // 3. Atualizar senha (valida complexidade + histórico)
    const updateResult = await passwordPolicyService.updatePassword(
      userId,
      newPassword,
      { forceChange: false }
    );

    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        error: updateResult.error
      });
    }

    // 4. Enviar email de confirmação
    emailService.sendPasswordChangedEmail(user.email, user.name).catch(err => {
      logger.error('Erro ao enviar email de confirmação', { error: err.message });
    });

    // 5. Audit log
    await auditService.log(
      'password_change',
      userId,
      {
        status: 'success',
        req
      }
    );

    // 6. Regenerar CSRF token
    regenerateCsrfToken(req, res, () => {});

    logger.info('Senha alterada com sucesso', { userId });

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao trocar senha', {
      error: error.message,
      userId
    });

    res.status(500).json({
      success: false,
      error: 'Erro ao processar troca de senha'
    });
  }
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
 * Verifica se usuário está autenticado
 */
router.get('/check', (req, res) => {
  const authenticated = !!(req.session && req.session.user && req.session.user.id);

  res.json({
    authenticated,
    user: authenticated ? req.session.user : null
  });
});

export default router;
