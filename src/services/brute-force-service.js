// ════════════════════════════════════════════════════════════════
// ROM AGENT - BRUTE FORCE PROTECTION SERVICE v2.8.0
// ════════════════════════════════════════════════════════════════
// Serviço de detecção e bloqueio de força bruta
// Implementa proteção em camadas (conta + IP)
// ════════════════════════════════════════════════════════════════

import { getPostgresPool } from '../config/database.js';
import auditService from './audit-service.js';

class BruteForceService {
  constructor() {
    this.pool = null;

    // Configurações (podem vir do .env)
    this.config = {
      // Bloqueio de conta
      maxFailedAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10),
      accountLockDurationMinutes: parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || '30', 10),

      // Bloqueio de IP
      maxIpFailuresInWindow: 10, // 10 falhas de qualquer usuário
      ipFailureWindowMinutes: 15, // Em 15 minutos
      ipBlockDurationMinutes: 60, // Bloqueia por 1 hora
    };
  }

  /**
   * Inicializa conexão com banco de dados
   */
  async init() {
    if (!this.pool) {
      this.pool = await getPostgresPool();
    }
  }

  /**
   * Verifica se conta está bloqueada
   *
   * @param {string} userId - UUID do usuário
   * @returns {Promise<Object>} { locked: boolean, until: Date|null, minutesRemaining: number }
   */
  async isAccountLocked(userId) {
    await this.init();

    const result = await this.pool.query(
      `SELECT account_locked_until
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { locked: false, until: null, minutesRemaining: 0 };
    }

    const user = result.rows[0];

    if (!user.account_locked_until) {
      return { locked: false, until: null, minutesRemaining: 0 };
    }

    const lockedUntil = new Date(user.account_locked_until);
    const now = new Date();

    // Se já passou do tempo de bloqueio, desbloquear automaticamente
    if (lockedUntil <= now) {
      await this.unlockAccount(userId, true); // Auto-unlock
      return { locked: false, until: null, minutesRemaining: 0 };
    }

    const diffMs = lockedUntil - now;
    const minutesRemaining = Math.ceil(diffMs / (1000 * 60));

    return {
      locked: true,
      until: lockedUntil,
      minutesRemaining
    };
  }

  /**
   * Verifica se IP está na blacklist
   *
   * @param {string} ipAddress - Endereço IP
   * @returns {Promise<Object>} { blocked: boolean, until: Date|null, reason: string|null }
   */
  async isIpBlacklisted(ipAddress) {
    await this.init();

    const result = await this.pool.query(
      `SELECT blocked_until, reason
       FROM ip_blacklist
       WHERE ip_address = $1`,
      [ipAddress]
    );

    if (result.rows.length === 0) {
      return { blocked: false, until: null, reason: null };
    }

    const blacklist = result.rows[0];
    const blockedUntil = new Date(blacklist.blocked_until);
    const now = new Date();

    // Se já passou do tempo de bloqueio, remover da blacklist
    if (blockedUntil <= now) {
      await this.unblockIp(ipAddress, true); // Auto-unblock
      return { blocked: false, until: null, reason: null };
    }

    return {
      blocked: true,
      until: blockedUntil,
      reason: blacklist.reason
    };
  }

  /**
   * Registra tentativa de login falhada
   * - Incrementa contador do usuário
   * - Bloqueia conta se atingir limite
   * - Bloqueia IP se atingir limite
   *
   * @param {string} userId - UUID do usuário (pode ser null se usuário não existe)
   * @param {string} ipAddress - Endereço IP
   * @param {string} email - Email tentado (para logging)
   * @returns {Promise<Object>} { accountLocked: boolean, ipBlocked: boolean }
   */
  async recordFailedLogin(userId, ipAddress, email = null) {
    await this.init();

    let accountLocked = false;
    let ipBlocked = false;

    // 1. Incrementar contador de falhas do usuário (se userId existe)
    if (userId) {
      const result = await this.pool.query(
        `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1
         WHERE id = $1
         RETURNING failed_login_attempts`,
        [userId]
      );

      const failedAttempts = result.rows[0]?.failed_login_attempts || 0;

      console.log(`⚠️ [BRUTE-FORCE] User ${userId.substring(0, 8)} - ${failedAttempts}/${this.config.maxFailedAttempts} tentativas`);

      // 2. Bloquear conta se atingiu limite
      if (failedAttempts >= this.config.maxFailedAttempts) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.config.accountLockDurationMinutes);

        await this.pool.query(
          `UPDATE users
           SET account_locked_until = $1
           WHERE id = $2`,
          [lockUntil, userId]
        );

        accountLocked = true;

        console.log(`🔒 [BRUTE-FORCE] Conta bloqueada: ${userId.substring(0, 8)} até ${lockUntil.toISOString()}`);

        // Audit log
        await auditService.log(
          auditService.ACTIONS.ACCOUNT_LOCKED,
          userId,
          {
            status: auditService.STATUS.SUCCESS,
            details: {
              reason: 'Múltiplas tentativas de login falhadas',
              attempts: failedAttempts,
              lockedUntil: lockUntil.toISOString()
            },
            ipAddress,
            userAgent: null
          }
        );
      }
    }

    // 3. Verificar falhas do IP (independente de usuário)
    const ipFailures = await this.getRecentIpFailures(ipAddress);

    console.log(`⚠️ [BRUTE-FORCE] IP ${ipAddress} - ${ipFailures}/${this.config.maxIpFailuresInWindow} tentativas em ${this.config.ipFailureWindowMinutes} min`);

    // 4. Bloquear IP se atingiu limite
    if (ipFailures >= this.config.maxIpFailuresInWindow) {
      const blockUntil = new Date();
      blockUntil.setMinutes(blockUntil.getMinutes() + this.config.ipBlockDurationMinutes);

      const reason = `${ipFailures} tentativas de login falhadas em ${this.config.ipFailureWindowMinutes} minutos`;

      // Inserir ou atualizar blacklist
      await this.pool.query(
        `INSERT INTO ip_blacklist (ip_address, reason, blocked_until, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (ip_address)
         DO UPDATE SET
           reason = EXCLUDED.reason,
           blocked_until = EXCLUDED.blocked_until`,
        [ipAddress, reason, blockUntil]
      );

      ipBlocked = true;

      console.log(`🚫 [BRUTE-FORCE] IP bloqueado: ${ipAddress} até ${blockUntil.toISOString()}`);

      // Audit log
      await auditService.log(
        auditService.ACTIONS.IP_BLOCKED,
        null,
        {
          status: auditService.STATUS.SUCCESS,
          details: {
            reason,
            attempts: ipFailures,
            blockedUntil: blockUntil.toISOString(),
            email: email || 'unknown'
          },
          ipAddress,
          userAgent: null
        }
      );
    }

    return {
      accountLocked,
      ipBlocked,
      attemptsRemaining: userId ? Math.max(0, this.config.maxFailedAttempts - (failedAttempts || 0)) : null
    };
  }

  /**
   * Reseta contador de tentativas falhadas após login bem-sucedido
   *
   * @param {string} userId - UUID do usuário
   * @returns {Promise<void>}
   */
  async resetFailedAttempts(userId) {
    await this.init();

    await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           account_locked_until = NULL
       WHERE id = $1`,
      [userId]
    );

    console.log(`✅ [BRUTE-FORCE] Contador resetado para user ${userId.substring(0, 8)}`);
  }

  /**
   * Conta falhas recentes do IP (janela configurável)
   *
   * @param {string} ipAddress - Endereço IP
   * @returns {Promise<number>} Número de falhas
   */
  async getRecentIpFailures(ipAddress) {
    await this.init();

    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM audit_log
       WHERE action = 'login'
         AND status = 'failure'
         AND ip_address = $1
         AND created_at > NOW() - INTERVAL '${this.config.ipFailureWindowMinutes} minutes'`,
      [ipAddress]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Desbloqueia conta manualmente (admin)
   *
   * @param {string} userId - UUID do usuário
   * @param {boolean} auto - Se é desbloqueio automático (não loga)
   * @returns {Promise<void>}
   */
  async unlockAccount(userId, auto = false) {
    await this.init();

    await this.pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           account_locked_until = NULL
       WHERE id = $1`,
      [userId]
    );

    if (!auto) {
      console.log(`🔓 [BRUTE-FORCE] Conta desbloqueada manualmente: ${userId.substring(0, 8)}`);

      await auditService.log(
        auditService.ACTIONS.ACCOUNT_UNLOCKED,
        userId,
        {
          status: auditService.STATUS.SUCCESS,
          details: { method: 'manual' },
          ipAddress: null,
          userAgent: null
        }
      );
    }
  }

  /**
   * Desbloqueia IP manualmente (admin)
   *
   * @param {string} ipAddress - Endereço IP
   * @param {boolean} auto - Se é desbloqueio automático (não loga)
   * @returns {Promise<void>}
   */
  async unblockIp(ipAddress, auto = false) {
    await this.init();

    await this.pool.query(
      `DELETE FROM ip_blacklist
       WHERE ip_address = $1`,
      [ipAddress]
    );

    if (!auto) {
      console.log(`🔓 [BRUTE-FORCE] IP desbloqueado manualmente: ${ipAddress}`);

      await auditService.log(
        auditService.ACTIONS.IP_UNBLOCKED,
        null,
        {
          status: auditService.STATUS.SUCCESS,
          details: { method: 'manual' },
          ipAddress,
          userAgent: null
        }
      );
    }
  }

  /**
   * Lista IPs bloqueados
   *
   * @returns {Promise<Array>} Lista de IPs bloqueados
   */
  async getBlockedIps() {
    await this.init();

    const result = await this.pool.query(
      `SELECT ip_address, reason, blocked_until, created_at
       FROM ip_blacklist
       WHERE blocked_until > NOW()
       ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * Lista contas bloqueadas
   *
   * @returns {Promise<Array>} Lista de usuários bloqueados
   */
  async getLockedAccounts() {
    await this.init();

    const result = await this.pool.query(
      `SELECT id, email, name, failed_login_attempts, account_locked_until
       FROM users
       WHERE account_locked_until IS NOT NULL
         AND account_locked_until > NOW()
       ORDER BY account_locked_until DESC`
    );

    return result.rows;
  }

  /**
   * Limpa blacklist expirada (executar via CRON)
   *
   * @returns {Promise<number>} Número de IPs removidos
   */
  async cleanupExpiredBlacklist() {
    await this.init();

    const result = await this.pool.query(
      `DELETE FROM ip_blacklist
       WHERE blocked_until < NOW()
       RETURNING ip_address`
    );

    const removedCount = result.rowCount;

    if (removedCount > 0) {
      console.log(`🗑️ [BRUTE-FORCE] ${removedCount} IP(s) removidos da blacklist (expirados)`);
    }

    return removedCount;
  }

  /**
   * Estatísticas de segurança
   *
   * @returns {Promise<Object>} Estatísticas
   */
  async getSecurityStats() {
    await this.init();

    const [blockedIpsCount, lockedAccountsCount, recentFailures] = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM ip_blacklist WHERE blocked_until > NOW()'),
      this.pool.query('SELECT COUNT(*) as count FROM users WHERE account_locked_until > NOW()'),
      this.pool.query(`
        SELECT COUNT(*) as count
        FROM audit_log
        WHERE action = 'login'
          AND status = 'failure'
          AND created_at > NOW() - INTERVAL '1 hour'
      `)
    ]);

    return {
      blockedIps: parseInt(blockedIpsCount.rows[0].count, 10),
      lockedAccounts: parseInt(lockedAccountsCount.rows[0].count, 10),
      recentFailures: parseInt(recentFailures.rows[0].count, 10),
      config: this.config
    };
  }

  /**
   * Configurações atuais
   */
  getConfig() {
    return { ...this.config };
  }
}

// Singleton
const bruteForceService = new BruteForceService();

export default bruteForceService;
