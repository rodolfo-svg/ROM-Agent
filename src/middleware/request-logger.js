/**
 * ROM Agent - Request Logger Middleware
 * Adds traceId and requestId to all requests for observability
 * Records Prometheus metrics via metrics-collector-v2
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import metricsCollector from '../utils/metrics-collector-v2.js';

/**
 * Generate unique request identifiers
 */
function generateRequestId() {
  return uuidv4();
}

function generateTraceId() {
  return uuidv4();
}

/**
 * Request logger middleware
 * Adds traceId and requestId to req object and logs all requests
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Skip metrics tracking for /metrics endpoint to avoid self-tracking
  const shouldTrackMetrics = req.path !== '/metrics';

  // Generate or reuse trace/request IDs
  req.traceId = req.headers['x-trace-id'] || generateTraceId();
  req.requestId = req.headers['x-request-id'] || generateRequestId();

  // Add to response headers for client tracking
  res.setHeader('X-Trace-Id', req.traceId);
  res.setHeader('X-Request-Id', req.requestId);

  // Log incoming request
  logger.info('Incoming request', {
    traceId: req.traceId,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response on finish event (works for res.send, res.json, res.end, etc.)
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Record Prometheus metrics (skip for /metrics endpoint)
    if (shouldTrackMetrics) {
      metricsCollector.incrementHttpRequest(req.method, req.path, res.statusCode);
      metricsCollector.recordHttpDuration(req.method, req.path, duration);
    }

    logger.info('Request completed', {
      traceId: req.traceId,
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    });
  });

  next();
}

export { generateRequestId, generateTraceId };
