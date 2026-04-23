// ════════════════════════════════════════════════════════════════
// ROM AGENT - USABILITY ANALYTICS SERVICE v1.0.0
// ════════════════════════════════════════════════════════════════
// Servico de analytics de usabilidade para aprendizado da IA
// Rastreia eventos, feedback, performance e erros
// ════════════════════════════════════════════════════════════════

import { getPostgresPool, safeQuery } from '../config/database.js';
import logger from '../../lib/logger.js';

/**
 * Event Categories
 */
export const EventCategory = {
  DOCUMENT: 'document',
  CHAT: 'chat',
  SEARCH: 'search',
  NAVIGATION: 'navigation',
  USER: 'user',
  SYSTEM: 'system',
  ERROR: 'error'
};

/**
 * Event Types
 */
export const EventType = {
  // Document events
  DOCUMENT_GENERATED: 'document_generated',
  DOCUMENT_EXPORTED: 'document_exported',
  DOCUMENT_SAVED: 'document_saved',
  DOCUMENT_COPIED: 'document_copied',

  // Chat events
  CHAT_MESSAGE_SENT: 'chat_message_sent',
  CHAT_RESPONSE_RECEIVED: 'chat_response_received',
  CHAT_STREAM_STARTED: 'chat_stream_started',
  CHAT_STREAM_COMPLETED: 'chat_stream_completed',

  // Search events
  JURISPRUDENCE_SEARCH: 'jurisprudence_search',
  LEGISLATION_SEARCH: 'legislation_search',
  DOCTRINE_SEARCH: 'doctrine_search',

  // Navigation events
  PAGE_VIEW: 'page_view',
  FEATURE_USED: 'feature_used',
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // User events
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',

  // Feedback events
  FEEDBACK_SUBMITTED: 'feedback_submitted',

  // Error events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error'
};

/**
 * Feedback Types
 */
export const FeedbackType = {
  THUMBS_UP: 'thumbs_up',
  THUMBS_DOWN: 'thumbs_down',
  RATING: 'rating',
  COMMENT: 'comment'
};

class UsabilityAnalyticsService {
  constructor() {
    this.pool = null;
    this.initialized = false;
    this.pendingEvents = [];
    this.flushInterval = null;
    this.batchSize = 50;
    this.flushIntervalMs = 5000; // 5 seconds
  }

  /**
   * Initialize the service
   */
  async init() {
    if (this.initialized) return;

    try {
      this.pool = getPostgresPool();

      if (!this.pool) {
        logger.warn('[UsabilityAnalytics] PostgreSQL not available, using in-memory fallback');
        this.initialized = true;
        return;
      }

      // Start batch flush interval
      this.flushInterval = setInterval(() => {
        this.flushPendingEvents();
      }, this.flushIntervalMs);

      this.initialized = true;
      logger.info('[UsabilityAnalytics] Service initialized');
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to initialize', { error: error.message });
      this.initialized = true; // Continue without DB
    }
  }

  /**
   * Track an analytics event
   *
   * @param {Object} params - Event parameters
   * @param {string} params.eventType - Type of event (from EventType)
   * @param {string} params.eventCategory - Category (from EventCategory)
   * @param {number|null} params.userId - User ID
   * @param {string|null} params.sessionId - Session ID
   * @param {Object} params.eventData - Additional event data
   * @param {number|null} params.responseTimeMs - Response time in ms
   * @param {number|null} params.tokensInput - Input tokens
   * @param {number|null} params.tokensOutput - Output tokens
   * @param {string|null} params.documentType - Document type generated
   * @param {string|null} params.areaDireito - Legal area
   * @param {string|null} params.modelUsed - AI model used
   */
  async trackEvent({
    eventType,
    eventCategory = EventCategory.SYSTEM,
    userId = null,
    sessionId = null,
    eventData = {},
    responseTimeMs = null,
    tokensInput = null,
    tokensOutput = null,
    documentType = null,
    areaDireito = null,
    modelUsed = null
  }) {
    await this.init();

    const event = {
      eventType,
      eventCategory,
      userId,
      sessionId,
      eventData,
      responseTimeMs,
      tokensInput,
      tokensOutput,
      documentType,
      areaDireito,
      modelUsed,
      timestamp: new Date()
    };

    // Add to pending events for batch insert
    this.pendingEvents.push(event);

    // Flush if batch size reached
    if (this.pendingEvents.length >= this.batchSize) {
      await this.flushPendingEvents();
    }

    return event;
  }

  /**
   * Flush pending events to database
   */
  async flushPendingEvents() {
    if (this.pendingEvents.length === 0) return;
    if (!this.pool) return;

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      // Build batch insert query
      const values = [];
      const placeholders = [];
      let paramIndex = 1;

      for (const event of events) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10})`);
        values.push(
          event.eventType,
          event.eventCategory,
          event.userId,
          event.sessionId,
          JSON.stringify(event.eventData),
          event.responseTimeMs,
          event.tokensInput,
          event.tokensOutput,
          event.documentType,
          event.areaDireito,
          event.modelUsed
        );
        paramIndex += 11;
      }

      const query = `
        INSERT INTO analytics_events
          (event_type, event_category, user_id, session_id, event_data, response_time_ms, tokens_input, tokens_output, document_type, area_direito, model_used)
        VALUES ${placeholders.join(', ')}
      `;

      await this.pool.query(query, values);
      logger.debug(`[UsabilityAnalytics] Flushed ${events.length} events to database`);
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to flush events', { error: error.message, eventCount: events.length });
      // Re-add events to pending queue on failure (with limit)
      if (this.pendingEvents.length < 500) {
        this.pendingEvents = events.concat(this.pendingEvents);
      }
    }
  }

  /**
   * Track document generation
   */
  async trackDocumentGeneration({
    userId,
    sessionId,
    documentType,
    areaDireito,
    modelUsed,
    responseTimeMs,
    tokensInput,
    tokensOutput,
    success = true,
    errorMessage = null
  }) {
    return this.trackEvent({
      eventType: EventType.DOCUMENT_GENERATED,
      eventCategory: EventCategory.DOCUMENT,
      userId,
      sessionId,
      eventData: { success, errorMessage },
      responseTimeMs,
      tokensInput,
      tokensOutput,
      documentType,
      areaDireito,
      modelUsed
    });
  }

  /**
   * Track chat message
   */
  async trackChatMessage({
    userId,
    sessionId,
    modelUsed,
    responseTimeMs,
    tokensInput,
    tokensOutput,
    messageLength,
    responseLength
  }) {
    return this.trackEvent({
      eventType: EventType.CHAT_RESPONSE_RECEIVED,
      eventCategory: EventCategory.CHAT,
      userId,
      sessionId,
      eventData: { messageLength, responseLength },
      responseTimeMs,
      tokensInput,
      tokensOutput,
      modelUsed
    });
  }

  /**
   * Track search
   */
  async trackSearch({
    userId,
    sessionId,
    searchType, // 'jurisprudencia', 'legislacao', 'doutrina'
    query,
    resultsCount,
    responseTimeMs
  }) {
    const eventTypeMap = {
      jurisprudencia: EventType.JURISPRUDENCE_SEARCH,
      legislacao: EventType.LEGISLATION_SEARCH,
      doutrina: EventType.DOCTRINE_SEARCH
    };

    return this.trackEvent({
      eventType: eventTypeMap[searchType] || EventType.JURISPRUDENCE_SEARCH,
      eventCategory: EventCategory.SEARCH,
      userId,
      sessionId,
      eventData: { query: query?.substring(0, 500), resultsCount },
      responseTimeMs
    });
  }

  /**
   * Submit feedback for a generation
   *
   * @param {Object} params - Feedback parameters
   * @param {number|null} params.eventId - ID of the event being rated
   * @param {number|null} params.userId - User ID
   * @param {string|null} params.sessionId - Session ID
   * @param {string} params.feedbackType - Type of feedback (from FeedbackType)
   * @param {number|null} params.rating - Rating (1-5)
   * @param {string|null} params.comment - Comment text
   * @param {string|null} params.documentType - Document type
   * @param {string|null} params.generationId - Generation ID for tracking
   * @param {Object} params.metadata - Additional metadata
   */
  async submitFeedback({
    eventId = null,
    userId = null,
    sessionId = null,
    feedbackType,
    rating = null,
    comment = null,
    documentType = null,
    generationId = null,
    metadata = {}
  }) {
    await this.init();

    if (!this.pool) {
      logger.warn('[UsabilityAnalytics] Cannot submit feedback - database not available');
      return null;
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO analytics_feedback
          (event_id, user_id, session_id, feedback_type, rating, comment, document_type, generation_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [eventId, userId, sessionId, feedbackType, rating, comment, documentType, generationId, JSON.stringify(metadata)]
      );

      logger.info(`[UsabilityAnalytics] Feedback submitted: ${feedbackType}`, { eventId, userId, feedbackType });
      return result.rows[0];
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to submit feedback', { error: error.message });
      return null;
    }
  }

  /**
   * Track an error
   */
  async trackError({
    errorType,
    errorCode = null,
    errorMessage,
    stackTrace = null,
    userId = null,
    sessionId = null,
    requestPath = null,
    requestMethod = null,
    documentType = null,
    modelUsed = null,
    requestData = {}
  }) {
    await this.init();

    if (!this.pool) {
      logger.warn('[UsabilityAnalytics] Cannot track error - database not available');
      return null;
    }

    try {
      // Sanitize request data (remove sensitive info)
      const sanitizedData = { ...requestData };
      delete sanitizedData.password;
      delete sanitizedData.token;
      delete sanitizedData.apiKey;
      delete sanitizedData.authorization;

      const result = await this.pool.query(
        `INSERT INTO analytics_errors
          (error_type, error_code, error_message, stack_trace, user_id, session_id, request_path, request_method, document_type, model_used, request_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [errorType, errorCode, errorMessage, stackTrace, userId, sessionId, requestPath, requestMethod, documentType, modelUsed, JSON.stringify(sanitizedData)]
      );

      logger.debug(`[UsabilityAnalytics] Error tracked: ${errorType}`, { errorCode, errorMessage });

      // Also track as event
      await this.trackEvent({
        eventType: EventType.ERROR_OCCURRED,
        eventCategory: EventCategory.ERROR,
        userId,
        sessionId,
        eventData: { errorType, errorCode, errorMessage },
        documentType,
        modelUsed
      });

      return result.rows[0];
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to track error', { error: error.message });
      return null;
    }
  }

  /**
   * Track or update session
   */
  async trackSession({
    sessionId,
    userId = null,
    action = 'activity', // 'start', 'end', 'activity'
    userAgent = null,
    ipAddress = null,
    referrer = null
  }) {
    await this.init();

    if (!this.pool) return null;

    try {
      if (action === 'start') {
        const result = await this.pool.query(
          `INSERT INTO analytics_sessions
            (session_id, user_id, user_agent, ip_address, referrer)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id) DO UPDATE SET
             last_activity_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [sessionId, userId, userAgent, ipAddress, referrer]
        );
        return result.rows[0];
      } else if (action === 'end') {
        const result = await this.pool.query(
          `UPDATE analytics_sessions
           SET ended_at = CURRENT_TIMESTAMP,
               duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))::INTEGER
           WHERE session_id = $1
           RETURNING *`,
          [sessionId]
        );
        return result.rows[0];
      } else {
        // Just update activity timestamp
        await this.pool.query(
          `UPDATE analytics_sessions
           SET last_activity_at = CURRENT_TIMESTAMP
           WHERE session_id = $1`,
          [sessionId]
        );
        return { sessionId, updated: true };
      }
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to track session', { error: error.message, sessionId });
      return null;
    }
  }

  /**
   * Increment session metrics
   */
  async incrementSessionMetric(sessionId, metric) {
    await this.init();

    if (!this.pool) return;

    const validMetrics = ['page_views', 'documents_generated', 'chat_messages'];
    if (!validMetrics.includes(metric)) return;

    try {
      await this.pool.query(
        `UPDATE analytics_sessions
         SET ${metric} = ${metric} + 1,
             last_activity_at = CURRENT_TIMESTAMP
         WHERE session_id = $1`,
        [sessionId]
      );
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to increment session metric', { error: error.message, sessionId, metric });
    }
  }

  // ============================================================================
  // QUERY METHODS FOR ADMIN ANALYTICS
  // ============================================================================

  /**
   * Get analytics overview
   */
  async getOverview(days = 30) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      const [
        totalEventsResult,
        documentStatsResult,
        feedbackStatsResult,
        errorStatsResult,
        activeUsersResult
      ] = await Promise.all([
        // Total events
        this.pool.query(
          `SELECT COUNT(*) as total,
                  COUNT(DISTINCT user_id) as unique_users,
                  COUNT(DISTINCT session_id) as unique_sessions
           FROM analytics_events
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'`,
          [days]
        ),

        // Document stats
        this.pool.query(
          `SELECT document_type,
                  COUNT(*) as count,
                  AVG(response_time_ms)::INTEGER as avg_response_time,
                  SUM(tokens_input)::BIGINT as total_input_tokens,
                  SUM(tokens_output)::BIGINT as total_output_tokens
           FROM analytics_events
           WHERE event_type = 'document_generated'
             AND created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           GROUP BY document_type
           ORDER BY count DESC
           LIMIT 10`,
          [days]
        ),

        // Feedback stats
        this.pool.query(
          `SELECT feedback_type,
                  COUNT(*) as count
           FROM analytics_feedback
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           GROUP BY feedback_type`,
          [days]
        ),

        // Error stats
        this.pool.query(
          `SELECT error_type,
                  COUNT(*) as count
           FROM analytics_errors
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
             AND resolved = FALSE
           GROUP BY error_type
           ORDER BY count DESC
           LIMIT 10`,
          [days]
        ),

        // Active users by day
        this.pool.query(
          `SELECT DATE(created_at) as date,
                  COUNT(DISTINCT user_id) as active_users,
                  COUNT(*) as event_count
           FROM analytics_events
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           GROUP BY DATE(created_at)
           ORDER BY date DESC`,
          [days]
        )
      ]);

      const feedbackStats = feedbackStatsResult.rows.reduce((acc, row) => {
        acc[row.feedback_type] = parseInt(row.count);
        return acc;
      }, {});

      return {
        period: `${days} days`,
        summary: {
          totalEvents: parseInt(totalEventsResult.rows[0]?.total || 0),
          uniqueUsers: parseInt(totalEventsResult.rows[0]?.unique_users || 0),
          uniqueSessions: parseInt(totalEventsResult.rows[0]?.unique_sessions || 0)
        },
        topDocuments: documentStatsResult.rows,
        feedback: {
          thumbsUp: feedbackStats.thumbs_up || 0,
          thumbsDown: feedbackStats.thumbs_down || 0,
          ratings: feedbackStats.rating || 0,
          comments: feedbackStats.comment || 0,
          approvalRate: feedbackStats.thumbs_up && (feedbackStats.thumbs_up + feedbackStats.thumbs_down) > 0
            ? ((feedbackStats.thumbs_up / (feedbackStats.thumbs_up + feedbackStats.thumbs_down)) * 100).toFixed(1)
            : null
        },
        unresolvedErrors: errorStatsResult.rows,
        dailyActivity: activeUsersResult.rows
      };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get overview', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get usage statistics by period
   */
  async getUsageByPeriod({
    startDate,
    endDate,
    groupBy = 'day', // 'hour', 'day', 'week', 'month'
    eventType = null,
    documentType = null
  }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    const dateFormat = {
      hour: "DATE_TRUNC('hour', created_at)",
      day: "DATE(created_at)",
      week: "DATE_TRUNC('week', created_at)",
      month: "DATE_TRUNC('month', created_at)"
    };

    const dateTrunc = dateFormat[groupBy] || dateFormat.day;

    try {
      let query = `
        SELECT ${dateTrunc} as period,
               COUNT(*) as event_count,
               COUNT(DISTINCT user_id) as unique_users,
               COUNT(DISTINCT session_id) as unique_sessions,
               AVG(response_time_ms)::INTEGER as avg_response_time,
               SUM(tokens_input)::BIGINT as total_input_tokens,
               SUM(tokens_output)::BIGINT as total_output_tokens
        FROM analytics_events
        WHERE created_at BETWEEN $1 AND $2
      `;

      const params = [startDate, endDate];
      let paramIndex = 3;

      if (eventType) {
        query += ` AND event_type = $${paramIndex}`;
        params.push(eventType);
        paramIndex++;
      }

      if (documentType) {
        query += ` AND document_type = $${paramIndex}`;
        params.push(documentType);
      }

      query += ` GROUP BY ${dateTrunc} ORDER BY period DESC`;

      const result = await this.pool.query(query, params);
      return { data: result.rows, groupBy, startDate, endDate };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get usage by period', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get all feedback with pagination
   */
  async getFeedback({
    page = 1,
    limit = 50,
    feedbackType = null,
    documentType = null,
    startDate = null,
    endDate = null
  }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      let query = `
        SELECT f.*,
               e.event_type,
               e.document_type as event_document_type,
               e.area_direito,
               e.model_used,
               e.response_time_ms
        FROM analytics_feedback f
        LEFT JOIN analytics_events e ON f.event_id = e.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (feedbackType) {
        query += ` AND f.feedback_type = $${paramIndex}`;
        params.push(feedbackType);
        paramIndex++;
      }

      if (documentType) {
        query += ` AND (f.document_type = $${paramIndex} OR e.document_type = $${paramIndex})`;
        params.push(documentType);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND f.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND f.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Count total
      const countResult = await this.pool.query(
        query.replace('SELECT f.*,', 'SELECT COUNT(*) as total FROM (SELECT f.id').replace(/LEFT JOIN[\s\S]*WHERE/, ' WHERE') + ') subquery',
        params
      );

      // Add pagination
      const offset = (page - 1) * limit;
      query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0]?.total || result.rows.length),
          pages: Math.ceil((countResult.rows[0]?.total || result.rows.length) / limit)
        }
      };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get feedback', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get most common errors
   */
  async getTopErrors({ days = 30, limit = 20 }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      const result = await this.pool.query(
        `SELECT error_type,
                error_code,
                error_message,
                COUNT(*) as occurrence_count,
                COUNT(DISTINCT user_id) as affected_users,
                MAX(created_at) as last_occurrence,
                MIN(created_at) as first_occurrence
         FROM analytics_errors
         WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
         GROUP BY error_type, error_code, error_message
         ORDER BY occurrence_count DESC
         LIMIT $2`,
        [days, limit]
      );

      return { data: result.rows, period: `${days} days` };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get top errors', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get document generation performance by type
   */
  async getDocumentPerformance({ days = 30 }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      const result = await this.pool.query(
        `SELECT document_type,
                area_direito,
                COUNT(*) as generation_count,
                AVG(response_time_ms)::INTEGER as avg_response_time,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p50_response_time,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p95_response_time,
                MIN(response_time_ms) as min_response_time,
                MAX(response_time_ms) as max_response_time,
                AVG(tokens_input)::INTEGER as avg_input_tokens,
                AVG(tokens_output)::INTEGER as avg_output_tokens,
                COUNT(DISTINCT user_id) as unique_users
         FROM analytics_events
         WHERE event_type = 'document_generated'
           AND created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
         GROUP BY document_type, area_direito
         ORDER BY generation_count DESC`,
        [days]
      );

      return { data: result.rows, period: `${days} days` };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get document performance', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats({ days = 30 }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      const result = await this.pool.query(
        `SELECT DATE(started_at) as date,
                COUNT(*) as session_count,
                AVG(duration_seconds)::INTEGER as avg_duration_seconds,
                AVG(page_views)::NUMERIC(10,2) as avg_page_views,
                AVG(documents_generated)::NUMERIC(10,2) as avg_documents,
                AVG(chat_messages)::NUMERIC(10,2) as avg_chat_messages
         FROM analytics_sessions
         WHERE started_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           AND duration_seconds IS NOT NULL
         GROUP BY DATE(started_at)
         ORDER BY date DESC`,
        [days]
      );

      return { data: result.rows, period: `${days} days` };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get session stats', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get AI learning insights - patterns for improvement
   */
  async getAILearningInsights({ days = 30 }) {
    await this.init();

    if (!this.pool) {
      return { error: 'Database not available', fallback: true };
    }

    try {
      const [
        lowRatedDocuments,
        highErrorDocuments,
        slowDocuments,
        popularFeatures
      ] = await Promise.all([
        // Documents with most negative feedback
        this.pool.query(
          `SELECT f.document_type,
                  COUNT(*) FILTER (WHERE f.feedback_type = 'thumbs_down') as thumbs_down,
                  COUNT(*) FILTER (WHERE f.feedback_type = 'thumbs_up') as thumbs_up,
                  ARRAY_AGG(DISTINCT f.comment) FILTER (WHERE f.comment IS NOT NULL) as comments
           FROM analytics_feedback f
           WHERE f.created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           GROUP BY f.document_type
           HAVING COUNT(*) FILTER (WHERE f.feedback_type = 'thumbs_down') > 0
           ORDER BY thumbs_down DESC
           LIMIT 10`,
          [days]
        ),

        // Document types with most errors
        this.pool.query(
          `SELECT document_type,
                  error_type,
                  COUNT(*) as error_count,
                  ARRAY_AGG(DISTINCT error_message) as error_messages
           FROM analytics_errors
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
             AND document_type IS NOT NULL
           GROUP BY document_type, error_type
           ORDER BY error_count DESC
           LIMIT 10`,
          [days]
        ),

        // Slowest document types
        this.pool.query(
          `SELECT document_type,
                  AVG(response_time_ms)::INTEGER as avg_time,
                  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p95_time,
                  COUNT(*) as count
           FROM analytics_events
           WHERE event_type = 'document_generated'
             AND created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
             AND response_time_ms IS NOT NULL
           GROUP BY document_type
           HAVING COUNT(*) >= 5
           ORDER BY avg_time DESC
           LIMIT 10`,
          [days]
        ),

        // Most used features
        this.pool.query(
          `SELECT event_type,
                  document_type,
                  area_direito,
                  COUNT(*) as usage_count,
                  COUNT(DISTINCT user_id) as unique_users
           FROM analytics_events
           WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
           GROUP BY event_type, document_type, area_direito
           ORDER BY usage_count DESC
           LIMIT 20`,
          [days]
        )
      ]);

      return {
        period: `${days} days`,
        insights: {
          lowRatedDocuments: lowRatedDocuments.rows,
          highErrorDocuments: highErrorDocuments.rows,
          slowDocuments: slowDocuments.rows,
          popularFeatures: popularFeatures.rows
        },
        recommendations: this.generateRecommendations({
          lowRated: lowRatedDocuments.rows,
          errors: highErrorDocuments.rows,
          slow: slowDocuments.rows
        })
      };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Failed to get AI learning insights', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Generate recommendations based on analytics data
   */
  generateRecommendations({ lowRated, errors, slow }) {
    const recommendations = [];

    // Low-rated documents
    if (lowRated && lowRated.length > 0) {
      lowRated.forEach(doc => {
        if (doc.thumbs_down > doc.thumbs_up) {
          recommendations.push({
            priority: 'high',
            type: 'quality_improvement',
            target: doc.document_type,
            message: `Document type "${doc.document_type}" has more negative than positive feedback. Review prompt and output quality.`,
            userComments: doc.comments?.filter(c => c).slice(0, 5) || []
          });
        }
      });
    }

    // Error-prone documents
    if (errors && errors.length > 0) {
      errors.forEach(err => {
        if (err.error_count >= 5) {
          recommendations.push({
            priority: 'high',
            type: 'error_fix',
            target: err.document_type,
            message: `Document type "${err.document_type}" has ${err.error_count} errors of type "${err.error_type}". Investigate and fix.`,
            errorSamples: err.error_messages?.slice(0, 3) || []
          });
        }
      });
    }

    // Slow documents
    if (slow && slow.length > 0) {
      slow.forEach(doc => {
        if (doc.p95_time > 30000) { // > 30 seconds
          recommendations.push({
            priority: 'medium',
            type: 'performance_optimization',
            target: doc.document_type,
            message: `Document type "${doc.document_type}" has P95 response time of ${doc.p95_time}ms. Consider optimization.`,
            metrics: { avgTime: doc.avg_time, p95Time: doc.p95_time, count: doc.count }
          });
        }
      });
    }

    return recommendations;
  }

  /**
   * Cleanup old events (for GDPR/LGPD compliance)
   */
  async cleanupOldEvents(retentionDays = 365) {
    await this.init();

    if (!this.pool) return { error: 'Database not available' };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const results = await Promise.all([
        this.pool.query(
          'DELETE FROM analytics_events WHERE created_at < $1',
          [cutoffDate]
        ),
        this.pool.query(
          'DELETE FROM analytics_feedback WHERE created_at < $1',
          [cutoffDate]
        ),
        this.pool.query(
          'DELETE FROM analytics_errors WHERE created_at < $1',
          [cutoffDate]
        ),
        this.pool.query(
          'DELETE FROM analytics_sessions WHERE started_at < $1',
          [cutoffDate]
        )
      ]);

      const totalDeleted = results.reduce((sum, r) => sum + (r.rowCount || 0), 0);
      logger.info(`[UsabilityAnalytics] Cleaned up ${totalDeleted} old records`);

      return { success: true, deletedRecords: totalDeleted, cutoffDate };
    } catch (error) {
      logger.error('[UsabilityAnalytics] Cleanup failed', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushPendingEvents();
    logger.info('[UsabilityAnalytics] Service shutdown complete');
  }
}

// Singleton instance
const usabilityAnalytics = new UsabilityAnalyticsService();

export default usabilityAnalytics;
export { UsabilityAnalyticsService };
