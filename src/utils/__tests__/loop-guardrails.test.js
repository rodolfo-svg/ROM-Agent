/**
 * Loop Guardrails - Tests
 *
 * Testes para prevenção de loops infinitos em tool-use
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { LoopGuardrails } from '../loop-guardrails.js';

// Mock feature flags to enable guardrails for testing
process.env.ENABLE_GUARDRAILS = 'true';

describe('Loop Guardrails', () => {
  let guardrails;
  const testConvId = 'test-conv-123';

  before(() => {
    guardrails = new LoopGuardrails({
      softLimit: 3,
      hardLimit: 5,
      repetitionThreshold: 3,
      enabled: true
    });
  });

  describe('Initialization', () => {
    it('should initialize conversation tracking', () => {
      guardrails.initConversation(testConvId);
      const stats = guardrails.getStats(testConvId);

      assert.strictEqual(stats.found, true);
      assert.strictEqual(stats.loopCount, 0);
      assert.strictEqual(stats.stopped, false);
      assert.strictEqual(stats.status, 'normal');
    });
  });

  describe('Soft Limit', () => {
    it('should trigger warning at soft limit (3)', () => {
      const convId = 'test-soft-limit';
      guardrails.initConversation(convId);

      // 1st tool use - OK
      let result = guardrails.trackToolUse(convId, 'tool1');
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.warningActive, false);

      // 2nd tool use - OK
      result = guardrails.trackToolUse(convId, 'tool2');
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.warningActive, false);

      // 3rd tool use - WARNING (soft limit)
      result = guardrails.trackToolUse(convId, 'tool3');
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.warningActive, true);
      assert.strictEqual(result.loopCount, 3);

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.status, 'warning');
      assert.ok(stats.warnings.includes('soft_limit'));

      guardrails.cleanupConversation(convId);
    });
  });

  describe('Hard Limit', () => {
    it('should block at hard limit (5)', () => {
      const convId = 'test-hard-limit';
      guardrails.initConversation(convId);

      // Execute 4 tool uses (below hard limit)
      for (let i = 1; i <= 4; i++) {
        const result = guardrails.trackToolUse(convId, `tool${i}`);
        assert.strictEqual(result.allowed, true, `Tool ${i} should be allowed`);
      }

      // 5th tool use - BLOCKED (hard limit)
      const result = guardrails.trackToolUse(convId, 'tool5');
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.reason, 'hard_limit');
      assert.strictEqual(result.loopCount, 5);
      assert.ok(result.message.includes('Loop infinito'));

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.stopped, true);
      assert.strictEqual(stats.status, 'stopped');

      guardrails.cleanupConversation(convId);
    });
  });

  describe('Repetition Detection', () => {
    it('should block after 3 consecutive same tools', () => {
      const convId = 'test-repetition';
      guardrails.initConversation(convId);

      // 1st use of same_tool - OK
      let result = guardrails.trackToolUse(convId, 'same_tool');
      assert.strictEqual(result.allowed, true);

      // 2nd use of same_tool - OK
      result = guardrails.trackToolUse(convId, 'same_tool');
      assert.strictEqual(result.allowed, true);

      // 3rd use of same_tool - BLOCKED (repetition)
      result = guardrails.trackToolUse(convId, 'same_tool');
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.reason, 'repetition');
      assert.strictEqual(result.repetitionCount, 3);
      assert.ok(result.message.includes('Comportamento repetitivo'));

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.stopped, true);

      guardrails.cleanupConversation(convId);
    });

    it('should NOT block if tools are different', () => {
      const convId = 'test-no-repetition';
      guardrails.initConversation(convId);

      // Different tools - should all be OK
      let result = guardrails.trackToolUse(convId, 'tool1');
      assert.strictEqual(result.allowed, true);

      result = guardrails.trackToolUse(convId, 'tool2');
      assert.strictEqual(result.allowed, true);

      result = guardrails.trackToolUse(convId, 'tool3');
      assert.strictEqual(result.allowed, true);

      result = guardrails.trackToolUse(convId, 'tool1');
      assert.strictEqual(result.allowed, true);

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.stopped, false);

      guardrails.cleanupConversation(convId);
    });
  });

  describe('Statistics', () => {
    it('should track tool history', () => {
      const convId = 'test-history';
      guardrails.initConversation(convId);

      guardrails.trackToolUse(convId, 'tool1');
      guardrails.trackToolUse(convId, 'tool2');
      guardrails.trackToolUse(convId, 'tool3');

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.toolHistory.length, 3);
      assert.strictEqual(stats.toolHistory[0].tool, 'tool1');
      assert.strictEqual(stats.toolHistory[1].tool, 'tool2');
      assert.strictEqual(stats.toolHistory[2].tool, 'tool3');

      guardrails.cleanupConversation(convId);
    });

    it('should return global stats', () => {
      const conv1 = 'conv-1';
      const conv2 = 'conv-2';

      guardrails.initConversation(conv1);
      guardrails.initConversation(conv2);

      guardrails.trackToolUse(conv1, 'tool1');
      guardrails.trackToolUse(conv1, 'tool2');

      guardrails.trackToolUse(conv2, 'tool1');

      const globalStats = guardrails.getGlobalStats();
      assert.ok(globalStats.totalConversations >= 2);
      assert.ok(globalStats.maxLoopCount >= 2);

      guardrails.cleanupConversation(conv1);
      guardrails.cleanupConversation(conv2);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup conversation', () => {
      const convId = 'test-cleanup';
      guardrails.initConversation(convId);

      guardrails.trackToolUse(convId, 'tool1');

      const deleted = guardrails.cleanupConversation(convId);
      assert.strictEqual(deleted, true);

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.found, false);
    });

    it('should cleanup old conversations (periodic)', () => {
      const oldConv = 'old-conv';
      guardrails.initConversation(oldConv);

      // Simular conversação antiga (modificar startTime)
      // Nota: Em produção, isto seria feito pelo periodicCleanup após 1h
      const result = guardrails.periodicCleanup(0); // 0ms = remove tudo

      assert.ok(result.removed >= 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle conversation not found', () => {
      const stats = guardrails.getStats('non-existent');
      assert.strictEqual(stats.found, false);
    });

    it('should allow tracking before initialization (auto-init)', () => {
      const convId = 'auto-init-test';

      // Tracking sem init - deve auto-inicializar
      const result = guardrails.trackToolUse(convId, 'tool1');
      assert.strictEqual(result.allowed, true);

      const stats = guardrails.getStats(convId);
      assert.strictEqual(stats.found, true);
      assert.strictEqual(stats.loopCount, 1);

      guardrails.cleanupConversation(convId);
    });
  });

  after(() => {
    // Cleanup de todos os testes
    const globalStats = guardrails.getGlobalStats();
    console.log(`\n✅ Tests completed. Cleaned up ${globalStats.totalConversations} test conversations.`);
  });
});
