/**
 * ROM Agent - Request Logger Middleware
 * Adds traceId and requestId to all requests for observability
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

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

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      traceId: req.traceId,
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    });

    return originalSend.call(this, data);
  };

  next();
}

export { generateRequestId, generateTraceId };
