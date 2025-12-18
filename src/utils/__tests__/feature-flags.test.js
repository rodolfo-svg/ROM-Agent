/**
 * ROM Agent - Feature Flags Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FeatureFlags } from '../feature-flags.js';

describe('FeatureFlags', () => {
  let featureFlags;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear feature flag environment variables
    delete process.env.ENABLE_GUARDRAILS;
    delete process.env.GUARDRAIL_MODE;
    delete process.env.GUARDRAIL_SOFT_LIMIT;
    delete process.env.GUARDRAIL_HARD_LIMIT;
    delete process.env.ENABLE_RETRY;
    delete process.env.ENABLE_CIRCUIT_BREAKER;
    delete process.env.ENABLE_BOTTLENECK;

    // Create fresh instance
    featureFlags = new FeatureFlags();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Values', () => {
    it('should have all flags disabled by default', () => {
      expect(featureFlags.isEnabled('ENABLE_GUARDRAILS')).toBe(false);
      expect(featureFlags.isEnabled('ENABLE_RETRY')).toBe(false);
      expect(featureFlags.isEnabled('ENABLE_CIRCUIT_BREAKER')).toBe(false);
      expect(featureFlags.isEnabled('ENABLE_BOTTLENECK')).toBe(false);
    });

    it('should have ENABLE_METRICS true by default', () => {
      expect(featureFlags.isEnabled('ENABLE_METRICS')).toBe(true);
    });

    it('should have correct default numeric values', () => {
      expect(featureFlags.get('GUARDRAIL_SOFT_LIMIT')).toBe(12);
      expect(featureFlags.get('GUARDRAIL_HARD_LIMIT')).toBe(25);
      expect(featureFlags.get('MAX_CONCURRENT')).toBe(6);
      expect(featureFlags.get('MAX_QUEUE')).toBe(10);
      expect(featureFlags.get('MAX_RETRIES')).toBe(3);
      expect(featureFlags.get('CIRCUIT_BREAKER_THRESHOLD')).toBe(5);
    });

    it('should have correct default string values', () => {
      expect(featureFlags.get('GUARDRAIL_MODE')).toBe('off');
      expect(featureFlags.get('LOG_LEVEL')).toBe('info');
    });
  });

  describe('Boolean Parsing', () => {
    it('should parse string "true" as true', () => {
      process.env.ENABLE_GUARDRAILS = 'true';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_GUARDRAILS')).toBe(true);
    });

    it('should parse string "false" as false', () => {
      process.env.ENABLE_GUARDRAILS = 'false';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_GUARDRAILS')).toBe(false);
    });

    it('should parse "1" as true', () => {
      process.env.ENABLE_RETRY = '1';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_RETRY')).toBe(true);
    });

    it('should parse "0" as false', () => {
      process.env.ENABLE_RETRY = '0';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_RETRY')).toBe(false);
    });

    it('should parse "yes" as true', () => {
      process.env.ENABLE_BOTTLENECK = 'yes';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_BOTTLENECK')).toBe(true);
    });

    it('should parse "no" as false', () => {
      process.env.ENABLE_BOTTLENECK = 'no';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_BOTTLENECK')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      process.env.ENABLE_CIRCUIT_BREAKER = 'TRUE';
      const ff = new FeatureFlags();
      expect(ff.isEnabled('ENABLE_CIRCUIT_BREAKER')).toBe(true);
    });
  });

  describe('Integer Parsing', () => {
    it('should parse valid integers', () => {
      process.env.GUARDRAIL_SOFT_LIMIT = '20';
      const ff = new FeatureFlags();
      expect(ff.get('GUARDRAIL_SOFT_LIMIT')).toBe(20);
    });

    it('should use default for invalid integers', () => {
      process.env.GUARDRAIL_SOFT_LIMIT = 'invalid';
      const ff = new FeatureFlags();
      expect(ff.get('GUARDRAIL_SOFT_LIMIT')).toBe(12);
    });

    it('should use default for negative numbers', () => {
      process.env.GUARDRAIL_SOFT_LIMIT = '-5';
      const ff = new FeatureFlags();
      expect(ff.get('GUARDRAIL_SOFT_LIMIT')).toBe(12);
    });

    it('should handle zero as valid value', () => {
      process.env.MAX_CONCURRENT = '0';
      const ff = new FeatureFlags();
      expect(ff.get('MAX_CONCURRENT')).toBe(0);
    });
  });

  describe('getAll()', () => {
    it('should return all flags as object', () => {
      const flags = featureFlags.getAll();
      expect(flags).toHaveProperty('ENABLE_GUARDRAILS');
      expect(flags).toHaveProperty('GUARDRAIL_MODE');
      expect(flags).toHaveProperty('GUARDRAIL_SOFT_LIMIT');
      expect(flags).toHaveProperty('GUARDRAIL_HARD_LIMIT');
      expect(flags).toHaveProperty('ENABLE_RETRY');
      expect(flags).toHaveProperty('ENABLE_CIRCUIT_BREAKER');
      expect(flags).toHaveProperty('ENABLE_BOTTLENECK');
      expect(flags).toHaveProperty('ENABLE_METRICS');
      expect(flags).toHaveProperty('LOG_LEVEL');
    });

    it('should return a copy, not reference', () => {
      const flags1 = featureFlags.getAll();
      const flags2 = featureFlags.getAll();
      expect(flags1).not.toBe(flags2);
      expect(flags1).toEqual(flags2);
    });
  });

  describe('reload()', () => {
    it('should reload flags from environment', () => {
      // Initial state
      expect(featureFlags.isEnabled('ENABLE_GUARDRAILS')).toBe(false);

      // Change environment
      process.env.ENABLE_GUARDRAILS = 'true';

      // Reload
      featureFlags.reload();

      // Verify update
      expect(featureFlags.isEnabled('ENABLE_GUARDRAILS')).toBe(true);
    });

    it('should return updated flags', () => {
      process.env.GUARDRAIL_SOFT_LIMIT = '30';
      const flags = featureFlags.reload();
      expect(flags.GUARDRAIL_SOFT_LIMIT).toBe(30);
    });
  });

  describe('Flag combinations', () => {
    it('should handle mixed boolean and numeric flags', () => {
      process.env.ENABLE_GUARDRAILS = 'true';
      process.env.ENABLE_RETRY = 'false';
      process.env.GUARDRAIL_SOFT_LIMIT = '15';
      process.env.GUARDRAIL_HARD_LIMIT = '30';
      process.env.GUARDRAIL_MODE = 'soft';

      const ff = new FeatureFlags();

      expect(ff.isEnabled('ENABLE_GUARDRAILS')).toBe(true);
      expect(ff.isEnabled('ENABLE_RETRY')).toBe(false);
      expect(ff.get('GUARDRAIL_SOFT_LIMIT')).toBe(15);
      expect(ff.get('GUARDRAIL_HARD_LIMIT')).toBe(30);
      expect(ff.get('GUARDRAIL_MODE')).toBe('soft');
    });
  });

  describe('Safety checks', () => {
    it('should return false for undefined flags in isEnabled()', () => {
      expect(featureFlags.isEnabled('NONEXISTENT_FLAG')).toBe(false);
    });

    it('should return undefined for undefined flags in get()', () => {
      expect(featureFlags.get('NONEXISTENT_FLAG')).toBeUndefined();
    });
  });
});
