/**
 * Testes Unitários - Autenticação e Sessões
 *
 * Testa funcionalidades de autenticação, login, registro e sessões
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';

// ============================================================
// TESTES DE HASH DE SENHA
// ============================================================

describe('Auth - Password Hashing', () => {
  it('deve fazer hash de senha corretamente', async () => {
    const password = 'SenhaSegura123!';
    const hash = await bcrypt.hash(password, 10);

    assert.ok(hash);
    assert.ok(hash.length > 0);
    assert.notStrictEqual(hash, password);
  });

  it('deve validar senha correta', async () => {
    const password = 'SenhaSegura123!';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare(password, hash);
    assert.strictEqual(isValid, true);
  });

  it('deve rejeitar senha incorreta', async () => {
    const password = 'SenhaSegura123!';
    const wrongPassword = 'SenhaErrada456!';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare(wrongPassword, hash);
    assert.strictEqual(isValid, false);
  });

  it('hashes diferentes devem ser gerados para mesma senha', async () => {
    const password = 'SenhaSegura123!';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    assert.notStrictEqual(hash1, hash2);

    // Mas ambos devem validar
    assert.strictEqual(await bcrypt.compare(password, hash1), true);
    assert.strictEqual(await bcrypt.compare(password, hash2), true);
  });
});

// ============================================================
// TESTES DE VALIDAÇÃO DE DADOS
// ============================================================

describe('Auth - Data Validation', () => {
  it('deve validar email válido', () => {
    const validEmails = [
      'user@example.com',
      'test.user@domain.co.uk',
      'name+tag@company.org'
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    validEmails.forEach(email => {
      assert.ok(emailRegex.test(email), `Email inválido: ${email}`);
    });
  });

  it('deve rejeitar email inválido', () => {
    const invalidEmails = [
      'invalid',
      '@example.com',
      'user@',
      'user @example.com',
      'user@example'
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    invalidEmails.forEach(email => {
      assert.ok(!emailRegex.test(email), `Email deveria ser inválido: ${email}`);
    });
  });

  it('deve validar senha forte', () => {
    const strongPasswords = [
      'Senha123!',
      'MyP@ssw0rd',
      'Secure#2024'
    ];

    // Critérios: mínimo 8 caracteres, maiúscula, minúscula, número, especial
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

    strongPasswords.forEach(password => {
      assert.ok(passwordRegex.test(password), `Senha deveria ser forte: ${password}`);
    });
  });

  it('deve rejeitar senha fraca', () => {
    const weakPasswords = [
      'senha',
      '12345678',
      'password',
      'abc123'
    ];

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    weakPasswords.forEach(password => {
      assert.ok(!passwordRegex.test(password), `Senha deveria ser fraca: ${password}`);
    });
  });
});

// ============================================================
// TESTES DE SANITIZAÇÃO
// ============================================================

describe('Auth - Input Sanitization', () => {
  function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
      .trim()
      .replace(/<[^>]*>/g, '')  // Remove HTML tags
      .replace(/[<>'"]/g, '');   // Remove caracteres perigosos
  }

  it('deve remover tags HTML', () => {
    const input = '<b>nome</b>';
    const sanitized = sanitizeInput(input);

    assert.strictEqual(sanitized, 'nome');
    assert.ok(!sanitized.includes('<'));
    assert.ok(!sanitized.includes('>'));
  });

  it('deve remover aspas perigosas', () => {
    const input = 'nome"; DROP TABLE users; --';
    const sanitized = sanitizeInput(input);

    assert.ok(!sanitized.includes('"'));
    assert.ok(!sanitized.includes("'"));
  });

  it('deve fazer trim de espaços', () => {
    const input = '  nome  ';
    const sanitized = sanitizeInput(input);

    assert.strictEqual(sanitized, 'nome');
  });

  it('deve lidar com input não-string', () => {
    assert.strictEqual(sanitizeInput(null), '');
    assert.strictEqual(sanitizeInput(undefined), '');
    assert.strictEqual(sanitizeInput(123), '');
    assert.strictEqual(sanitizeInput({}), '');
  });
});

// ============================================================
// TESTES DE GERAÇÃO DE TOKENS
// ============================================================

describe('Auth - Token Generation', () => {
  function generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  it('deve gerar token com tamanho correto', () => {
    const token = generateToken(32);
    assert.strictEqual(token.length, 32);
  });

  it('deve gerar tokens diferentes', () => {
    const token1 = generateToken();
    const token2 = generateToken();

    assert.notStrictEqual(token1, token2);
  });

  it('deve conter apenas caracteres válidos', () => {
    const token = generateToken(100);
    const validChars = /^[A-Za-z0-9]+$/;

    assert.ok(validChars.test(token));
  });

  it('deve aceitar tamanho customizado', () => {
    const sizes = [16, 32, 64, 128];

    sizes.forEach(size => {
      const token = generateToken(size);
      assert.strictEqual(token.length, size);
    });
  });
});

// ============================================================
// TESTES DE SESSÃO
// ============================================================

describe('Auth - Session Management', () => {
  class Session {
    constructor() {
      this.sessions = new Map();
    }

    create(userId, data = {}) {
      const sessionId = Math.random().toString(36).substring(7);
      const session = {
        userId,
        ...data,
        createdAt: new Date(),
        lastAccess: new Date()
      };
      this.sessions.set(sessionId, session);
      return sessionId;
    }

    get(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastAccess = new Date();
      }
      return session;
    }

    destroy(sessionId) {
      return this.sessions.delete(sessionId);
    }

    cleanup(maxAge = 24 * 60 * 60 * 1000) {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastAccess.getTime() > maxAge) {
          this.sessions.delete(id);
          cleaned++;
        }
      }

      return cleaned;
    }
  }

  it('deve criar sessão', () => {
    const sessionManager = new Session();
    const sessionId = sessionManager.create('user123');

    assert.ok(sessionId);
    assert.ok(sessionId.length > 0);
  });

  it('deve recuperar sessão', () => {
    const sessionManager = new Session();
    const sessionId = sessionManager.create('user123', { role: 'admin' });

    const session = sessionManager.get(sessionId);

    assert.ok(session);
    assert.strictEqual(session.userId, 'user123');
    assert.strictEqual(session.role, 'admin');
  });

  it('deve destruir sessão', () => {
    const sessionManager = new Session();
    const sessionId = sessionManager.create('user123');

    assert.ok(sessionManager.get(sessionId));

    const destroyed = sessionManager.destroy(sessionId);
    assert.strictEqual(destroyed, true);

    assert.strictEqual(sessionManager.get(sessionId), undefined);
  });

  it('deve atualizar lastAccess ao recuperar', () => {
    const sessionManager = new Session();
    const sessionId = sessionManager.create('user123');

    const session1 = sessionManager.get(sessionId);
    const time1 = session1.lastAccess.getTime();

    // Pequeno delay
    const delay = () => new Promise(resolve => setTimeout(resolve, 10));
    return delay().then(() => {
      const session2 = sessionManager.get(sessionId);
      const time2 = session2.lastAccess.getTime();

      assert.ok(time2 >= time1);
    });
  });

  it('deve limpar sessões expiradas', () => {
    const sessionManager = new Session();

    // Cria sessões
    sessionManager.create('user1');
    sessionManager.create('user2');
    sessionManager.create('user3');

    // Expira sessões manualmente
    for (const [id, session] of sessionManager.sessions.entries()) {
      session.lastAccess = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 horas atrás
    }

    const cleaned = sessionManager.cleanup(24 * 60 * 60 * 1000); // 24 horas

    assert.strictEqual(cleaned, 3);
    assert.strictEqual(sessionManager.sessions.size, 0);
  });
});

// ============================================================
// TESTES DE ROLES E PERMISSÕES
// ============================================================

describe('Auth - Roles and Permissions', () => {
  const PERMISSIONS = {
    admin: ['read', 'write', 'delete', 'manage_users'],
    editor: ['read', 'write'],
    viewer: ['read']
  };

  function hasPermission(role, permission) {
    const rolePermissions = PERMISSIONS[role] || [];
    return rolePermissions.includes(permission);
  }

  it('admin deve ter todas as permissões', () => {
    assert.ok(hasPermission('admin', 'read'));
    assert.ok(hasPermission('admin', 'write'));
    assert.ok(hasPermission('admin', 'delete'));
    assert.ok(hasPermission('admin', 'manage_users'));
  });

  it('editor deve ter permissões limitadas', () => {
    assert.ok(hasPermission('editor', 'read'));
    assert.ok(hasPermission('editor', 'write'));
    assert.ok(!hasPermission('editor', 'delete'));
    assert.ok(!hasPermission('editor', 'manage_users'));
  });

  it('viewer deve ter apenas leitura', () => {
    assert.ok(hasPermission('viewer', 'read'));
    assert.ok(!hasPermission('viewer', 'write'));
    assert.ok(!hasPermission('viewer', 'delete'));
  });

  it('role inválido não deve ter permissões', () => {
    assert.ok(!hasPermission('invalid_role', 'read'));
    assert.ok(!hasPermission('invalid_role', 'write'));
  });
});

console.log('✅ Testes de autenticação carregados com sucesso');
