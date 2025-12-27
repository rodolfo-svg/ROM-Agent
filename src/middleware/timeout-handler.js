/**
 * TIMEOUT HANDLER MIDDLEWARE
 *
 * Aplica timeouts automáticos baseados no tipo de rota (SLO config)
 * Registra métricas de SLO compliance
 */

import { SLO_CONFIG, getTimeout } from '../config/slo.js';
import logger from '../../lib/logger.js';

/**
 * Classifica rota baseado no path
 */
function classifyRoute(path) {
  // Fast routes (health checks, info)
  if (path.match(/^\/(health|metrics|api\/info|api\/stats|ping)/)) {
    return 'fast';
  }

  // Async routes (AI, generation)
  if (path.match(/\/api\/(chat|generate|ask|complete|stream)/)) {
    return 'async';
  }

  // Long routes (upload, batch)
  if (path.match(/\/api\/(upload|batch|process|export)/)) {
    return 'long';
  }

  // Default: sync routes
  return 'sync';
}

/**
 * Middleware: Aplica timeout baseado no tipo de rota
 */
export function timeoutMiddleware(req, res, next) {
  // Classificar rota
  const routeType = classifyRoute(req.path);
  const timeout = getTimeout('http', routeType);

  // Marcar início
  req._startTime = Date.now();
  req._routeType = routeType;
  req._timeout = timeout;

  // Criar timer de timeout
  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      const elapsed = Date.now() - req._startTime;

      // Log structured
      logger.warn('Request timeout', {
        path: req.path,
        method: req.method,
        routeType,
        timeout,
        elapsed,
        ip: req.ip
      });

      // Responder com 504 Gateway Timeout
      res.status(504).json({
        success: false,
        error: 'Request timeout',
        code: 'TIMEOUT',
        details: {
          timeout: `${timeout}ms`,
          routeType
        }
      });
    }
  }, timeout);

  // Cleanup ao finalizar resposta
  const originalEnd = res.end;
  res.end = function(...args) {
    clearTimeout(timeoutId);

    // Calcular latência
    const latency = Date.now() - req._startTime;
    req._latency = latency;

    // Log se excedeu SLO
    const sloTarget = SLO_CONFIG.sli.latencyP95.target;
    if (latency > sloTarget) {
      logger.warn('SLO latency exceeded', {
        path: req.path,
        method: req.method,
        routeType,
        latency,
        sloTarget,
        exceeded: latency - sloTarget
      });
    }

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Middleware: Validação de AbortSignal (para fetch/axios)
 */
export function abortSignalMiddleware(req, res, next) {
  // Criar AbortController
  const controller = new AbortController();
  req.abortController = controller;
  req.signal = controller.signal;

  // Abortar se request timeout
  const timeoutId = setTimeout(() => {
    controller.abort('Request timeout');
  }, req._timeout || 30_000);

  // Cleanup
  res.on('finish', () => {
    clearTimeout(timeoutId);
  });

  res.on('close', () => {
    clearTimeout(timeoutId);
    if (!res.finished) {
      controller.abort('Client disconnected');
    }
  });

  next();
}

/**
 * Middleware: SLO metrics collector
 */
export function sloMetricsMiddleware(req, res, next) {
  const originalEnd = res.end;

  res.end = function(...args) {
    // Coletar métricas de SLO
    const latency = req._latency || (Date.now() - req._startTime);
    const routeType = req._routeType || 'unknown';
    const statusCode = res.statusCode;

    // Incrementar contador de requests por tipo
    if (global.metricsCollector) {
      try {
        // Latency histogram
        global.metricsCollector.httpRequestDuration?.observe(
          {
            method: req.method,
            route: routeType,
            status: Math.floor(statusCode / 100) + 'xx'
          },
          latency / 1000  // segundos
        );

        // SLO compliance
        const withinSLO = latency <= SLO_CONFIG.sli.latencyP95.target;
        if (!withinSLO) {
          logger.debug('SLO miss', {
            path: req.path,
            latency,
            target: SLO_CONFIG.sli.latencyP95.target
          });
        }
      } catch (error) {
        // Ignorar erro de métricas
      }
    }

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Export middlewares
 */
export default {
  timeout: timeoutMiddleware,
  abortSignal: abortSignalMiddleware,
  sloMetrics: sloMetricsMiddleware
};
