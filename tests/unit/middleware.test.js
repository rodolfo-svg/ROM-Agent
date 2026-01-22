/**
 * Testes Unitários - Middlewares
 *
 * Testa funcionalidades de middlewares de segurança,
 * autenticação, CSRF, rate limiting e validação
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// ============================================================
// TESTES DE CSRF PROTECTION
// ============================================================

describe('Middleware - CSRF Protection', () => {
  class CSRFMiddleware {
    constructor(secret = 'test-secret') {
      this.secret = secret;
      this.tokens = new Map(); // sessionId -> token
    }

    generateToken(sessionId) {
      const token = crypto
        .createHmac('sha256', this.secret)
        .update(`${sessionId}-${Date.now()}`)
        .digest('hex');

      this.tokens.set(sessionId, token);
      return token;
    }

    validateToken(sessionId, token) {
      if (!token) {
        return { valid: false, reason: 'Token missing' };
      }

      const expectedToken = this.tokens.get(sessionId);

      if (!expectedToken) {
        return { valid: false, reason: 'No token for session' };
      }

      if (token !== expectedToken) {
        return { valid: false, reason: 'Token mismatch' };
      }

      return { valid: true };
    }

    middleware(req, res, next) {
      const sessionId = req.session?.id;
      const csrfToken = req.headers['x-csrf-token'] || req.body?._csrf;

      // Métodos seguros não precisam de token
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const validation = this.validateToken(sessionId, csrfToken);

      if (!validation.valid) {
        res.status(403).json({
          error: 'CSRF token validation failed',
          reason: validation.reason
        });
        return;
      }

      next();
    }
  }

  it('deve gerar token CSRF', () => {
    const csrf = new CSRFMiddleware();
    const token = csrf.generateToken('session-123');

    assert.ok(token);
    assert.strictEqual(typeof token, 'string');
    assert.ok(token.length > 32);
  });

  it('deve validar token correto', () => {
    const csrf = new CSRFMiddleware();
    const token = csrf.generateToken('session-123');

    const result = csrf.validateToken('session-123', token);

    assert.strictEqual(result.valid, true);
  });

  it('deve rejeitar token inválido', () => {
    const csrf = new CSRFMiddleware();
    csrf.generateToken('session-123');

    const result = csrf.validateToken('session-123', 'wrong-token');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'Token mismatch');
  });

  it('deve rejeitar token ausente', () => {
    const csrf = new CSRFMiddleware();
    csrf.generateToken('session-123');

    const result = csrf.validateToken('session-123', null);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'Token missing');
  });

  it('deve rejeitar token para sessão inexistente', () => {
    const csrf = new CSRFMiddleware();

    const result = csrf.validateToken('nonexistent', 'some-token');

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'No token for session');
  });

  it('deve permitir métodos seguros sem token', () => {
    const csrf = new CSRFMiddleware();
    let nextCalled = false;

    const req = { method: 'GET', session: { id: 'sess-1' }, headers: {}, body: {} };
    const res = {};
    const next = () => { nextCalled = true; };

    csrf.middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('deve bloquear POST sem token', () => {
    const csrf = new CSRFMiddleware();
    let statusCode = null;
    let responseData = null;

    const req = {
      method: 'POST',
      session: { id: 'sess-1' },
      headers: {},
      body: {}
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };

    const next = () => {};

    csrf.middleware(req, res, next);

    assert.strictEqual(statusCode, 403);
    assert.ok(responseData.error.includes('CSRF'));
  });
});

// ============================================================
// TESTES DE AUTHENTICATION MIDDLEWARE
// ============================================================

describe('Middleware - Authentication', () => {
  class AuthMiddleware {
    constructor() {
      this.sessions = new Map(); // sessionId -> userId
    }

    login(sessionId, userId) {
      this.sessions.set(sessionId, userId);
    }

    logout(sessionId) {
      this.sessions.delete(sessionId);
    }

    isAuthenticated(sessionId) {
      return this.sessions.has(sessionId);
    }

    requireAuth(req, res, next) {
      const sessionId = req.session?.id;

      if (!sessionId) {
        res.status(401).json({ error: 'No session' });
        return;
      }

      if (!this.isAuthenticated(sessionId)) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      req.userId = this.sessions.get(sessionId);
      next();
    }

    requireRole(role) {
      return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }
        next();
      };
    }
  }

  it('deve registrar login de usuário', () => {
    const auth = new AuthMiddleware();

    auth.login('sess-1', 'user-123');

    assert.strictEqual(auth.isAuthenticated('sess-1'), true);
  });

  it('deve registrar logout de usuário', () => {
    const auth = new AuthMiddleware();

    auth.login('sess-1', 'user-123');
    auth.logout('sess-1');

    assert.strictEqual(auth.isAuthenticated('sess-1'), false);
  });

  it('deve bloquear acesso não autenticado', () => {
    const auth = new AuthMiddleware();
    let statusCode = null;

    const req = { session: { id: 'sess-1' } };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: () => {}
    };

    auth.requireAuth(req, res, () => {});

    assert.strictEqual(statusCode, 401);
  });

  it('deve permitir acesso autenticado', () => {
    const auth = new AuthMiddleware();
    let nextCalled = false;

    auth.login('sess-1', 'user-123');

    const req = { session: { id: 'sess-1' } };
    const res = {};
    const next = () => { nextCalled = true; };

    auth.requireAuth(req, res, next);

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.userId, 'user-123');
  });

  it('deve bloquear acesso sem role adequado', () => {
    const auth = new AuthMiddleware();
    let statusCode = null;

    const req = { user: { role: 'user' } };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: () => {}
    };

    const requireAdmin = auth.requireRole('admin');
    requireAdmin(req, res, () => {});

    assert.strictEqual(statusCode, 403);
  });

  it('deve permitir acesso com role adequado', () => {
    const auth = new AuthMiddleware();
    let nextCalled = false;

    const req = { user: { role: 'admin' } };
    const res = {};
    const next = () => { nextCalled = true; };

    const requireAdmin = auth.requireRole('admin');
    requireAdmin(req, res, next);

    assert.strictEqual(nextCalled, true);
  });
});

// ============================================================
// TESTES DE RATE LIMITING MIDDLEWARE
// ============================================================

describe('Middleware - Rate Limiting', () => {
  class RateLimitMiddleware {
    constructor(maxRequests = 100, windowMs = 60000) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
      this.requests = new Map(); // IP -> timestamps[]
    }

    middleware(req, res, next) {
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      const now = Date.now();

      // Obter requests do IP
      let ipRequests = this.requests.get(ip) || [];

      // Limpar requests antigas
      ipRequests = ipRequests.filter(timestamp =>
        now - timestamp < this.windowMs
      );

      // Verificar limite
      if (ipRequests.length >= this.maxRequests) {
        const oldestRequest = ipRequests[0];
        const retryAfter = Math.ceil((this.windowMs - (now - oldestRequest)) / 1000);

        res.status(429).json({
          error: 'Too many requests',
          retryAfter
        });
        return;
      }

      // Adicionar request atual
      ipRequests.push(now);
      this.requests.set(ip, ipRequests);

      // Adicionar headers informativos
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', this.maxRequests - ipRequests.length);

      next();
    }

    reset(ip) {
      this.requests.delete(ip);
    }
  }

  it('deve permitir requests dentro do limite', () => {
    const rateLimit = new RateLimitMiddleware(5, 60000);
    let nextCalled = 0;

    const req = { ip: '127.0.0.1' };
    const res = { setHeader: () => {} };
    const next = () => { nextCalled++; };

    // Fazer 5 requests
    for (let i = 0; i < 5; i++) {
      rateLimit.middleware(req, res, next);
    }

    assert.strictEqual(nextCalled, 5);
  });

  it('deve bloquear após exceder limite', () => {
    const rateLimit = new RateLimitMiddleware(3, 60000);
    let statusCode = null;

    const req = { ip: '127.0.0.1' };
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: () => {}
    };

    // Fazer 3 requests (limite)
    for (let i = 0; i < 3; i++) {
      rateLimit.middleware(req, res, () => {});
    }

    // 4ª request deve ser bloqueada
    rateLimit.middleware(req, res, () => {});

    assert.strictEqual(statusCode, 429);
  });

  it('deve adicionar headers de rate limit', () => {
    const rateLimit = new RateLimitMiddleware(10, 60000);
    const headers = {};

    const req = { ip: '127.0.0.1' };
    const res = {
      setHeader: (name, value) => {
        headers[name] = value;
      }
    };

    rateLimit.middleware(req, res, () => {});

    assert.strictEqual(headers['X-RateLimit-Limit'], 10);
    assert.strictEqual(headers['X-RateLimit-Remaining'], 9);
  });

  it('deve isolar limite por IP', () => {
    const rateLimit = new RateLimitMiddleware(2, 60000);
    let nextCalled = 0;

    const req1 = { ip: '127.0.0.1' };
    const req2 = { ip: '192.168.1.1' };
    const res = { setHeader: () => {} };
    const next = () => { nextCalled++; };

    // IP1 faz 2 requests
    rateLimit.middleware(req1, res, next);
    rateLimit.middleware(req1, res, next);

    // IP2 ainda pode fazer requests
    rateLimit.middleware(req2, res, next);
    rateLimit.middleware(req2, res, next);

    assert.strictEqual(nextCalled, 4);
  });

  it('deve resetar limite de IP', () => {
    const rateLimit = new RateLimitMiddleware(1, 60000);
    let nextCalled = 0;

    const req = { ip: '127.0.0.1' };
    const res = { setHeader: () => {} };
    const next = () => { nextCalled++; };

    rateLimit.middleware(req, res, next);
    rateLimit.reset('127.0.0.1');
    rateLimit.middleware(req, res, next);

    assert.strictEqual(nextCalled, 2);
  });
});

// ============================================================
// TESTES DE INPUT VALIDATION MIDDLEWARE
// ============================================================

describe('Middleware - Input Validation', () => {
  class ValidationMiddleware {
    static validateBody(schema) {
      return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
          const value = req.body?.[field];

          // Required
          if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
          }

          if (value === undefined || value === null) continue;

          // Type
          if (rules.type) {
            const actualType = typeof value;
            if (actualType !== rules.type) {
              errors.push(`${field} must be ${rules.type}, got ${actualType}`);
              continue;
            }
          }

          // Min length
          if (rules.minLength && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
          }

          // Max length
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`${field} must not exceed ${rules.maxLength} characters`);
          }

          // Pattern
          if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(`${field} format is invalid`);
          }

          // Min value
          if (rules.min !== undefined && value < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
          }

          // Max value
          if (rules.max !== undefined && value > rules.max) {
            errors.push(`${field} must not exceed ${rules.max}`);
          }
        }

        if (errors.length > 0) {
          res.status(400).json({ errors });
          return;
        }

        next();
      };
    }
  }

  it('deve validar campos obrigatórios', () => {
    const schema = {
      email: { required: true },
      password: { required: true }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let statusCode = null;
    let responseData = null;

    const req = { body: { email: 'test@example.com' } }; // Falta password
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
      }
    };

    validator(req, res, () => {});

    assert.strictEqual(statusCode, 400);
    assert.ok(responseData.errors.some(e => e.includes('password is required')));
  });

  it('deve validar tipos de dados', () => {
    const schema = {
      age: { type: 'number' }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let responseData = null;

    const req = { body: { age: '25' } }; // String em vez de number
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
      }
    };

    validator(req, res, () => {});

    assert.ok(responseData.errors.some(e => e.includes('must be number')));
  });

  it('deve validar comprimento mínimo', () => {
    const schema = {
      password: { minLength: 8 }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let responseData = null;

    const req = { body: { password: 'short' } };
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
      }
    };

    validator(req, res, () => {});

    assert.ok(responseData.errors.some(e => e.includes('at least 8 characters')));
  });

  it('deve validar pattern regex', () => {
    const schema = {
      email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let responseData = null;

    const req = { body: { email: 'invalid-email' } };
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
      }
    };

    validator(req, res, () => {});

    assert.ok(responseData.errors.some(e => e.includes('format is invalid')));
  });

  it('deve validar valores numéricos', () => {
    const schema = {
      rating: { min: 1, max: 5 }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let responseData = null;

    const req = { body: { rating: 10 } };
    const res = {
      status: () => res,
      json: (data) => {
        responseData = data;
      }
    };

    validator(req, res, () => {});

    assert.ok(responseData.errors.some(e => e.includes('must not exceed 5')));
  });

  it('deve passar validação com dados corretos', () => {
    const schema = {
      email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      password: { required: true, minLength: 8 },
      age: { type: 'number', min: 18 }
    };

    const validator = ValidationMiddleware.validateBody(schema);
    let nextCalled = false;

    const req = {
      body: {
        email: 'test@example.com',
        password: 'SecurePass123',
        age: 25
      }
    };

    const res = {
      status: () => res,
      json: () => {}
    };

    const next = () => { nextCalled = true; };

    validator(req, res, next);

    assert.strictEqual(nextCalled, true);
  });
});

// ============================================================
// TESTES DE SANITIZATION MIDDLEWARE
// ============================================================

describe('Middleware - Input Sanitization', () => {
  class SanitizationMiddleware {
    static sanitizeBody(req, res, next) {
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }
      next();
    }

    static sanitizeObject(obj) {
      const sanitized = {};

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    static sanitizeString(str) {
      return str
        .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove <script>
        .replace(/<[^>]+>/g, '') // Remove outras tags HTML
        .replace(/[<>'\"]/g, '') // Remove caracteres perigosos
        .trim(); // Trim after removing tags
    }
  }

  it('deve remover tags HTML', () => {
    let sanitizedBody = null;

    const req = {
      body: {
        message: '<b>Teste</b> <script>alert("xss")</script>'
      }
    };

    const next = () => {
      sanitizedBody = req.body;
    };

    SanitizationMiddleware.sanitizeBody(req, {}, next);

    assert.strictEqual(sanitizedBody.message, 'Teste');
    assert.ok(!sanitizedBody.message.includes('<script>'));
  });

  it('deve fazer trim de strings', () => {
    let sanitizedBody = null;

    const req = {
      body: {
        name: '  John Doe  '
      }
    };

    const next = () => {
      sanitizedBody = req.body;
    };

    SanitizationMiddleware.sanitizeBody(req, {}, next);

    assert.strictEqual(sanitizedBody.name, 'John Doe');
  });

  it('deve sanitizar objetos aninhados', () => {
    let sanitizedBody = null;

    const req = {
      body: {
        user: {
          name: '<b>Test</b>',
          email: '  test@example.com  '
        }
      }
    };

    const next = () => {
      sanitizedBody = req.body;
    };

    SanitizationMiddleware.sanitizeBody(req, {}, next);

    assert.strictEqual(sanitizedBody.user.name, 'Test');
    assert.strictEqual(sanitizedBody.user.email, 'test@example.com');
  });
});

console.log('✅ Testes de middleware carregados com sucesso');
