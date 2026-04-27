// ════════════════════════════════════════════════════════════════
// ROM AGENT - ANALYTICS ROUTES v1.0.0
// ════════════════════════════════════════════════════════════════
// Endpoints para tracking de eventos e relatorios de analytics
// ════════════════════════════════════════════════════════════════

import express from 'express';
import usabilityAnalytics, {
  EventType,
  EventCategory,
  FeedbackType
} from '../services/usability-analytics-service.js';
import logger from '../../lib/logger.js';

const router = express.Router();

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Admin authentication middleware
 */
const requireAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    logger.error('ADMIN_TOKEN not configured');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured'
    });
  }

  if (!token || token !== adminToken) {
    logger.warn('Unauthorized admin access attempt to analytics', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing X-Admin-Token'
    });
  }

  next();
};

/**
 * Extract user and session info from request
 */
const extractContext = (req) => {
  return {
    userId: req.session?.user?.id || null,
    sessionId: req.sessionID || req.headers['x-session-id'] || null,
    userAgent: req.headers['user-agent'] || null,
    ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null
  };
};

// ============================================================================
// PUBLIC ENDPOINTS - User Analytics
// ============================================================================

/**
 * GET /api/analytics/summary
 * Get analytics summary for current authenticated user
 * Returns basic stats without requiring admin token
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const period = req.query.period || '7d'; // Default: last 7 days

    // Calcular período
    let days = 7;
    if (period === '30d') days = 30;
    else if (period === '24h') days = 1;
    else if (period === '90d') days = 90;

    // Buscar overview geral (método que existe no service)
    const overview = await usabilityAnalytics.getOverview(days);

    // Se usuário autenticado, incluir userId na resposta
    if (userId) {
      return res.json({
        success: true,
        period: `${days}d`,
        userId,
        stats: {
          totalEvents: overview.summary?.totalEvents || 0,
          uniqueUsers: overview.summary?.uniqueUsers || 0,
          uniqueSessions: overview.summary?.uniqueSessions || 0,
          topDocuments: overview.topDocuments || [],
          feedback: overview.feedback || {},
          dailyActivity: overview.dailyActivity || []
        }
      });
    }

    // Para usuários não autenticados, retornar stats gerais (limitadas)
    res.json({
      success: true,
      period: `${days}d`,
      message: 'Faça login para ver estatísticas detalhadas',
      stats: {
        available: false
      }
    });

  } catch (error) {
    logger.error('Failed to get analytics summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics summary'
    });
  }
});

// ============================================================================
// PUBLIC ENDPOINTS - Event Tracking
// ============================================================================

/**
 * POST /api/analytics/event
 * Register an analytics event
 *
 * Body:
 * {
 *   eventType: string (required),
 *   eventCategory: string (optional, default: 'general'),
 *   eventData: object (optional),
 *   responseTimeMs: number (optional),
 *   tokensInput: number (optional),
 *   tokensOutput: number (optional),
 *   documentType: string (optional),
 *   areaDireito: string (optional),
 *   modelUsed: string (optional)
 * }
 */
router.post('/event', async (req, res) => {
  try {
    const context = extractContext(req);
    const {
      eventType,
      eventCategory = EventCategory.SYSTEM,
      eventData = {},
      responseTimeMs,
      tokensInput,
      tokensOutput,
      documentType,
      areaDireito,
      modelUsed
    } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required'
      });
    }

    const event = await usabilityAnalytics.trackEvent({
      eventType,
      eventCategory,
      userId: context.userId,
      sessionId: context.sessionId,
      eventData,
      responseTimeMs,
      tokensInput,
      tokensOutput,
      documentType,
      areaDireito,
      modelUsed
    });

    res.json({
      success: true,
      event: {
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        timestamp: event.timestamp
      }
    });
  } catch (error) {
    logger.error('Failed to track event', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
});

/**
 * POST /api/analytics/feedback
 * Submit feedback for a generation
 *
 * Body:
 * {
 *   eventId: number (optional),
 *   feedbackType: 'thumbs_up' | 'thumbs_down' | 'rating' | 'comment' (required),
 *   rating: number 1-5 (optional, required for rating type),
 *   comment: string (optional),
 *   documentType: string (optional),
 *   generationId: string (optional),
 *   metadata: object (optional)
 * }
 */
router.post('/feedback', async (req, res) => {
  try {
    const context = extractContext(req);
    const {
      eventId,
      feedbackType,
      rating,
      comment,
      documentType,
      generationId,
      metadata = {}
    } = req.body;

    if (!feedbackType || !Object.values(FeedbackType).includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        error: `feedbackType must be one of: ${Object.values(FeedbackType).join(', ')}`
      });
    }

    if (feedbackType === FeedbackType.RATING && (!rating || rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'rating must be between 1 and 5 for rating feedback type'
      });
    }

    const feedback = await usabilityAnalytics.submitFeedback({
      eventId,
      userId: context.userId,
      sessionId: context.sessionId,
      feedbackType,
      rating,
      comment,
      documentType,
      generationId,
      metadata
    });

    if (!feedback) {
      return res.status(500).json({
        success: false,
        error: 'Failed to submit feedback - database may be unavailable'
      });
    }

    res.json({
      success: true,
      feedback: {
        id: feedback.id,
        feedbackType: feedback.feedback_type,
        createdAt: feedback.created_at
      }
    });
  } catch (error) {
    logger.error('Failed to submit feedback', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
});

/**
 * POST /api/analytics/session/start
 * Start tracking a session
 */
router.post('/session/start', async (req, res) => {
  try {
    const context = extractContext(req);

    if (!context.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'No session ID available'
      });
    }

    const session = await usabilityAnalytics.trackSession({
      sessionId: context.sessionId,
      userId: context.userId,
      action: 'start',
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      referrer: req.headers['referer'] || null
    });

    res.json({
      success: true,
      session: {
        sessionId: context.sessionId,
        startedAt: session?.started_at
      }
    });
  } catch (error) {
    logger.error('Failed to start session tracking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start session tracking'
    });
  }
});

/**
 * POST /api/analytics/session/end
 * End tracking a session
 */
router.post('/session/end', async (req, res) => {
  try {
    const context = extractContext(req);

    if (!context.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'No session ID available'
      });
    }

    const session = await usabilityAnalytics.trackSession({
      sessionId: context.sessionId,
      userId: context.userId,
      action: 'end'
    });

    res.json({
      success: true,
      session: {
        sessionId: context.sessionId,
        endedAt: session?.ended_at,
        durationSeconds: session?.duration_seconds
      }
    });
  } catch (error) {
    logger.error('Failed to end session tracking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to end session tracking'
    });
  }
});

/**
 * POST /api/analytics/error
 * Track an error event
 *
 * Body:
 * {
 *   errorType: string (required),
 *   errorCode: string (optional),
 *   errorMessage: string (required),
 *   stackTrace: string (optional),
 *   requestPath: string (optional),
 *   requestMethod: string (optional),
 *   documentType: string (optional),
 *   modelUsed: string (optional),
 *   requestData: object (optional, sensitive data will be sanitized)
 * }
 */
router.post('/error', async (req, res) => {
  try {
    const context = extractContext(req);
    const {
      errorType,
      errorCode,
      errorMessage,
      stackTrace,
      requestPath,
      requestMethod,
      documentType,
      modelUsed,
      requestData = {}
    } = req.body;

    if (!errorType || !errorMessage) {
      return res.status(400).json({
        success: false,
        error: 'errorType and errorMessage are required'
      });
    }

    const error = await usabilityAnalytics.trackError({
      errorType,
      errorCode,
      errorMessage,
      stackTrace,
      userId: context.userId,
      sessionId: context.sessionId,
      requestPath,
      requestMethod,
      documentType,
      modelUsed,
      requestData
    });

    res.json({
      success: true,
      tracked: !!error
    });
  } catch (error) {
    logger.error('Failed to track error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to track error'
    });
  }
});

// ============================================================================
// ADMIN ENDPOINTS - Analytics Reports
// ============================================================================

/**
 * GET /api/admin/analytics/overview
 * Get analytics overview summary
 *
 * Query params:
 * - days: number (default: 30)
 */
router.get('/admin/overview', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const overview = await usabilityAnalytics.getOverview(days);

    if (overview.error) {
      return res.status(500).json({
        success: false,
        error: overview.error
      });
    }

    res.json({
      success: true,
      ...overview
    });
  } catch (error) {
    logger.error('Failed to get analytics overview', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview'
    });
  }
});

/**
 * GET /api/admin/analytics/usage
 * Get usage statistics by period
 *
 * Query params:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - groupBy: 'hour' | 'day' | 'week' | 'month' (default: 'day')
 * - eventType: string (optional)
 * - documentType: string (optional)
 */
router.get('/admin/usage', requireAdminToken, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      groupBy = 'day',
      eventType,
      documentType
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const usage = await usabilityAnalytics.getUsageByPeriod({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      groupBy,
      eventType,
      documentType
    });

    if (usage.error) {
      return res.status(500).json({
        success: false,
        error: usage.error
      });
    }

    res.json({
      success: true,
      ...usage
    });
  } catch (error) {
    logger.error('Failed to get usage statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

/**
 * GET /api/admin/analytics/feedback
 * Get all feedback with pagination and filters
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 50)
 * - feedbackType: string (optional)
 * - documentType: string (optional)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 */
router.get('/admin/feedback', requireAdminToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      feedbackType,
      documentType,
      startDate,
      endDate
    } = req.query;

    const feedback = await usabilityAnalytics.getFeedback({
      page: parseInt(page),
      limit: parseInt(limit),
      feedbackType,
      documentType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });

    if (feedback.error) {
      return res.status(500).json({
        success: false,
        error: feedback.error
      });
    }

    res.json({
      success: true,
      ...feedback
    });
  } catch (error) {
    logger.error('Failed to get feedback', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get feedback'
    });
  }
});

/**
 * GET /api/admin/analytics/errors
 * Get most common errors
 *
 * Query params:
 * - days: number (default: 30)
 * - limit: number (default: 20)
 */
router.get('/admin/errors', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 20;

    const errors = await usabilityAnalytics.getTopErrors({ days, limit });

    if (errors.error) {
      return res.status(500).json({
        success: false,
        error: errors.error
      });
    }

    res.json({
      success: true,
      ...errors
    });
  } catch (error) {
    logger.error('Failed to get error statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get error statistics'
    });
  }
});

/**
 * GET /api/admin/analytics/documents
 * Get document generation performance statistics
 *
 * Query params:
 * - days: number (default: 30)
 */
router.get('/admin/documents', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const performance = await usabilityAnalytics.getDocumentPerformance({ days });

    if (performance.error) {
      return res.status(500).json({
        success: false,
        error: performance.error
      });
    }

    res.json({
      success: true,
      ...performance
    });
  } catch (error) {
    logger.error('Failed to get document performance', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get document performance'
    });
  }
});

/**
 * GET /api/admin/analytics/sessions
 * Get session statistics
 *
 * Query params:
 * - days: number (default: 30)
 */
router.get('/admin/sessions', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const sessions = await usabilityAnalytics.getSessionStats({ days });

    if (sessions.error) {
      return res.status(500).json({
        success: false,
        error: sessions.error
      });
    }

    res.json({
      success: true,
      ...sessions
    });
  } catch (error) {
    logger.error('Failed to get session statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get session statistics'
    });
  }
});

/**
 * GET /api/admin/analytics/insights
 * Get AI learning insights and recommendations
 *
 * Query params:
 * - days: number (default: 30)
 */
router.get('/admin/insights', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const insights = await usabilityAnalytics.getAILearningInsights({ days });

    if (insights.error) {
      return res.status(500).json({
        success: false,
        error: insights.error
      });
    }

    res.json({
      success: true,
      ...insights
    });
  } catch (error) {
    logger.error('Failed to get AI insights', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get AI insights'
    });
  }
});

/**
 * POST /api/admin/analytics/cleanup
 * Clean up old analytics data (GDPR/LGPD compliance)
 *
 * Body:
 * {
 *   retentionDays: number (default: 365)
 * }
 */
router.post('/admin/cleanup', requireAdminToken, async (req, res) => {
  try {
    const { retentionDays = 365 } = req.body;

    if (retentionDays < 30) {
      return res.status(400).json({
        success: false,
        error: 'retentionDays must be at least 30'
      });
    }

    const result = await usabilityAnalytics.cleanupOldEvents(retentionDays);

    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to cleanup analytics data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup analytics data'
    });
  }
});

/**
 * GET /api/admin/analytics/event-types
 * Get available event types and categories
 */
router.get('/admin/event-types', requireAdminToken, (req, res) => {
  res.json({
    success: true,
    eventTypes: EventType,
    eventCategories: EventCategory,
    feedbackTypes: FeedbackType
  });
});

export default router;
