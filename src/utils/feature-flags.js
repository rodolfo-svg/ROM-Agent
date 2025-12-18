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
}

// Singleton instance
const featureFlags = new FeatureFlags();

export default featureFlags;
export { FeatureFlags };
