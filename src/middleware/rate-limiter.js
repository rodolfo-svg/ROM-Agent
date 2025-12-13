/**
 * ROM Agent - Rate Limiter para AWS Bedrock
 *
 * Previne "Too Many Requests" com:
 * - Rate limiting por IP e parceiro
 * - Backoff exponencial
 * - Fila de requisições
 * - Retry automático
 */

class RateLimiter {
  constructor(options = {}) {
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 10;
    this.maxRequestsPerHour = options.maxRequestsPerHour || 100;
    this.maxConcurrent = options.maxConcurrent || 3;

    // Armazenamento de contadores
    this.requestsPerMinute = new Map(); // key: IP/parceiro, value: count
    this.requestsPerHour = new Map();
    this.lastRequestTime = new Map();
    this.concurrentRequests = 0;
    this.queue = [];

    // Limpar contadores periodicamente
    setInterval(() => this.clearOldCounters(), 60000); // A cada 1 minuto
  }

  /**
   * Limpa contadores antigos
   */
  clearOldCounters() {
    const now = Date.now();

    // Limpar contador por minuto (> 60s)
    for (const [key, timestamp] of this.lastRequestTime.entries()) {
      if (now - timestamp > 60000) {
        this.requestsPerMinute.delete(key);
      }
    }

    // Limpar contador por hora (> 3600s)
    for (const [key, data] of this.requestsPerHour.entries()) {
      const filtered = data.filter(ts => now - ts < 3600000);
      if (filtered.length === 0) {
        this.requestsPerHour.delete(key);
      } else {
        this.requestsPerHour.set(key, filtered);
      }
    }
  }

  /**
   * Verifica se pode fazer requisição
   */
  canMakeRequest(identifier) {
    const now = Date.now();

    // Verificar limite de requisições concorrentes
    if (this.concurrentRequests >= this.maxConcurrent) {
      return {
        allowed: false,
        reason: 'too_many_concurrent',
        retryAfter: 5000 // 5 segundos
      };
    }

    // Verificar limite por minuto
    const minuteCount = this.requestsPerMinute.get(identifier) || 0;
    if (minuteCount >= this.maxRequestsPerMinute) {
      const lastTime = this.lastRequestTime.get(identifier) || 0;
      const waitTime = 60000 - (now - lastTime);
      return {
        allowed: false,
        reason: 'rate_limit_minute',
        retryAfter: waitTime
      };
    }

    // Verificar limite por hora
    const hourRequests = this.requestsPerHour.get(identifier) || [];
    const recentRequests = hourRequests.filter(ts => now - ts < 3600000);
    if (recentRequests.length >= this.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: 'rate_limit_hour',
        retryAfter: 300000 // 5 minutos
      };
    }

    return { allowed: true };
  }

  /**
   * Registra requisição
   */
  recordRequest(identifier) {
    const now = Date.now();

    // Incrementar contador por minuto
    const minuteCount = this.requestsPerMinute.get(identifier) || 0;
    this.requestsPerMinute.set(identifier, minuteCount + 1);
    this.lastRequestTime.set(identifier, now);

    // Adicionar timestamp ao contador por hora
    const hourRequests = this.requestsPerHour.get(identifier) || [];
    hourRequests.push(now);
    this.requestsPerHour.set(identifier, hourRequests);

    // Incrementar requisições concorrentes
    this.concurrentRequests++;
  }

  /**
   * Marca requisição como completa
   */
  completeRequest() {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
    this.processQueue();
  }

  /**
   * Processa fila de requisições
   */
  processQueue() {
    if (this.queue.length === 0) return;
    if (this.concurrentRequests >= this.maxConcurrent) return;

    const { identifier, resolve } = this.queue.shift();
    const check = this.canMakeRequest(identifier);

    if (check.allowed) {
      this.recordRequest(identifier);
      resolve(true);
    } else {
      // Recolocar na fila
      this.queue.unshift({ identifier, resolve });
    }
  }

  /**
   * Aguarda na fila se necessário
   */
  async waitForSlot(identifier) {
    return new Promise((resolve) => {
      const check = this.canMakeRequest(identifier);

      if (check.allowed) {
        this.recordRequest(identifier);
        resolve(true);
      } else {
        // Adicionar à fila
        this.queue.push({ identifier, resolve });

        // Processar fila após retry time
        setTimeout(() => this.processQueue(), check.retryAfter);
      }
    });
  }

  /**
   * Middleware Express
   */
  middleware() {
    return async (req, res, next) => {
      const identifier = req.partnerId || req.ip;

      const check = this.canMakeRequest(identifier);

      if (!check.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Você atingiu o limite de requisições. Aguarde antes de tentar novamente.',
          reason: check.reason,
          retryAfter: Math.ceil(check.retryAfter / 1000), // em segundos
          limits: {
            perMinute: this.maxRequestsPerMinute,
            perHour: this.maxRequestsPerHour,
            concurrent: this.maxConcurrent
          }
        });
      }

      this.recordRequest(identifier);

      // Hook para completar ao finalizar resposta
      res.on('finish', () => {
        this.completeRequest();
      });

      next();
    };
  }
}

/**
 * Função de retry com backoff exponencial
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Se for rate limit, aguardar e tentar novamente
      if (error.name === 'ThrottlingException' ||
          error.message?.includes('too many requests') ||
          error.message?.includes('rate limit')) {

        if (attempt === maxRetries - 1) {
          throw error; // Última tentativa, lançar erro
        }

        const delay = baseDelay * Math.pow(2, attempt); // Backoff exponencial
        console.log(`⏳ Rate limit atingido. Aguardando ${delay}ms antes de retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Outro tipo de erro, lançar imediatamente
      }
    }
  }
}

// Instância global
const globalRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 10,   // 10 req/min por IP/parceiro
  maxRequestsPerHour: 100,     // 100 req/hora por IP/parceiro
  maxConcurrent: 3             // Máximo 3 requisições simultâneas
});

export { RateLimiter, globalRateLimiter, retryWithBackoff };
