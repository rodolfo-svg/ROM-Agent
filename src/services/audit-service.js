// ════════════════════════════════════════════════════════════════
// ROM AGENT - AUDIT SERVICE v2.8.0
// ════════════════════════════════════════════════════════════════
// Serviço de auditoria completo para logging de ações de segurança
// Implementa compliance com LGPD/GDPR (retenção de 1 ano)
// ════════════════════════════════════════════════════════════════

import { getPostgresPool } from '../config/database.js';

class AuditService {
  constructor() {
    this.pool = null;
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
   * Extrai IP do request (considerando proxies)
   */
  extractIpAddress(req) {
    return (
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extrai User-Agent do request
   */
  extractUserAgent(req) {
    return req.headers['user-agent'] || 'unknown';
  }

  /**
   * Registra ação de auditoria
   *
   * @param {string} action - Ação realizada (login, logout, register, password_change, etc)
   * @param {string|null} userId - UUID do usuário (null para ações anônimas)
   * @param {Object} options - Opções adicionais
   * @param {string} options.resource - Recurso afetado (ex: user_id, document_id)
   * @param {string} options.status - 'success' ou 'failure'
   * @param {Object} options.details - Detalhes adicionais em JSON
   * @param {Object|null} options.req - Objeto request do Express (para extrair IP/UA)
   * @param {string|null} options.ipAddress - IP manual (se req não disponível)
   * @param {string|null} options.userAgent - User-Agent manual (se req não disponível)
   *
   * @returns {Promise<Object>} Registro criado
   */
  async log(action, userId = null, options = {}) {
    await this.init();

    const {
      resource = null,
      status = 'success',
      details = {},
      req = null,
      ipAddress = null,
      userAgent = null
    } = options;

    // Extrair IP e User-Agent
    const ip = ipAddress || (req ? this.extractIpAddress(req) : null);
    const ua = userAgent || (req ? this.extractUserAgent(req) : null);

    try {
      const result = await this.pool.query(
        `INSERT INTO audit_log
         (user_id, action, resource, ip_address, user_agent, status, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          userId,
          action,
          resource,
          ip,
          ua,
          status,
          JSON.stringify(details)
        ]
      );

      const logEntry = result.rows[0];

      // Log no console para monitoramento
      const statusEmoji = status === 'success' ? '✅' : '❌';
      const userInfo = userId ? `User ${userId.substring(0, 8)}` : 'Anonymous';
      console.log(`${statusEmoji} [AUDIT] ${action.toUpperCase()} - ${userInfo} - ${ip} - ${status}`);

      return logEntry;
    } catch (error) {
      console.error('❌ [AUDIT] Erro ao registrar auditoria:', error.message);
      // Não propagar erro para não quebrar fluxo principal
      return null;
    }
  }

  /**
   * Busca logs de auditoria com filtros
   *
   * @param {Object} filters - Filtros de busca
   * @param {string} filters.userId - Filtrar por usuário
   * @param {string} filters.action - Filtrar por ação
   * @param {string} filters.status - Filtrar por status (success/failure)
   * @param {string} filters.ipAddress - Filtrar por IP
   * @param {Date} filters.startDate - Data inicial
   * @param {Date} filters.endDate - Data final
   * @param {number} filters.limit - Limite de resultados (padrão: 100)
   * @param {number} filters.offset - Offset para paginação (padrão: 0)
   * @param {string} filters.orderBy - Campo para ordenar (padrão: created_at)
   * @param {string} filters.order - Ordem (ASC ou DESC, padrão: DESC)
   *
   * @returns {Promise<Object>} { logs: [], total: number, page: number, totalPages: number }
   */
  async getAuditLog(filters = {}) {
    await this.init();

    const {
      userId = null,
      action = null,
      status = null,
      ipAddress = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      order = 'DESC'
    } = filters;

    // Construir WHERE dinamicamente
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (ipAddress) {
      conditions.push(`ip_address = $${paramIndex++}`);
      params.push(ipAddress);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query principal
    const query = `
      SELECT
        id,
        user_id,
        action,
        resource,
        ip_address,
        user_agent,
        status,
        details,
        created_at
      FROM audit_log
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    // Query de contagem total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_log
      ${whereClause}
    `;

    try {
      const [logsResult, countResult] = await Promise.all([
        this.pool.query(query, params),
        this.pool.query(countQuery, params.slice(0, -2)) // Remover limit/offset
      ]);

      const logs = logsResult.rows;
      const total = parseInt(countResult.rows[0].total, 10);
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        logs,
        total,
        page: currentPage,
        totalPages,
        limit,
        offset
      };
    } catch (error) {
      console.error('❌ [AUDIT] Erro ao buscar logs:', error.message);
      throw error;
    }
  }

  /**
   * Busca logs de um usuário específico
   */
  async getUserAuditLog(userId, options = {}) {
    return this.getAuditLog({
      userId,
      ...options
    });
  }

  /**
   * Busca tentativas de login falhadas de um IP
   */
  async getFailedLoginsByIp(ipAddress, minutes = 15) {
    await this.init();

    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM audit_log
       WHERE action = 'login'
         AND status = 'failure'
         AND ip_address = $1
         AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
      [ipAddress]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Busca tentativas de login falhadas de um usuário
   */
  async getFailedLoginsByUser(userId, minutes = 15) {
    await this.init();

    const result = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM audit_log
       WHERE action = 'login'
         AND status = 'failure'
         AND user_id = $1
         AND created_at > NOW() - INTERVAL '${minutes} minutes'`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Busca últimas ações de um usuário
   */
  async getRecentUserActions(userId, limit = 10) {
    return this.getAuditLog({
      userId,
      limit,
      orderBy: 'created_at',
      order: 'DESC'
    });
  }

  /**
   * Busca ações suspeitas (múltiplas falhas)
   */
  async getSuspiciousActivity(minutes = 60, threshold = 5) {
    await this.init();

    const result = await this.pool.query(
      `SELECT
         ip_address,
         COUNT(*) as failure_count,
         MAX(created_at) as last_attempt
       FROM audit_log
       WHERE status = 'failure'
         AND created_at > NOW() - INTERVAL '${minutes} minutes'
       GROUP BY ip_address
       HAVING COUNT(*) >= $1
       ORDER BY failure_count DESC`,
      [threshold]
    );

    return result.rows;
  }

  /**
   * Estatísticas de auditoria
   */
  async getStatistics(filters = {}) {
    await this.init();

    const {
      startDate = null,
      endDate = null
    } = filters;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_events,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_events,
        COUNT(CASE WHEN action = 'login' AND status = 'success' THEN 1 END) as successful_logins,
        COUNT(CASE WHEN action = 'login' AND status = 'failure' THEN 1 END) as failed_logins,
        COUNT(CASE WHEN action = 'register' THEN 1 END) as registrations,
        COUNT(CASE WHEN action = 'password_change' THEN 1 END) as password_changes,
        COUNT(CASE WHEN action = 'password_reset_request' THEN 1 END) as password_resets
      FROM audit_log
      ${whereClause}
    `, params);

    return result.rows[0];
  }

  /**
   * Limpa logs antigos (retenção: 1 ano)
   * Executar via CRON mensal
   */
  async cleanupOldLogs() {
    await this.init();

    const result = await this.pool.query(
      `DELETE FROM audit_log
       WHERE created_at < NOW() - INTERVAL '1 year'
       RETURNING id`
    );

    const deletedCount = result.rowCount;
    console.log(`🗑️ [AUDIT] ${deletedCount} logs antigos removidos (> 1 ano)`);

    return deletedCount;
  }

  /**
   * Ações de auditoria suportadas (constantes)
   */
  static get ACTIONS() {
    return {
      // Autenticação
      LOGIN: 'login',
      LOGOUT: 'logout',
      REGISTER: 'register',
      LOGIN_FAILED: 'login_failed',

      // Senha
      PASSWORD_CHANGE: 'password_change',
      PASSWORD_RESET_REQUEST: 'password_reset_request',
      PASSWORD_RESET_COMPLETE: 'password_reset_complete',
      PASSWORD_EXPIRED: 'password_expired',

      // Conta
      ACCOUNT_LOCKED: 'account_locked',
      ACCOUNT_UNLOCKED: 'account_unlocked',
      ACCOUNT_DELETED: 'account_deleted',
      ACCOUNT_UPDATED: 'account_updated',

      // Permissões
      PERMISSION_DENIED: 'permission_denied',
      ROLE_CHANGED: 'role_changed',

      // Sessões
      SESSION_CREATED: 'session_created',
      SESSION_DESTROYED: 'session_destroyed',
      SESSION_LIMIT_REACHED: 'session_limit_reached',

      // Segurança
      IP_BLOCKED: 'ip_blocked',
      IP_UNBLOCKED: 'ip_unblocked',
      CSRF_VIOLATION: 'csrf_violation',
      BRUTE_FORCE_DETECTED: 'brute_force_detected',

      // Dados
      DOCUMENT_UPLOADED: 'document_uploaded',
      DOCUMENT_DELETED: 'document_deleted',
      PROJECT_CREATED: 'project_created',
      PROJECT_DELETED: 'project_deleted',

      // Admin
      ADMIN_ACTION: 'admin_action',
      USER_IMPERSONATION: 'user_impersonation'
    };
  }

  /**
   * Status de auditoria (constantes)
   */
  static get STATUS() {
    return {
      SUCCESS: 'success',
      FAILURE: 'failure'
    };
  }
}

// Singleton
const auditService = new AuditService();

export default auditService;
