// ════════════════════════════════════════════════════════════════
// ROM AGENT - PASSWORD POLICY SERVICE v2.8.0
// ════════════════════════════════════════════════════════════════
// Serviço de políticas de senha robustas
// Implementa NIST Password Guidelines + OWASP recommendations
// ════════════════════════════════════════════════════════════════

import bcrypt from 'bcryptjs';
import { getPostgresPool } from '../config/database.js';

class PasswordPolicyService {
  constructor() {
    this.pool = null;

    // Configurações (podem vir do .env)
    this.config = {
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
      expiryDays: parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10),
      historyCount: parseInt(process.env.PASSWORD_HISTORY_COUNT || '5', 10),
      bcryptRounds: 12 // Salt rounds para bcrypt
    };

    // Lista de senhas comuns/fracas (top 100)
    this.commonPasswords = new Set([
      'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey',
      'password1', '123456789', '12345', '1234567', 'password123',
      'admin', 'letmein', 'welcome', 'login', 'passw0rd', 'master',
      'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', 'batman',
      'dragon', 'ninja', 'mustang', 'access', 'shadow', 'master',
      '123123', '654321', 'superman', 'qwertyuiop', '1234', 'football',
      'iloveyou', 'admin123', 'welcome1', 'login123', '1q2w3e4r',
      'senha', 'senha123', 'admin@123', 'root', 'toor', 'pass',
      'test', 'guest', 'user', '000000', '111111', '123321'
    ]);
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
   * Valida complexidade de senha
   *
   * @param {string} password - Senha a validar
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validatePasswordStrength(password) {
    const errors = [];

    // 1. Comprimento mínimo
    if (!password || password.length < this.config.minLength) {
      errors.push(`Senha deve ter no mínimo ${this.config.minLength} caracteres`);
    }

    // 2. Pelo menos 1 letra maiúscula
    if (!/[A-Z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra MAIÚSCULA');
    }

    // 3. Pelo menos 1 letra minúscula
    if (!/[a-z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    }

    // 4. Pelo menos 1 número
    if (!/[0-9]/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    }

    // 5. Pelo menos 1 símbolo especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Senha deve conter pelo menos um símbolo especial (!@#$%^&*...)');
    }

    // 6. Não pode ser uma senha comum
    if (this.commonPasswords.has(password.toLowerCase())) {
      errors.push('Senha muito comum. Escolha uma senha mais segura');
    }

    // 7. Não pode ter sequências óbvias
    if (this.hasSequentialChars(password)) {
      errors.push('Senha não pode conter sequências óbvias (123, abc, etc)');
    }

    // 8. Não pode ter caracteres repetidos em excesso
    if (this.hasExcessiveRepetition(password)) {
      errors.push('Senha não pode ter o mesmo caractere repetido mais de 3 vezes');
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  /**
   * Detecta sequências óbvias
   */
  hasSequentialChars(password) {
    const sequences = [
      '0123456789', '9876543210',
      'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba',
      'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
    ];

    const lowerPassword = password.toLowerCase();

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 3; i++) {
        const subseq = seq.substring(i, i + 3);
        if (lowerPassword.includes(subseq)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detecta repetição excessiva
   */
  hasExcessiveRepetition(password) {
    const regex = /(.)\1{3,}/; // Mesmo caractere 4+ vezes seguidas
    return regex.test(password);
  }

  /**
   * Calcula força da senha (0-100)
   */
  calculatePasswordStrength(password) {
    let strength = 0;

    // Comprimento
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;

    // Complexidade
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 15;

    // Variedade de caracteres
    const uniqueChars = new Set(password.split('')).size;
    if (uniqueChars >= 8) strength += 10;

    return Math.min(strength, 100);
  }

  /**
   * Verifica se senha está no histórico (últimas N senhas)
   *
   * @param {string} userId - UUID do usuário
   * @param {string} newPassword - Nova senha em texto plano
   * @returns {Promise<boolean>} true se senha já foi usada antes
   */
  async isPasswordInHistory(userId, newPassword) {
    await this.init();

    // Buscar últimas N senhas do histórico
    const result = await this.pool.query(
      `SELECT password_hash
       FROM password_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, this.config.historyCount]
    );

    // Comparar com cada hash do histórico
    for (const row of result.rows) {
      const isMatch = await bcrypt.compare(newPassword, row.password_hash);
      if (isMatch) {
        return true; // Senha já foi usada
      }
    }

    return false; // Senha não está no histórico
  }

  /**
   * Adiciona senha ao histórico
   *
   * @param {string} userId - UUID do usuário
   * @param {string} passwordHash - Hash bcrypt da senha
   * @returns {Promise<void>}
   */
  async addToPasswordHistory(userId, passwordHash) {
    await this.init();

    // Adicionar novo hash
    await this.pool.query(
      `INSERT INTO password_history (user_id, password_hash, created_at)
       VALUES ($1, $2, NOW())`,
      [userId, passwordHash]
    );

    // Limpar histórico antigo (manter apenas últimas N)
    await this.pool.query(
      `DELETE FROM password_history
       WHERE user_id = $1
       AND id NOT IN (
         SELECT id
         FROM password_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [userId, this.config.historyCount]
    );

    console.log(`🔐 [PASSWORD] Histórico atualizado para user ${userId.substring(0, 8)}`);
  }

  /**
   * Verifica se senha do usuário expirou
   *
   * @param {Object} user - Objeto do usuário (deve ter password_expires_at)
   * @returns {boolean} true se senha expirou
   */
  isPasswordExpired(user) {
    if (!user.password_expires_at) {
      return false; // Sem data de expiração
    }

    const now = new Date();
    const expiresAt = new Date(user.password_expires_at);

    return expiresAt < now;
  }

  /**
   * Calcula data de expiração da senha
   *
   * @param {Date} passwordChangedAt - Data da última troca
   * @returns {Date} Data de expiração
   */
  calculatePasswordExpiry(passwordChangedAt = new Date()) {
    const expiryDate = new Date(passwordChangedAt);
    expiryDate.setDate(expiryDate.getDate() + this.config.expiryDays);
    return expiryDate;
  }

  /**
   * Hash de senha com bcrypt
   *
   * @param {string} password - Senha em texto plano
   * @returns {Promise<string>} Hash bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Compara senha com hash
   *
   * @param {string} password - Senha em texto plano
   * @param {string} hash - Hash bcrypt
   * @returns {Promise<boolean>} true se senha é válida
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Atualiza senha do usuário (completo)
   * - Valida complexidade
   * - Verifica histórico
   * - Hash nova senha
   * - Atualiza users table
   * - Adiciona ao histórico
   *
   * @param {string} userId - UUID do usuário
   * @param {string} newPassword - Nova senha em texto plano
   * @param {Object} options - Opções adicionais
   * @param {boolean} options.forceChange - Forçar troca no próximo login
   * @returns {Promise<Object>} { success: boolean, error: string }
   */
  async updatePassword(userId, newPassword, options = {}) {
    await this.init();

    const { forceChange = false } = options;

    // 1. Validar complexidade
    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors[0] // Retornar primeiro erro
      };
    }

    // 2. Verificar histórico
    const inHistory = await this.isPasswordInHistory(userId, newPassword);
    if (inHistory) {
      return {
        success: false,
        error: `Senha já foi usada recentemente. Escolha uma senha diferente das últimas ${this.config.historyCount}`
      };
    }

    // 3. Hash nova senha
    const passwordHash = await this.hashPassword(newPassword);

    // 4. Calcular expiração
    const passwordChangedAt = new Date();
    const passwordExpiresAt = this.calculatePasswordExpiry(passwordChangedAt);

    // 5. Atualizar users table
    await this.pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           force_password_change = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [passwordHash, passwordChangedAt, passwordExpiresAt, forceChange, userId]
    );

    // 6. Adicionar ao histórico
    await this.addToPasswordHistory(userId, passwordHash);

    console.log(`✅ [PASSWORD] Senha atualizada para user ${userId.substring(0, 8)}`);

    return {
      success: true,
      expiresAt: passwordExpiresAt
    };
  }

  /**
   * Gera senha aleatória forte
   *
   * @param {number} length - Comprimento (padrão: 16)
   * @returns {string} Senha gerada
   */
  generateStrongPassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';

    // Garantir pelo menos um de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Preencher restante
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Embaralhar
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Verifica dias até expiração
   *
   * @param {Object} user - Objeto do usuário
   * @returns {number|null} Dias até expirar (null se não expira)
   */
  getDaysUntilExpiry(user) {
    if (!user.password_expires_at) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(user.password_expires_at);
    const diffMs = expiresAt - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Reseta contadores de falha de login
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
  }

  /**
   * Configurações atuais
   */
  getConfig() {
    return {
      ...this.config,
      passwordStrengthRules: {
        minLength: this.config.minLength,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSymbol: true,
        noCommonPasswords: true,
        noSequentialChars: true,
        noExcessiveRepetition: true
      }
    };
  }
}

// Singleton
const passwordPolicyService = new PasswordPolicyService();

export default passwordPolicyService;
