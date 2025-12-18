/**
 * ROM Agent - Metrics Collector v2 (prom-client)
 * Prometheus-compatible metrics using official client
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import featureFlags from './feature-flags.js';

class MetricsCollectorV2 {
  constructor() {
    this.registry = new Registry();
    this.initMetrics();
  }

  initMetrics() {
    // HTTP requests total (counter)
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    // HTTP request duration (histogram with buckets matching gate-checker)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60], // matches gate-checker expectations
      registers: [this.registry],
    });

    // Bedrock requests total
    this.bedrockRequestsTotal = new Counter({
      name: 'bedrock_requests_total',
      help: 'Total Bedrock API requests',
      registers: [this.registry],
    });

    // Bedrock tokens total
    this.bedrockTokensTotal = new Counter({
      name: 'bedrock_tokens_total',
      help: 'Total Bedrock tokens (input + output)',
      registers: [this.registry],
    });

    // Bedrock cost total
    this.bedrockCostTotal = new Counter({
      name: 'bedrock_cost_usd_total',
      help: 'Total Bedrock cost in USD',
      registers: [this.registry],
    });

    // Bedrock errors by type
    this.bedrockErrorsTotal = new Counter({
      name: 'bedrock_errors_total',
      help: 'Total Bedrock errors by type',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    // Guardrails triggered
    this.guardrailsTriggeredTotal = new Counter({
      name: 'guardrails_triggered_total',
      help: 'Total guardrails triggered',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    // Active requests gauge
    this.activeRequests = new Gauge({
      name: 'rom_active_requests',
      help: 'Currently active requests',
      registers: [this.registry],
    });

    // Node.js heap metrics
    this.heapUsed = new Gauge({
      name: 'nodejs_heap_size_used_bytes',
      help: 'Node.js heap used in bytes',
      registers: [this.registry],
    });

    this.heapTotal = new Gauge({
      name: 'nodejs_heap_size_total_bytes',
      help: 'Node.js heap total in bytes',
      registers: [this.registry],
    });
  }

  /**
   * Increment HTTP request counter
   */
  incrementHttpRequest(method, path, status) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.httpRequestsTotal.labels(method, path, String(status)).inc();
  }

  /**
   * Record HTTP request duration
   */
  recordHttpDuration(method, path, durationMs) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    const durationSec = durationMs / 1000;
    this.httpRequestDuration.labels(method, path).observe(durationSec);
  }

  /**
   * Increment Bedrock request counter
   */
  incrementBedrockRequest() {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.bedrockRequestsTotal.inc();
  }

  /**
   * Add Bedrock tokens
   */
  addBedrockTokens(inputTokens, outputTokens) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.bedrockTokensTotal.inc(inputTokens + outputTokens);
  }

  /**
   * Add Bedrock cost
   */
  addBedrockCost(costUsd) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.bedrockCostTotal.inc(costUsd);
  }

  /**
   * Increment Bedrock error counter
   */
  incrementBedrockError(errorType) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.bedrockErrorsTotal.labels(errorType).inc();
  }

  /**
   * Increment guardrails triggered counter
   */
  incrementGuardrailsTriggered(reason) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.guardrailsTriggeredTotal.labels(reason).inc();
  }

  /**
   * Set active requests gauge
   */
  setActiveRequests(count) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.activeRequests.set(count);
  }

  /**
   * Update Node.js heap metrics
   */
  updateHeapMetrics() {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    const memUsage = process.memoryUsage();
    this.heapUsed.set(memUsage.heapUsed);
    this.heapTotal.set(memUsage.heapTotal);
  }

  /**
   * Export metrics in Prometheus text format
   */
  async exportPrometheus() {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) {
      return '# Metrics disabled\n';
    }

    // Update heap metrics before export
    this.updateHeapMetrics();

    return await this.registry.metrics();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.registry.resetMetrics();
  }
}

// Singleton instance
const metricsCollector = new MetricsCollectorV2();

export default metricsCollector;
export { MetricsCollectorV2 };
