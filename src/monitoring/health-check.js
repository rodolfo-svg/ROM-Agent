import { getPostgresPool, checkDatabaseHealth } from '../config/database.js';

export class HealthMonitor {
  constructor() {
    this.metrics = {
      database: { status: 'unknown', lastCheck: null },
      memory: { usage: 0, limit: 0 },
      uptime: 0,
    };
  }

  async checkDatabase() {
    try {
      const pool = getPostgresPool();
      if (!pool) {
        this.metrics.database = { status: 'disconnected', lastCheck: new Date() };
        return false;
      }

      const result = await pool.query('SELECT NOW()');
      this.metrics.database = {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - result.rows[0].now.getTime()
      };
      return true;
    } catch (error) {
      this.metrics.database = {
        status: 'error',
        error: error.message,
        lastCheck: new Date()
      };
      return false;
    }
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    this.metrics.memory = {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    };
    return this.metrics.memory;
  }

  getUptime() {
    this.metrics.uptime = Math.round(process.uptime());
    return this.metrics.uptime;
  }

  async getFullStatus() {
    // ✅ FASE 3: Usar checkDatabaseHealth que inicializa conexões lazy
    const dbHealth = await checkDatabaseHealth();

    this.getMemoryUsage();
    this.getUptime();

    // Determinar status geral
    const isHealthy = dbHealth.postgres.available;
    const status = isHealthy ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date(),
      postgres: dbHealth.postgres,
      redis: dbHealth.redis,
      memory: this.metrics.memory,
      uptime: this.metrics.uptime
    };
  }
}

export const healthMonitor = new HealthMonitor();
