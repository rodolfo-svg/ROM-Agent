/**
 * Sistema de Autenticação e Permissões - ROM Agent
 *
 * Implementa:
 * - Autenticação JWT
 * - Permissões granulares (master_admin, partner_admin, user)
 * - Controle de acesso por recurso
 * - Sessões e tokens
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

class AuthSystem {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'rom-secret-key-CHANGE-IN-PRODUCTION';
    this.JWT_EXPIRATION = '7d'; // Token válido por 7 dias
    this.REFRESH_TOKEN_EXPIRATION = '30d'; // Refresh token válido por 30 dias

    this.usersPath = path.join(__dirname, '../data/users.json');
    this.sessionsPath = path.join(__dirname, '../data/sessions.json');

    this.ensureDataFiles();
  }

  ensureDataFiles() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Criar arquivo de usuários se não existir
    if (!fs.existsSync(this.usersPath)) {
      const defaultUsers = [
        {
          id: 'user-001',
          name: 'Rodolfo Otávio Mota',
          email: 'rodolfo@rom.adv.br',
          // Password: admin123 (hashed)
          passwordHash: bcrypt.hashSync('admin123', 10),
          role: 'master_admin',
          partnerId: 'rom',
          createdAt: new Date().toISOString(),
          active: true
        }
      ];
      fs.writeFileSync(this.usersPath, JSON.stringify(defaultUsers, null, 2));
    }

    // Criar arquivo de sessões se não existir
    if (!fs.existsSync(this.sessionsPath)) {
      fs.writeFileSync(this.sessionsPath, JSON.stringify([], null, 2));
    }
  }

  /**
   * Registrar novo usuário
   * @param {Object} userData - Dados do usuário
   * @returns {Object} Usuário criado (sem senha)
   */
  registerUser(userData) {
    const users = JSON.parse(fs.readFileSync(this.usersPath, 'utf8'));

    // Verificar se email já existe
    if (users.find(u => u.email === userData.email)) {
      throw new Error('Email já cadastrado');
    }

    // Validar role
    const validRoles = ['master_admin', 'partner_admin', 'user'];
    if (!validRoles.includes(userData.role)) {
      throw new Error('Role inválida');
    }

    // Apenas master_admin pode criar outros master_admins
    if (userData.role === 'master_admin') {
      throw new Error('Apenas master_admin pode criar outros master_admins');
    }

    // Hash da senha
    const passwordHash = bcrypt.hashSync(userData.password, 10);

    const newUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: userData.name,
      email: userData.email,
      passwordHash,
      role: userData.role,
      partnerId: userData.partnerId || 'rom',
      createdAt: new Date().toISOString(),
      active: true,
      permissions: this.getDefaultPermissions(userData.role),
      metadata: userData.metadata || {}
    };

    users.push(newUser);
    fs.writeFileSync(this.usersPath, JSON.stringify(users, null, 2));

    // Retornar sem senha
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Login
   * @param {string} email
   * @param {string} password
   * @returns {Object} { user, accessToken, refreshToken }
   */
  async login(email, password) {
    const users = JSON.parse(fs.readFileSync(this.usersPath, 'utf8'));
    const user = users.find(u => u.email === email && u.active);

    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new Error('Credenciais inválidas');
    }

    // Gerar tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Salvar sessão
    this.createSession(user.id, accessToken, refreshToken);

    // Retornar sem senha
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  }

  /**
   * Logout
   * @param {string} token - Access token
   */
  logout(token) {
    const sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8'));
    const updatedSessions = sessions.filter(s => s.accessToken !== token);
    fs.writeFileSync(this.sessionsPath, JSON.stringify(updatedSessions, null, 2));
  }

  /**
   * Verificar token
   * @param {string} token
   * @returns {Object} Payload decodificado
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido ou expirado');
    }
  }

  /**
   * Gerar access token
   * @param {Object} user
   * @returns {string} JWT token
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        partnerId: user.partnerId,
        permissions: user.permissions
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRATION }
    );
  }

  /**
   * Gerar refresh token
   * @param {Object} user
   * @returns {string} JWT token
   */
  generateRefreshToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      this.JWT_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRATION }
    );
  }

  /**
   * Refresh access token
   * @param {string} refreshToken
   * @returns {Object} { accessToken, refreshToken }
   */
  refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET);

      if (decoded.type !== 'refresh') {
        throw new Error('Token inválido');
      }

      const users = JSON.parse(fs.readFileSync(this.usersPath, 'utf8'));
      const user = users.find(u => u.id === decoded.userId && u.active);

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Gerar novos tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Atualizar sessão
      this.updateSession(decoded.userId, newAccessToken, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new Error('Refresh token inválido ou expirado');
    }
  }

  /**
   * Criar sessão
   * @param {string} userId
   * @param {string} accessToken
   * @param {string} refreshToken
   */
  createSession(userId, accessToken, refreshToken) {
    const sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8'));

    sessions.push({
      userId,
      accessToken,
      refreshToken,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      userAgent: null // TODO: Pegar do request
    });

    fs.writeFileSync(this.sessionsPath, JSON.stringify(sessions, null, 2));
  }

  /**
   * Atualizar sessão
   * @param {string} userId
   * @param {string} newAccessToken
   * @param {string} newRefreshToken
   */
  updateSession(userId, newAccessToken, newRefreshToken) {
    const sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8'));

    const sessionIndex = sessions.findIndex(s => s.userId === userId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].accessToken = newAccessToken;
      sessions[sessionIndex].refreshToken = newRefreshToken;
      sessions[sessionIndex].lastActivity = new Date().toISOString();
    }

    fs.writeFileSync(this.sessionsPath, JSON.stringify(sessions, null, 2));
  }

  /**
   * Obter permissões padrão por role
   * @param {string} role
   * @returns {Object} Permissões
   */
  getDefaultPermissions(role) {
    const permissions = {
      master_admin: {
        prompts: {
          viewGlobal: true,
          editGlobal: true,
          viewPartner: true,
          editPartner: true,
          delete: true,
          approve: true
        },
        partners: {
          view: true,
          create: true,
          edit: true,
          delete: true
        },
        users: {
          view: true,
          create: true,
          edit: true,
          delete: true
        },
        dashboard: {
          viewAll: true,
          viewFinancial: true,
          viewAnalytics: true,
          viewLogs: true,
          exportData: true
        },
        system: {
          manageSettings: true,
          manageIntegrations: true,
          manageApiKeys: true
        }
      },
      partner_admin: {
        prompts: {
          viewGlobal: true,
          editGlobal: false,
          viewPartner: true,
          editPartner: true,
          delete: false,
          approve: false
        },
        partners: {
          view: false, // Só vê seu próprio parceiro
          create: false,
          edit: true, // Só edita seu próprio parceiro
          delete: false
        },
        users: {
          view: true, // Só vê usuários do seu parceiro
          create: true, // Só cria usuários do seu parceiro
          edit: true,
          delete: true
        },
        dashboard: {
          viewAll: false, // Só vê dashboard do seu parceiro
          viewFinancial: true, // Só financeiro do seu parceiro
          viewAnalytics: true,
          viewLogs: true,
          exportData: true
        },
        system: {
          manageSettings: false,
          manageIntegrations: false,
          manageApiKeys: false
        }
      },
      user: {
        prompts: {
          viewGlobal: true,
          editGlobal: false,
          viewPartner: true,
          editPartner: false,
          delete: false,
          approve: false
        },
        partners: {
          view: false,
          create: false,
          edit: false,
          delete: false
        },
        users: {
          view: false,
          create: false,
          edit: false, // Só edita o próprio perfil
          delete: false
        },
        dashboard: {
          viewAll: false,
          viewFinancial: false,
          viewAnalytics: false,
          viewLogs: false,
          exportData: false
        },
        system: {
          manageSettings: false,
          manageIntegrations: false,
          manageApiKeys: false
        }
      }
    };

    return permissions[role] || permissions.user;
  }

  /**
   * Verificar permissão
   * @param {Object} user - Usuário (do token)
   * @param {string} resource - Recurso (ex: 'prompts')
   * @param {string} action - Ação (ex: 'editGlobal')
   * @returns {boolean}
   */
  checkPermission(user, resource, action) {
    if (!user || !user.permissions) return false;

    const resourcePermissions = user.permissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions[action] === true;
  }

  /**
   * Middleware Express para autenticação
   * @returns {Function} Middleware
   */
  authMiddleware() {
    return (req, res, next) => {
      try {
        // Pegar token do header Authorization: Bearer <token>
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Token não fornecido' });
        }

        const token = authHeader.substring(7);
        const decoded = this.verifyToken(token);

        // Adicionar usuário ao request
        req.user = decoded;

        next();
      } catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
      }
    };
  }

  /**
   * Middleware para verificar permissão específica
   * @param {string} resource
   * @param {string} action
   * @returns {Function} Middleware
   */
  requirePermission(resource, action) {
    return (req, res, next) => {
      if (!this.checkPermission(req.user, resource, action)) {
        return res.status(403).json({
          error: 'Permissão negada',
          required: `${resource}.${action}`
        });
      }
      next();
    };
  }

  /**
   * Middleware para verificar role mínima
   * @param {string} minRole - 'master_admin', 'partner_admin', 'user'
   * @returns {Function} Middleware
   */
  requireRole(minRole) {
    const roleHierarchy = {
      master_admin: 3,
      partner_admin: 2,
      user: 1
    };

    return (req, res, next) => {
      const userRoleLevel = roleHierarchy[req.user.role] || 0;
      const requiredLevel = roleHierarchy[minRole] || 999;

      if (userRoleLevel < requiredLevel) {
        return res.status(403).json({
          error: 'Permissão negada',
          required: `role: ${minRole}`,
          current: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Middleware para verificar se é do mesmo parceiro (partner scoping)
   * @returns {Function} Middleware
   */
  requireSamePartner() {
    return (req, res, next) => {
      // master_admin pode acessar qualquer parceiro
      if (req.user.role === 'master_admin') {
        return next();
      }

      const targetPartnerId = req.params.partnerId || req.body.partnerId || req.query.partnerId;

      if (targetPartnerId && targetPartnerId !== req.user.partnerId) {
        return res.status(403).json({
          error: 'Acesso negado',
          message: 'Você só pode acessar recursos do seu próprio escritório'
        });
      }

      next();
    };
  }

  /**
   * Listar sessões ativas de um usuário
   * @param {string} userId
   * @returns {Array} Sessões
   */
  listUserSessions(userId) {
    const sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8'));
    return sessions.filter(s => s.userId === userId);
  }

  /**
   * Revogar todas as sessões de um usuário
   * @param {string} userId
   */
  revokeAllUserSessions(userId) {
    const sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8'));
    const updatedSessions = sessions.filter(s => s.userId !== userId);
    fs.writeFileSync(this.sessionsPath, JSON.stringify(updatedSessions, null, 2));
  }
}

module.exports = AuthSystem;
