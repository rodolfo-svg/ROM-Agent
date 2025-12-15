/**
 * Sistema de Gerenciamento de Usuários da Equipe ROM
 * Permite cadastro, edição e gerenciamento de usuários internos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DATA_FILE = path.join(__dirname, '../data/users.json');
const USERS_DIR = path.dirname(USERS_DATA_FILE);

// Criar diretório se não existir
if (!fs.existsSync(USERS_DIR)) {
  fs.mkdirSync(USERS_DIR, { recursive: true });
}

// Roles disponíveis
const ROLES = {
  ADMIN: 'admin',           // Acesso total
  DEVELOPER: 'developer',   // Acesso técnico + admin
  MANAGER: 'manager',       // Gestão de projetos e usuários
  OPERATOR: 'operator',     // Operação do sistema
  VIEWER: 'viewer'          // Apenas visualização
};

/**
 * Classe para gerenciar usuários da equipe ROM
 */
class UsersManager {
  constructor() {
    this.users = this.loadUsers();
  }

  /**
   * Carregar usuários do arquivo JSON
   */
  loadUsers() {
    try {
      if (fs.existsSync(USERS_DATA_FILE)) {
        const data = fs.readFileSync(USERS_DATA_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }

    // Se não existir, criar com usuário admin padrão
    const defaultUsers = {
      users: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      }
    };

    this.saveUsers(defaultUsers);
    return defaultUsers;
  }

  /**
   * Salvar usuários no arquivo JSON
   */
  saveUsers(data = null) {
    try {
      const dataToSave = data || this.users;
      dataToSave.metadata = {
        ...dataToSave.metadata,
        lastUpdate: new Date().toISOString()
      };
      fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Erro ao salvar usuários:', error);
      return false;
    }
  }

  /**
   * Hash de senha
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Verificar senha
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Gerar ID único
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Criar novo usuário
   */
  async createUser(userData) {
    try {
      // Validar dados obrigatórios
      if (!userData.name || !userData.email || !userData.password) {
        throw new Error('Nome, email e senha são obrigatórios');
      }

      // Verificar se email já existe
      const existingUser = this.users.users.find(u => u.email === userData.email);
      if (existingUser) {
        throw new Error('Email já cadastrado');
      }

      // Hash da senha
      const hashedPassword = await this.hashPassword(userData.password);

      // Criar usuário
      const newUser = {
        id: this.generateUserId(),
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role || ROLES.OPERATOR,
        department: userData.department || 'Geral',
        phone: userData.phone || '',
        oab: userData.oab || '',
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: userData.createdBy || 'system',
        lastLogin: null,
        permissions: this.getDefaultPermissions(userData.role || ROLES.OPERATOR)
      };

      this.users.users.push(newUser);
      this.saveUsers();

      // Retornar usuário sem senha
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obter permissões padrão por role
   */
  getDefaultPermissions(role) {
    const permissions = {
      [ROLES.ADMIN]: {
        users: { read: true, create: true, update: true, delete: true },
        partners: { read: true, create: true, update: true, delete: true },
        projects: { read: true, create: true, update: true, delete: true },
        kb: { read: true, create: true, update: true, delete: true },
        settings: { read: true, create: true, update: true, delete: true },
        deploy: { read: true, execute: true }
      },
      [ROLES.DEVELOPER]: {
        users: { read: true, create: true, update: true, delete: false },
        partners: { read: true, create: true, update: true, delete: true },
        projects: { read: true, create: true, update: true, delete: true },
        kb: { read: true, create: true, update: true, delete: true },
        settings: { read: true, create: true, update: true, delete: false },
        deploy: { read: true, execute: true }
      },
      [ROLES.MANAGER]: {
        users: { read: true, create: true, update: true, delete: false },
        partners: { read: true, create: true, update: true, delete: false },
        projects: { read: true, create: true, update: true, delete: false },
        kb: { read: true, create: true, update: true, delete: false },
        settings: { read: true, create: false, update: false, delete: false },
        deploy: { read: true, execute: false }
      },
      [ROLES.OPERATOR]: {
        users: { read: true, create: false, update: false, delete: false },
        partners: { read: true, create: false, update: false, delete: false },
        projects: { read: true, create: true, update: true, delete: false },
        kb: { read: true, create: true, update: true, delete: false },
        settings: { read: true, create: false, update: false, delete: false },
        deploy: { read: false, execute: false }
      },
      [ROLES.VIEWER]: {
        users: { read: false, create: false, update: false, delete: false },
        partners: { read: true, create: false, update: false, delete: false },
        projects: { read: true, create: false, update: false, delete: false },
        kb: { read: true, create: false, update: false, delete: false },
        settings: { read: false, create: false, update: false, delete: false },
        deploy: { read: false, execute: false }
      }
    };

    return permissions[role] || permissions[ROLES.VIEWER];
  }

  /**
   * Listar todos os usuários (sem senhas)
   */
  listUsers(includeInactive = false) {
    let users = this.users.users;

    if (!includeInactive) {
      users = users.filter(u => u.active);
    }

    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * Obter usuário por ID (sem senha)
   */
  getUserById(userId) {
    const user = this.users.users.find(u => u.id === userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Obter usuário por email (com senha - para autenticação)
   */
  getUserByEmail(email) {
    return this.users.users.find(u => u.email === email);
  }

  /**
   * Atualizar usuário
   */
  async updateUser(userId, updates) {
    const userIndex = this.users.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('Usuário não encontrado');
    }

    // Não permitir atualização de campos sensíveis diretamente
    const { password, id, createdAt, createdBy, ...safeUpdates } = updates;

    // Se houver nova senha, fazer hash
    if (updates.password) {
      safeUpdates.password = await this.hashPassword(updates.password);
    }

    this.users.users[userIndex] = {
      ...this.users.users[userIndex],
      ...safeUpdates,
      updatedAt: new Date().toISOString()
    };

    this.saveUsers();

    const { password: _, ...userWithoutPassword } = this.users.users[userIndex];
    return userWithoutPassword;
  }

  /**
   * Desativar usuário (soft delete)
   */
  deactivateUser(userId) {
    const userIndex = this.users.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('Usuário não encontrado');
    }

    this.users.users[userIndex].active = false;
    this.users.users[userIndex].deactivatedAt = new Date().toISOString();

    this.saveUsers();
    return true;
  }

  /**
   * Reativar usuário
   */
  reactivateUser(userId) {
    const userIndex = this.users.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('Usuário não encontrado');
    }

    this.users.users[userIndex].active = true;
    delete this.users.users[userIndex].deactivatedAt;

    this.saveUsers();
    return true;
  }

  /**
   * Deletar usuário permanentemente (hard delete)
   */
  deleteUser(userId) {
    const userIndex = this.users.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      throw new Error('Usuário não encontrado');
    }

    this.users.users.splice(userIndex, 1);
    this.saveUsers();
    return true;
  }

  /**
   * Atualizar último login
   */
  updateLastLogin(userId) {
    const userIndex = this.users.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.users.users[userIndex].lastLogin = new Date().toISOString();
      this.saveUsers();
    }
  }

  /**
   * Verificar permissão
   */
  hasPermission(userId, resource, action) {
    const user = this.users.users.find(u => u.id === userId);
    if (!user || !user.active) {
      return false;
    }

    return user.permissions?.[resource]?.[action] === true;
  }

  /**
   * Estatísticas de usuários
   */
  getStatistics() {
    const users = this.users.users;

    return {
      total: users.length,
      active: users.filter(u => u.active).length,
      inactive: users.filter(u => !u.active).length,
      byRole: {
        admin: users.filter(u => u.role === ROLES.ADMIN).length,
        developer: users.filter(u => u.role === ROLES.DEVELOPER).length,
        manager: users.filter(u => u.role === ROLES.MANAGER).length,
        operator: users.filter(u => u.role === ROLES.OPERATOR).length,
        viewer: users.filter(u => u.role === ROLES.VIEWER).length
      },
      recentLogins: users
        .filter(u => u.lastLogin)
        .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          name: u.name,
          lastLogin: u.lastLogin
        }))
    };
  }
}

// Exportar instância única e constantes
const usersManager = new UsersManager();
export default usersManager;
export { ROLES };
