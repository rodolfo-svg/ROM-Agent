/**
 * ROM Agent - Metrics Collector (Prometheus format)
 * Minimal metrics for observability without external dependencies
 */

import featureFlags from './feature-flags.js';

class MetricsCollector {
  constructor() {
    this.metrics = {
      http_requests_total: {},
      http_request_duration_seconds: {},
      bedrock_requests_total: 0,
      bedrock_tokens_total: 0,
      bedrock_cost_usd_total: 0,
      bedrock_errors_total: {},
      guardrails_triggered_total: {},
      active_requests: 0,
    };
  }

  /**
   * Increment HTTP request counter
   */
  incrementHttpRequest(method, path, status) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;

    const key = `${method}:${path}:${status}`;
    this.metrics.http_requests_total[key] = (this.metrics.http_requests_total[key] || 0) + 1;
  }

  /**
   * Record HTTP request duration
   */
  recordHttpDuration(method, path, durationMs) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;

    const key = `${method}:${path}`;
    if (!this.metrics.http_request_duration_seconds[key]) {
      this.metrics.http_request_duration_seconds[key] = {
        sum: 0,
        count: 0,
        buckets: {
          '0.1': 0,
          '0.5': 0,
          '1': 0,
          '5': 0,
          '10': 0,
          '30': 0,
          '60': 0,
          '+Inf': 0,
        },
      };
    }

    const durationSec = durationMs / 1000;
    const metric = this.metrics.http_request_duration_seconds[key];

    metric.sum += durationSec;
    metric.count += 1;

    // Update buckets
    if (durationSec <= 0.1) metric.buckets['0.1']++;
    if (durationSec <= 0.5) metric.buckets['0.5']++;
    if (durationSec <= 1) metric.buckets['1']++;
    if (durationSec <= 5) metric.buckets['5']++;
    if (durationSec <= 10) metric.buckets['10']++;
    if (durationSec <= 30) metric.buckets['30']++;
    if (durationSec <= 60) metric.buckets['60']++;
    metric.buckets['+Inf']++;
  }

  /**
   * Increment Bedrock request counter
   */
  incrementBedrockRequest() {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.bedrock_requests_total++;
  }

  /**
   * Add Bedrock tokens
   */
  addBedrockTokens(inputTokens, outputTokens) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.bedrock_tokens_total += (inputTokens + outputTokens);
  }

  /**
   * Add Bedrock cost
   */
  addBedrockCost(costUsd) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.bedrock_cost_usd_total += costUsd;
  }

  /**
   * Increment Bedrock error counter
   */
  incrementBedrockError(errorType) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.bedrock_errors_total[errorType] = (this.metrics.bedrock_errors_total[errorType] || 0) + 1;
  }

  /**
   * Increment guardrails triggered counter
   */
  incrementGuardrailsTriggered(reason) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.guardrails_triggered_total[reason] = (this.metrics.guardrails_triggered_total[reason] || 0) + 1;
  }

  /**
   * Set active requests gauge
   */
  setActiveRequests(count) {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) return;
    this.metrics.active_requests = count;
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportPrometheus() {
    if (!featureFlags.isEnabled('ENABLE_METRICS')) {
      return '# Metrics disabled\n';
    }

    let output = '';

    // HTTP requests total (counter)
    output += '# HELP http_requests_total Total HTTP requests\n';
    output += '# TYPE http_requests_total counter\n';
    for (const [key, value] of Object.entries(this.metrics.http_requests_total)) {
      const [method, path, status] = key.split(':');
      output += `http_requests_total{method="${method}",path="${path}",status="${status}"} ${value}\n`;
    }

    // HTTP request duration (histogram)
    output += '# HELP http_request_duration_seconds HTTP request duration\n';
    output += '# TYPE http_request_duration_seconds histogram\n';
    for (const [key, metric] of Object.entries(this.metrics.http_request_duration_seconds)) {
      const [method, path] = key.split(':');

      // Buckets
      for (const [le, count] of Object.entries(metric.buckets)) {
        output += `http_request_duration_seconds_bucket{method="${method}",path="${path}",le="${le}"} ${count}\n`;
      }

      // Sum and count
      output += `http_request_duration_seconds_sum{method="${method}",path="${path}"} ${metric.sum}\n`;
      output += `http_request_duration_seconds_count{method="${method}",path="${path}"} ${metric.count}\n`;
    }

    // Bedrock metrics
    output += '# HELP bedrock_requests_total Total Bedrock API requests\n';
    output += '# TYPE bedrock_requests_total counter\n';
    output += `bedrock_requests_total ${this.metrics.bedrock_requests_total}\n`;

    output += '# HELP bedrock_tokens_total Total Bedrock tokens (input + output)\n';
    output += '# TYPE bedrock_tokens_total counter\n';
    output += `bedrock_tokens_total ${this.metrics.bedrock_tokens_total}\n`;

    output += '# HELP bedrock_cost_usd_total Total Bedrock cost in USD\n';
    output += '# TYPE bedrock_cost_usd_total counter\n';
    output += `bedrock_cost_usd_total ${this.metrics.bedrock_cost_usd_total}\n`;

    // Bedrock errors (counter)
    output += '# HELP bedrock_errors_total Total Bedrock errors by type\n';
    output += '# TYPE bedrock_errors_total counter\n';
    for (const [errorType, count] of Object.entries(this.metrics.bedrock_errors_total)) {
      output += `bedrock_errors_total{error_type="${errorType}"} ${count}\n`;
    }

    // Guardrails (counter)
    output += '# HELP guardrails_triggered_total Total guardrails triggered\n';
    output += '# TYPE guardrails_triggered_total counter\n';
    for (const [reason, count] of Object.entries(this.metrics.guardrails_triggered_total)) {
      output += `guardrails_triggered_total{reason="${reason}"} ${count}\n`;
    }

    // Active requests (gauge)
    output += '# HELP rom_active_requests Currently active requests\n';
    output += '# TYPE rom_active_requests gauge\n';
    output += `rom_active_requests ${this.metrics.active_requests}\n`;

    // Node.js process metrics
    const memUsage = process.memoryUsage();
    output += '# HELP nodejs_heap_size_used_bytes Node.js heap used\n';
    output += '# TYPE nodejs_heap_size_used_bytes gauge\n';
    output += `nodejs_heap_size_used_bytes ${memUsage.heapUsed}\n`;

    output += '# HELP nodejs_heap_size_total_bytes Node.js heap total\n';
    output += '# TYPE nodejs_heap_size_total_bytes gauge\n';
    output += `nodejs_heap_size_total_bytes ${memUsage.heapTotal}\n`;

    return output;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    this.metrics = {
      http_requests_total: {},
      http_request_duration_seconds: {},
      bedrock_requests_total: 0,
      bedrock_tokens_total: 0,
      bedrock_cost_usd_total: 0,
      bedrock_errors_total: {},
      guardrails_triggered_total: {},
      active_requests: 0,
    };
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

export default metricsCollector;
export { MetricsCollector };
