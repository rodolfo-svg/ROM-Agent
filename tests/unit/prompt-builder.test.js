/**
 * Unit Tests for PromptBuilder
 * Tests modular prompt construction system with 79% token reduction
 *
 * Run: npm test tests/unit/prompt-builder.test.js
 * Or: npx vitest run tests/unit/prompt-builder.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PromptBuilder,
  buildSystemPrompt,
  shouldIncludeTools,
  shouldIncludeABNT,
  detectDocumentType,
  createPromptBuilder,
  OPTIMIZED_SYSTEM_PROMPT
} from '../../src/lib/prompt-builder.js';

describe('PromptBuilder', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear cache before each test
    PromptBuilder.clearCache();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // =============================================================
  // Test 1: Base prompt size validation
  // =============================================================
  describe('Base Prompt Size', () => {
    it('should have base prompt size under 1,800 characters', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.size).toBeLessThan(1800);
      expect(result.prompt.length).toBeLessThan(1800);
    });

    it('should have base prompt under 500 tokens', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.tokens).toBeLessThan(500);
    });

    it('should include only core module in base prompt', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.modules).toEqual(['core']);
    });
  });

  // =============================================================
  // Test 2: Conditional loading of tools
  // =============================================================
  describe('Conditional Loading - Tools', () => {
    it('should include tool instructions when explicitly requested', () => {
      const builder = new PromptBuilder();
      const result = builder.build({ includeTools: true });

      expect(result.modules).toContain('tools');
      expect(result.prompt).toContain('web_search Tool');
      expect(result.prompt).toContain('execute_code Tool');
      expect(result.tokens).toBeGreaterThan(1000);
    });

    it('should not include tool instructions by default', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.modules).not.toContain('tools');
      expect(result.prompt).not.toContain('web_search Tool');
    });

    it('should increase token count when tools are included', () => {
      const builder = new PromptBuilder();
      const baseResult = builder.build({});
      const toolsResult = builder.build({ includeTools: true });

      expect(toolsResult.tokens).toBeGreaterThan(baseResult.tokens);
      expect(toolsResult.tokens - baseResult.tokens).toBeGreaterThanOrEqual(1000);
    });
  });

  // =============================================================
  // Test 3: Conditional loading of ABNT
  // =============================================================
  describe('Conditional Loading - ABNT', () => {
    it('should include ABNT rules when explicitly requested', () => {
      const builder = new PromptBuilder();
      const result = builder.build({ includeABNT: true });

      expect(result.modules).toContain('abnt');
      expect(result.prompt).toContain('ABNT Formatting Rules');
      expect(result.prompt).toContain('Margins');
      expect(result.tokens).toBeGreaterThan(1000);
    });

    it('should not include ABNT rules by default', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.modules).not.toContain('abnt');
      expect(result.prompt).not.toContain('ABNT Formatting Rules');
    });

    it('should increase token count when ABNT is included', () => {
      const builder = new PromptBuilder();
      const baseResult = builder.build({});
      const abntResult = builder.build({ includeABNT: true });

      expect(abntResult.tokens).toBeGreaterThan(baseResult.tokens);
      expect(abntResult.tokens - baseResult.tokens).toBeGreaterThanOrEqual(900);
    });
  });

  // =============================================================
  // Test 4: Combined module loading
  // =============================================================
  describe('Combined Module Loading', () => {
    it('should include all modules when both tools and ABNT are requested', () => {
      const builder = new PromptBuilder();
      const result = builder.build({
        includeTools: true,
        includeABNT: true
      });

      expect(result.modules).toContain('core');
      expect(result.modules).toContain('tools');
      expect(result.modules).toContain('abnt');
      expect(result.modules.length).toBe(3);
    });

    it('should have proper separators between modules', () => {
      const builder = new PromptBuilder();
      const result = builder.build({
        includeTools: true,
        includeABNT: true
      });

      expect(result.prompt).toContain('---');
    });

    it('should report correct total tokens for all modules', () => {
      const builder = new PromptBuilder();
      const result = builder.build({
        includeTools: true,
        includeABNT: true
      });

      // Base (438) + Tools (1050) + ABNT (1025) = 2513
      expect(result.tokens).toBeGreaterThanOrEqual(2400);
      expect(result.tokens).toBeLessThanOrEqual(2600);
    });
  });

  // =============================================================
  // Test 5: Feature flag switching
  // =============================================================
  describe('Feature Flag Switching', () => {
    it('should use optimized prompts when version is "optimized"', () => {
      process.env.PROMPTS_VERSION = 'optimized';
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.version).toBe('optimized');
    });

    it('should use legacy prompts when version is "legacy"', () => {
      process.env.PROMPTS_VERSION = 'legacy';
      const mockLegacyPrompt = 'Legacy prompt content for testing';

      const builder = new PromptBuilder({
        version: 'legacy',
        legacyPromptLoader: () => mockLegacyPrompt
      });
      const result = builder.build({});

      expect(result.version).toBe('legacy');
      expect(result.prompt).toBe(mockLegacyPrompt);
    });

    it('should default to optimized when no version specified', () => {
      delete process.env.PROMPTS_VERSION;
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.version).toBe('optimized');
    });
  });

  // =============================================================
  // Test 6: Prompt caching
  // =============================================================
  describe('Prompt Caching', () => {
    it('should cache prompts and return same result', () => {
      const builder = new PromptBuilder({ enableCaching: true });
      const result1 = builder.build({ includeTools: true });
      const result2 = builder.build({ includeTools: true });

      expect(result1.prompt).toBe(result2.prompt);
      expect(result1.tokens).toBe(result2.tokens);
    });

    it('should have different cache entries for different options', () => {
      const builder = new PromptBuilder({ enableCaching: true });
      builder.build({ includeTools: true });
      builder.build({ includeABNT: true });
      builder.build({});

      const stats = PromptBuilder.getCacheStats();
      expect(stats.size).toBe(3);
    });

    it('should clear cache when requested', () => {
      const builder = new PromptBuilder({ enableCaching: true });
      builder.build({});
      builder.build({ includeTools: true });

      expect(PromptBuilder.getCacheStats().size).toBe(2);

      PromptBuilder.clearCache();

      expect(PromptBuilder.getCacheStats().size).toBe(0);
    });

    it('should work correctly with caching disabled', () => {
      PromptBuilder.clearCache();
      const builder = new PromptBuilder({ enableCaching: false });
      builder.build({});
      builder.build({});

      expect(PromptBuilder.getCacheStats().size).toBe(0);
    });
  });

  // =============================================================
  // Test 7: Auto-detection - shouldIncludeTools
  // =============================================================
  describe('Auto-detection - shouldIncludeTools', () => {
    it('should detect tool keywords in user message', () => {
      expect(shouldIncludeTools('Pesquise jurisprudencia sobre X')).toBe(true);
      expect(shouldIncludeTools('Busque precedentes do STJ')).toBe(true);
      expect(shouldIncludeTools('Calcule os juros do contrato')).toBe(true);
      expect(shouldIncludeTools('Consulte o processo 1234')).toBe(true);
    });

    it('should not detect tools for simple messages', () => {
      expect(shouldIncludeTools('Ola, como vai?')).toBe(false);
      expect(shouldIncludeTools('Qual e o prazo recursal?')).toBe(false);
      expect(shouldIncludeTools('Explique o que e dano moral')).toBe(false);
    });

    it('should handle empty or null messages', () => {
      expect(shouldIncludeTools('')).toBe(false);
      expect(shouldIncludeTools(null)).toBe(false);
      expect(shouldIncludeTools(undefined)).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(shouldIncludeTools('PESQUISE jurisprudencia')).toBe(true);
      expect(shouldIncludeTools('pesquise JURISPRUDENCIA')).toBe(true);
    });
  });

  // =============================================================
  // Test 8: Auto-detection - shouldIncludeABNT
  // =============================================================
  describe('Auto-detection - shouldIncludeABNT', () => {
    it('should detect ABNT keywords in user message', () => {
      expect(shouldIncludeABNT('Redija uma peticao inicial')).toBe(true);
      expect(shouldIncludeABNT('Faca uma contestacao')).toBe(true);
      expect(shouldIncludeABNT('Formate o documento')).toBe(true);
      expect(shouldIncludeABNT('Elabore um recurso')).toBe(true);
    });

    it('should not detect ABNT for simple messages', () => {
      expect(shouldIncludeABNT('Qual e o prazo?')).toBe(false);
      expect(shouldIncludeABNT('Me explique sobre contratos')).toBe(false);
      expect(shouldIncludeABNT('Ola, preciso de ajuda')).toBe(false);
    });

    it('should handle empty or null messages', () => {
      expect(shouldIncludeABNT('')).toBe(false);
      expect(shouldIncludeABNT(null)).toBe(false);
      expect(shouldIncludeABNT(undefined)).toBe(false);
    });

    it('should detect habeas corpus', () => {
      expect(shouldIncludeABNT('Prepare um habeas corpus')).toBe(true);
    });
  });

  // =============================================================
  // Test 9: Auto-detection - detectDocumentType
  // =============================================================
  describe('Auto-detection - detectDocumentType', () => {
    it('should detect document types correctly', () => {
      expect(detectDocumentType('Redija uma peticao inicial')).toBe('peticao-inicial');
      expect(detectDocumentType('Preciso de uma contestacao')).toBe('contestacao');
      expect(detectDocumentType('Habeas corpus urgente')).toBe('habeas-corpus');
      expect(detectDocumentType('Fazer apelacao')).toBe('apelacao');
    });

    it('should return null for unknown document types', () => {
      expect(detectDocumentType('Alguma duvida generica')).toBeNull();
      expect(detectDocumentType('Ola, bom dia')).toBeNull();
    });

    it('should handle empty or null messages', () => {
      expect(detectDocumentType('')).toBeNull();
      expect(detectDocumentType(null)).toBeNull();
      expect(detectDocumentType(undefined)).toBeNull();
    });

    it('should detect embargos de declaracao', () => {
      expect(detectDocumentType('Faca embargos de declaracao')).toBe('embargos-declaracao');
    });
  });

  // =============================================================
  // Test 10: A/B Testing - Hash-based bucketing
  // =============================================================
  describe('A/B Testing - Hash-based Bucketing', () => {
    it('should use optimized for all users when traffic is 100%', () => {
      const builder = new PromptBuilder({ trafficPercentage: 100 });

      expect(builder.shouldUseOptimized('user1')).toBe(true);
      expect(builder.shouldUseOptimized('user2')).toBe(true);
      expect(builder.shouldUseOptimized('user3')).toBe(true);
    });

    it('should use legacy for all users when traffic is 0%', () => {
      const builder = new PromptBuilder({ trafficPercentage: 0 });

      expect(builder.shouldUseOptimized('user1')).toBe(false);
      expect(builder.shouldUseOptimized('user2')).toBe(false);
      expect(builder.shouldUseOptimized('user3')).toBe(false);
    });

    it('should be deterministic for same user ID', () => {
      const builder = new PromptBuilder({ trafficPercentage: 50 });
      const userId = 'test-user-12345';

      const result1 = builder.shouldUseOptimized(userId);
      const result2 = builder.shouldUseOptimized(userId);
      const result3 = builder.shouldUseOptimized(userId);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should distribute users across buckets for 50% traffic', () => {
      const builder = new PromptBuilder({ trafficPercentage: 50 });

      let optimizedCount = 0;
      const testUsers = 100;

      for (let i = 0; i < testUsers; i++) {
        if (builder.shouldUseOptimized(`user-${i}`)) {
          optimizedCount++;
        }
      }

      // Should be roughly 50% (allow 20% variance for small sample)
      expect(optimizedCount).toBeGreaterThan(30);
      expect(optimizedCount).toBeLessThan(70);
    });

    it('should use random bucketing when no userId provided', () => {
      const builder = new PromptBuilder({ trafficPercentage: 50 });

      // Call multiple times and check we get some variance
      const results = new Set();
      for (let i = 0; i < 20; i++) {
        results.add(builder.shouldUseOptimized(null));
      }

      // With 50% traffic, we should get both true and false
      // (This test could theoretically fail with very low probability)
      expect(results.size).toBe(2);
    });
  });

  // =============================================================
  // Test 11: buildSystemPrompt convenience function
  // =============================================================
  describe('buildSystemPrompt Convenience Function', () => {
    it('should build prompt with auto-detection', () => {
      const result = buildSystemPrompt({
        userMessage: 'Pesquise jurisprudencia sobre dano moral'
      });

      expect(result.modules).toContain('tools');
    });

    it('should build prompt with explicit options', () => {
      const result = buildSystemPrompt({
        includeTools: true,
        includeABNT: true
      });

      expect(result.modules).toContain('tools');
      expect(result.modules).toContain('abnt');
    });

    it('should work with no options', () => {
      const result = buildSystemPrompt({});

      expect(result.prompt).toBeTruthy();
      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  // =============================================================
  // Test 12: Exported OPTIMIZED_SYSTEM_PROMPT constant
  // =============================================================
  describe('OPTIMIZED_SYSTEM_PROMPT Export', () => {
    it('should export the optimized system prompt constant', () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toBeTruthy();
      expect(typeof OPTIMIZED_SYSTEM_PROMPT).toBe('string');
    });

    it('should contain critical rules', () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain('STREAMING');
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain('FORMATTING');
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain('STRUCTURE');
    });

    it('should contain ROM Agent identity', () => {
      expect(OPTIMIZED_SYSTEM_PROMPT).toContain('ROM Agent');
    });
  });

  // =============================================================
  // Test 13: Factory function
  // =============================================================
  describe('createPromptBuilder Factory', () => {
    it('should create a PromptBuilder instance', () => {
      const builder = createPromptBuilder();

      expect(builder).toBeInstanceOf(PromptBuilder);
    });

    it('should pass options to PromptBuilder', () => {
      const builder = createPromptBuilder({
        trafficPercentage: 25,
        enableCaching: false
      });

      expect(builder.trafficPercentage).toBe(25);
      expect(builder.enableCaching).toBe(false);
    });
  });

  // =============================================================
  // Test 14: Prompt content validation
  // =============================================================
  describe('Prompt Content Validation', () => {
    it('should not contain markdown in base prompt', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      // Should not have markdown code blocks
      expect(result.prompt).not.toMatch(/```/);
    });

    it('should mention critical streaming rules', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.prompt).toContain('STREAMING');
      expect(result.prompt).toContain('HIGHEST PRIORITY');
    });

    it('should mention formatting rules', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.prompt).toContain('Calibri');
      expect(result.prompt).toContain('12pt');
    });

    it('should mention prohibited items', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.prompt).toContain('PROHIBITED');
      expect(result.prompt).toContain('Markdown');
    });
  });

  // =============================================================
  // Test 15: Result object structure
  // =============================================================
  describe('Result Object Structure', () => {
    it('should return correct result structure', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('modules');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('version');
    });

    it('should have matching size and prompt length', () => {
      const builder = new PromptBuilder();
      const result = builder.build({});

      expect(result.size).toBe(result.prompt.length);
    });

    it('should have array of modules', () => {
      const builder = new PromptBuilder();
      const result = builder.build({
        includeTools: true,
        includeABNT: true
      });

      expect(Array.isArray(result.modules)).toBe(true);
      expect(result.modules.length).toBe(3);
    });
  });
});
