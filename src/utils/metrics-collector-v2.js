/**
 * ROM Agent - Metrics Collector v2 (prom-client)
 * Prometheus-compatible metrics using official client
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import featureFlags from './feature-flags.js';

// Helper functions to avoid duplicate metric registration
function getOrCreateCounter({ name, help, labelNames = [], registry }) {
  return registry.getSingleMetric(name) ||
    new Counter({ name, help, labelNames, registers: [registry] });
}

function getOrCreateGauge({ name, help, labelNames = [], registry }) {
  return registry.getSingleMetric(name) ||
    new Gauge({ name, help, labelNames, registers: [registry] });
}

class MetricsCollectorV2 {
  constructor() {
    this.registry = new Registry();
    this.initMetrics();
    this.initResilienceMetrics();
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
   * Initialize resilience metrics (Circuit Breaker, Bottleneck, Retry, Fallback)
   */
  initResilienceMetrics() {
    // Circuit Breaker metrics
    this.cbState = getOrCreateGauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['name'],
      registry: this.registry,
    });

    this.cbEvents = getOrCreateCounter({
      name: 'circuit_breaker_events_total',
      help: 'Circuit breaker events',
      labelNames: ['name', 'event'],
      registry: this.registry,
    });

    // Bottleneck metrics
    this.blInFlight = getOrCreateGauge({
      name: 'bottleneck_inflight',
      help: 'Current in-flight requests',
      labelNames: ['name'],
      registry: this.registry,
    });

    this.blQueueSize = getOrCreateGauge({
      name: 'bottleneck_queue_size',
      help: 'Current queue size',
      labelNames: ['name'],
      registry: this.registry,
    });

    this.blRejected = getOrCreateCounter({
      name: 'bottleneck_rejected_total',
      help: 'Rejected requests due to full queue',
      labelNames: ['name'],
      registry: this.registry,
    });

    // Retry metrics
    this.retryAttempts = getOrCreateCounter({
      name: 'retry_attempts_total',
      help: 'Total retry attempts',
      labelNames: ['operation', 'reason'],
      registry: this.registry,
    });

    this.retryExhausted = getOrCreateCounter({
      name: 'retry_exhausted_total',
      help: 'Requests that exhausted retries',
      labelNames: ['operation', 'reason'],
      registry: this.registry,
    });

    // Model fallback metrics
    this.mfAttempts = getOrCreateCounter({
      name: 'model_fallback_attempts_total',
      help: 'Model fallback attempts',
      labelNames: ['operation', 'from', 'to', 'reason'],
      registry: this.registry,
    });

    this.mfExhausted = getOrCreateCounter({
      name: 'model_fallback_exhausted_total',
      help: 'Fallback chain exhausted',
      labelNames: ['operation'],
      registry: this.registry,
    });

    // Seed metrics with initial values (ensures they appear in /metrics immediately)
    this.seedResilienceMetrics();
  }

  /**
   * Seed resilience metrics with initial zero values
   * This ensures metrics appear in Prometheus even before any traffic
   */
  seedResilienceMetrics() {
    // run only once
    if (this._seededResilienceMetrics) return;
    this._seededResilienceMetrics = true;

    // if metrics are disabled, do nothing
    if (!featureFlags?.isEnabled?.('ENABLE_METRICS')) return;

    // Seed both 'default' and 'converse' series to match actual usage
    const names = ['default', 'converse'];

    names.forEach(name => {
      // Circuit Breaker: CLOSED = 0
      this.cbState.labels(name).set(0);

      // Bottleneck: start at zero
      this.blInFlight.labels(name).set(0);
      this.blQueueSize.labels(name).set(0);
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
   * Circuit Breaker - Set state
   */
  setCircuitBreakerState(name, stateStr) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    const map = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 };
    this.cbState.labels(name).set(map[stateStr] ?? -1);
    this.cbEvents.labels(name, 'state').inc();
  }

  /**
   * Circuit Breaker - Increment success
   */
  incrementCircuitBreakerSuccess(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'success').inc();
  }

  /**
   * Circuit Breaker - Increment failure
   */
  incrementCircuitBreakerFailure(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'failure').inc();
  }

  /**
   * Circuit Breaker - Increment rejection
   */
  incrementCircuitBreakerRejection(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'reject').inc();
  }

  /**
   * Circuit Breaker - Increment open event
   */
  incrementCircuitBreakerOpen(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'open').inc();
  }

  /**
   * Circuit Breaker - Increment half-open event
   */
  incrementCircuitBreakerHalfOpen(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'half_open').inc();
  }

  /**
   * Circuit Breaker - Increment close event
   */
  incrementCircuitBreakerClose(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.cbEvents.labels(name, 'close').inc();
  }

  /**
   * Bottleneck - Set in-flight count
   */
  setBottleneckInFlight(name, value) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.blInFlight.labels(name).set(value);
  }

  /**
   * Bottleneck - Set queue size
   */
  setBottleneckQueueSize(name, value) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.blQueueSize.labels(name).set(value);
  }

  /**
   * Bottleneck - Increment rejected
   */
  incrementBottleneckRejected(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.blRejected.labels(name).inc();
  }

  /**
   * Bottleneck - Increment completed
   */
  incrementBottleneckCompleted(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    // Currently no Counter metric for completed - could be added if needed
    // For now this is a no-op to prevent errors
  }

  /**
   * Bottleneck - Increment failed
   */
  incrementBottleneckFailed(name) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    // Currently no Counter metric for failed - could be added if needed
    // For now this is a no-op to prevent errors
  }

  /**
   * Retry - Increment attempt
   */
  incrementRetryAttempt(operation, reason) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.retryAttempts.labels(operation, reason).inc();
  }

  /**
   * Retry - Increment exhausted
   */
  incrementRetryExhausted(operation, reason) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.retryExhausted.labels(operation, reason).inc();
  }

  /**
   * Model Fallback - Increment attempt
   */
  incrementModelFallbackAttempt(operation, from, to, reason) {
    // Backward compat (1 arg): modelId only
    if (arguments.length === 1) {
      const toModel = operation;
      const op = "converse";
      const frm = "unknown";
      const rsn = "unknown";
      if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
      this.mfAttempts.labels(op, frm, String(toModel), rsn).inc();
      return;
    }
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.mfAttempts.labels(operation, from, to, reason).inc();
  }

  /**
   * Model Fallback - Increment exhausted
   */
  incrementModelFallbackExhausted(operation) {
    // Backward compat (0 args)
    if (arguments.length === 0) {
      operation = "converse";
    }
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.mfExhausted.labels(operation).inc();
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
