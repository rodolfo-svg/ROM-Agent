/**
 * ROM Agent - Feature Flags System
 * Runtime configuration for safe rollback without redeployment
 */

import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FeatureFlags {
  constructor() {
    this.flags = {};
    this.loadFlags();
  }

  /**
   * Load flags from .env file
   */
  loadFlags() {
    // Load from .env
    dotenv.config();

    // Default flags (all disabled for safety)
    const defaults = {
      ENABLE_GUARDRAILS: false,
      GUARDRAIL_MODE: 'off',
      GUARDRAIL_SOFT_LIMIT: 12,
      GUARDRAIL_HARD_LIMIT: 25,
      ENABLE_RETRY: false,
      MAX_RETRIES: 3,
      ENABLE_CIRCUIT_BREAKER: false,
      CIRCUIT_BREAKER_THRESHOLD: 5,
      ENABLE_BOTTLENECK: false,
      MAX_CONCURRENT: 6,
      MAX_QUEUE: 10,
      ENABLE_METRICS: true,
      LOG_LEVEL: 'info',

      // ✨ FASE 2: Google Search Optimizations (2026-01-28)
      ENABLE_GOOGLE_TIMEOUT_20S: false,
      ENABLE_REDIS_CACHE: false,
      ENABLE_CACHE_GOOGLE_SEARCH: false,

      // ✨ FASE 3: STJ Scraping Fixes (2026-01-28)
      ENABLE_USER_AGENT_ROTATION: false,
      ENABLE_PROXY_POOL: false,
      ENABLE_STJ_FALLBACK_DATAJUD: false,

      // ✨ FASE 4: Resiliência (2026-01-28)
      ENABLE_RETRY_BACKOFF: false,
      ENABLE_GLOBAL_FALLBACK: false,

      // ✨ FASE 5: Monitoramento (2026-01-28)
      ENABLE_STRUCTURED_LOGGING: false,

      // Canary Deployment (0% = disabled)
      CANARY_PERCENTAGE: 0,
    };

    // Parse environment variables
    this.flags = {
      ENABLE_GUARDRAILS: this.parseBoolean(process.env.ENABLE_GUARDRAILS, defaults.ENABLE_GUARDRAILS),
      GUARDRAIL_MODE: process.env.GUARDRAIL_MODE || defaults.GUARDRAIL_MODE,
      GUARDRAIL_SOFT_LIMIT: this.parseInt(process.env.GUARDRAIL_SOFT_LIMIT, defaults.GUARDRAIL_SOFT_LIMIT),
      GUARDRAIL_HARD_LIMIT: this.parseInt(process.env.GUARDRAIL_HARD_LIMIT, defaults.GUARDRAIL_HARD_LIMIT),

      ENABLE_RETRY: this.parseBoolean(process.env.ENABLE_RETRY, defaults.ENABLE_RETRY),
      MAX_RETRIES: this.parseInt(process.env.MAX_RETRIES, defaults.MAX_RETRIES),

      ENABLE_CIRCUIT_BREAKER: this.parseBoolean(process.env.ENABLE_CIRCUIT_BREAKER, defaults.ENABLE_CIRCUIT_BREAKER),
      CIRCUIT_BREAKER_THRESHOLD: this.parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, defaults.CIRCUIT_BREAKER_THRESHOLD),

      ENABLE_BOTTLENECK: this.parseBoolean(process.env.ENABLE_BOTTLENECK, defaults.ENABLE_BOTTLENECK),
      MAX_CONCURRENT: this.parseInt(process.env.MAX_CONCURRENT, defaults.MAX_CONCURRENT),
      MAX_QUEUE: this.parseInt(process.env.MAX_QUEUE, defaults.MAX_QUEUE),

      ENABLE_METRICS: this.parseBoolean(process.env.ENABLE_METRICS, defaults.ENABLE_METRICS),
      LOG_LEVEL: process.env.LOG_LEVEL || defaults.LOG_LEVEL,

      // ✨ FASE 2: Google Search Optimizations
      ENABLE_GOOGLE_TIMEOUT_20S: this.parseBoolean(process.env.FF_GOOGLE_TIMEOUT_20S, defaults.ENABLE_GOOGLE_TIMEOUT_20S),
      ENABLE_REDIS_CACHE: this.parseBoolean(process.env.FF_REDIS_CACHE, defaults.ENABLE_REDIS_CACHE),
      ENABLE_CACHE_GOOGLE_SEARCH: this.parseBoolean(process.env.FF_CACHE_GOOGLE, defaults.ENABLE_CACHE_GOOGLE_SEARCH),

      // ✨ FASE 3: STJ Scraping Fixes
      ENABLE_USER_AGENT_ROTATION: this.parseBoolean(process.env.FF_USER_AGENT_ROTATION, defaults.ENABLE_USER_AGENT_ROTATION),
      ENABLE_PROXY_POOL: this.parseBoolean(process.env.FF_PROXY_POOL, defaults.ENABLE_PROXY_POOL),
      ENABLE_STJ_FALLBACK_DATAJUD: this.parseBoolean(process.env.FF_STJ_FALLBACK, defaults.ENABLE_STJ_FALLBACK_DATAJUD),

      // ✨ FASE 4: Resiliência
      ENABLE_RETRY_BACKOFF: this.parseBoolean(process.env.FF_RETRY_BACKOFF, defaults.ENABLE_RETRY_BACKOFF),
      ENABLE_GLOBAL_FALLBACK: this.parseBoolean(process.env.FF_GLOBAL_FALLBACK, defaults.ENABLE_GLOBAL_FALLBACK),

      // ✨ FASE 5: Monitoramento
      ENABLE_STRUCTURED_LOGGING: this.parseBoolean(process.env.FF_STRUCTURED_LOGGING, defaults.ENABLE_STRUCTURED_LOGGING),

      // Canary Deployment
      CANARY_PERCENTAGE: this.parseInt(process.env.FF_CANARY_PERCENTAGE, defaults.CANARY_PERCENTAGE),
    };

    console.log('[FeatureFlags] Loaded:', this.flags);
  }

  /**
   * Reload flags from environment (for hot reload)
   */
  reload() {
    console.log('[FeatureFlags] Reloading flags...');
    this.loadFlags();
    return this.flags;
  }

  /**
   * Check if a flag is enabled
   */
  isEnabled(flagName) {
    return Boolean(this.flags[flagName]);
  }

  /**
   * Get flag value (number or boolean)
   */
  get(flagName) {
    return this.flags[flagName];
  }

  /**
   * Get all flags
   */
  getAll() {
    return { ...this.flags };
  }

  /**
   * Parse boolean from string
   */
  parseBoolean(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    if (str === 'true' || str === '1' || str === 'yes') return true;
    if (str === 'false' || str === '0' || str === 'no') return false;
    return defaultValue;
  }

  /**
   * Parse integer from string
   */
  parseInt(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    const num = Number(value);
    return Number.isInteger(num) && num >= 0 ? num : defaultValue;
  }

  /**
   * Check if user is in canary deployment (0-100%)
   * Uses deterministic hash so same user always gets same result
   */
  isUserInCanary(userId) {
    const percentage = this.get('CANARY_PERCENTAGE');
    if (percentage === 0) return false;
    if (percentage >= 100) return true;

    // Simple hash function for deterministic canary selection
    let hash = 0;
    const str = String(userId || 'anonymous');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < percentage;
  }

  /**
   * Get canary percentage
   */
  getCanaryPercentage() {
    return this.get('CANARY_PERCENTAGE') || 0;
  }
}

// Singleton instance
const featureFlags = new FeatureFlags();

export default featureFlags;
export { FeatureFlags };
