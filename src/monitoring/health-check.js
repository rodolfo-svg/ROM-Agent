import { getPostgresPool } from '../config/database.js';

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
    await this.checkDatabase();
    this.getMemoryUsage();
    this.getUptime();

    return {
      status: this.metrics.database.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date(),
      metrics: this.metrics,
    };
  }
}

export const healthMonitor = new HealthMonitor();
