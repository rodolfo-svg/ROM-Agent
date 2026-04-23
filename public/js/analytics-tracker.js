/**
 * ROM Agent - Analytics Tracker
 * Client-side analytics tracking for usability metrics
 *
 * @version 1.0.0
 */

(function(window) {
  'use strict';

  // Configuration
  const CONFIG = {
    endpoint: '/api/analytics',
    batchSize: 10,
    flushInterval: 10000, // 10 seconds
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    debug: false
  };

  // Event queue for batching
  let eventQueue = [];
  let flushTimer = null;
  let sessionStarted = false;
  let lastActivity = Date.now();

  // Event Types (matching backend)
  const EventType = {
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

    // Feedback events
    FEEDBACK_SUBMITTED: 'feedback_submitted',

    // Error events
    ERROR_OCCURRED: 'error_occurred'
  };

  // Event Categories
  const EventCategory = {
    DOCUMENT: 'document',
    CHAT: 'chat',
    SEARCH: 'search',
    NAVIGATION: 'navigation',
    USER: 'user',
    SYSTEM: 'system',
    ERROR: 'error'
  };

  // Feedback Types
  const FeedbackType = {
    THUMBS_UP: 'thumbs_up',
    THUMBS_DOWN: 'thumbs_down',
    RATING: 'rating',
    COMMENT: 'comment'
  };

  /**
   * Log debug message
   */
  function debug(...args) {
    if (CONFIG.debug) {
      console.log('[Analytics]', ...args);
    }
  }

  /**
   * Get or generate session ID
   */
  function getSessionId() {
    let sessionId = sessionStorage.getItem('rom_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('rom_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Track an event
   *
   * @param {string} eventType - Type of event
   * @param {string} eventCategory - Category of event
   * @param {Object} eventData - Additional data
   * @param {Object} options - Additional options (responseTimeMs, documentType, etc.)
   */
  function trackEvent(eventType, eventCategory = EventCategory.SYSTEM, eventData = {}, options = {}) {
    const event = {
      eventType,
      eventCategory,
      eventData,
      ...options,
      timestamp: new Date().toISOString()
    };

    eventQueue.push(event);
    lastActivity = Date.now();

    debug('Event queued:', eventType, eventData);

    // Flush if queue is full
    if (eventQueue.length >= CONFIG.batchSize) {
      flushEvents();
    }
  }

  /**
   * Flush events to server
   */
  async function flushEvents() {
    if (eventQueue.length === 0) return;

    const events = [...eventQueue];
    eventQueue = [];

    debug('Flushing', events.length, 'events');

    // Send events one by one (could be optimized to batch endpoint)
    for (const event of events) {
      try {
        await fetch(CONFIG.endpoint + '/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event),
          credentials: 'include'
        });
      } catch (error) {
        debug('Failed to send event:', error);
        // Re-queue failed events (with limit)
        if (eventQueue.length < 100) {
          eventQueue.push(event);
        }
      }
    }
  }

  /**
   * Start session tracking
   */
  async function startSession() {
    if (sessionStarted) return;

    try {
      await fetch(CONFIG.endpoint + '/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      sessionStarted = true;
      debug('Session started');

      // Track initial page view
      trackPageView();
    } catch (error) {
      debug('Failed to start session:', error);
    }
  }

  /**
   * End session tracking
   */
  async function endSession() {
    if (!sessionStarted) return;

    // Flush any pending events
    await flushEvents();

    try {
      await fetch(CONFIG.endpoint + '/session/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      sessionStarted = false;
      debug('Session ended');
    } catch (error) {
      debug('Failed to end session:', error);
    }
  }

  /**
   * Track page view
   */
  function trackPageView(pageName = null) {
    const page = pageName || window.location.pathname;
    trackEvent(EventType.PAGE_VIEW, EventCategory.NAVIGATION, {
      page,
      title: document.title,
      referrer: document.referrer,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    });
  }

  /**
   * Track document generation
   *
   * @param {string} documentType - Type of document generated
   * @param {Object} options - Additional options
   */
  function trackDocumentGeneration(documentType, options = {}) {
    trackEvent(EventType.DOCUMENT_GENERATED, EventCategory.DOCUMENT, {
      success: options.success !== false,
      errorMessage: options.errorMessage || null
    }, {
      documentType,
      areaDireito: options.areaDireito || null,
      modelUsed: options.modelUsed || null,
      responseTimeMs: options.responseTimeMs || null,
      tokensInput: options.tokensInput || null,
      tokensOutput: options.tokensOutput || null
    });
  }

  /**
   * Track chat message
   *
   * @param {Object} options - Message options
   */
  function trackChatMessage(options = {}) {
    trackEvent(EventType.CHAT_RESPONSE_RECEIVED, EventCategory.CHAT, {
      messageLength: options.messageLength || 0,
      responseLength: options.responseLength || 0
    }, {
      modelUsed: options.modelUsed || null,
      responseTimeMs: options.responseTimeMs || null,
      tokensInput: options.tokensInput || null,
      tokensOutput: options.tokensOutput || null
    });
  }

  /**
   * Track search
   *
   * @param {string} searchType - Type of search (jurisprudencia, legislacao, doutrina)
   * @param {string} query - Search query
   * @param {number} resultsCount - Number of results
   * @param {number} responseTimeMs - Response time
   */
  function trackSearch(searchType, query, resultsCount, responseTimeMs = null) {
    const eventTypeMap = {
      jurisprudencia: EventType.JURISPRUDENCE_SEARCH,
      legislacao: EventType.LEGISLATION_SEARCH,
      doutrina: EventType.DOCTRINE_SEARCH
    };

    trackEvent(eventTypeMap[searchType] || EventType.JURISPRUDENCE_SEARCH, EventCategory.SEARCH, {
      query: query ? query.substring(0, 200) : null,
      resultsCount
    }, {
      responseTimeMs
    });
  }

  /**
   * Track feature usage
   *
   * @param {string} featureName - Name of the feature
   * @param {Object} data - Additional data
   */
  function trackFeatureUsed(featureName, data = {}) {
    trackEvent(EventType.FEATURE_USED, EventCategory.NAVIGATION, {
      feature: featureName,
      ...data
    });
  }

  /**
   * Track error
   *
   * @param {string} errorType - Type of error
   * @param {string} errorMessage - Error message
   * @param {Object} options - Additional options
   */
  function trackError(errorType, errorMessage, options = {}) {
    // Send immediately for errors
    fetch(CONFIG.endpoint + '/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        errorType,
        errorMessage,
        errorCode: options.errorCode || null,
        requestPath: window.location.pathname,
        documentType: options.documentType || null,
        modelUsed: options.modelUsed || null
      }),
      credentials: 'include'
    }).catch(err => debug('Failed to track error:', err));
  }

  /**
   * Submit feedback
   *
   * @param {string} feedbackType - Type of feedback (thumbs_up, thumbs_down, rating, comment)
   * @param {Object} options - Additional options
   */
  async function submitFeedback(feedbackType, options = {}) {
    try {
      const response = await fetch(CONFIG.endpoint + '/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feedbackType,
          eventId: options.eventId || null,
          rating: options.rating || null,
          comment: options.comment || null,
          documentType: options.documentType || null,
          generationId: options.generationId || null,
          metadata: options.metadata || {}
        }),
        credentials: 'include'
      });

      const result = await response.json();
      debug('Feedback submitted:', result);
      return result;
    } catch (error) {
      debug('Failed to submit feedback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create feedback buttons component
   *
   * @param {Object} options - Options for the feedback component
   * @returns {HTMLElement} Feedback buttons container
   */
  function createFeedbackButtons(options = {}) {
    const container = document.createElement('div');
    container.className = 'analytics-feedback-buttons';
    container.innerHTML = `
      <span class="feedback-label">${options.label || 'Esta resposta foi util?'}</span>
      <button class="feedback-btn feedback-thumbs-up" title="Sim, foi util">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
      </button>
      <button class="feedback-btn feedback-thumbs-down" title="Nao, precisa melhorar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
      </button>
    `;

    // Add event listeners
    const thumbsUp = container.querySelector('.feedback-thumbs-up');
    const thumbsDown = container.querySelector('.feedback-thumbs-down');

    thumbsUp.addEventListener('click', async () => {
      thumbsUp.classList.add('selected');
      thumbsDown.classList.remove('selected');
      await submitFeedback(FeedbackType.THUMBS_UP, options);
      if (options.onFeedback) options.onFeedback('thumbs_up');
    });

    thumbsDown.addEventListener('click', async () => {
      thumbsDown.classList.add('selected');
      thumbsUp.classList.remove('selected');
      await submitFeedback(FeedbackType.THUMBS_DOWN, options);
      if (options.onFeedback) options.onFeedback('thumbs_down');
    });

    return container;
  }

  /**
   * Initialize analytics
   */
  function init() {
    // Start session
    startSession();

    // Set up flush interval
    flushTimer = setInterval(flushEvents, CONFIG.flushInterval);

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      // Use sendBeacon for reliability
      if (navigator.sendBeacon && eventQueue.length > 0) {
        for (const event of eventQueue) {
          navigator.sendBeacon(
            CONFIG.endpoint + '/event',
            JSON.stringify(event)
          );
        }
        eventQueue = [];
      }

      // Try to end session
      navigator.sendBeacon(CONFIG.endpoint + '/session/end', '{}');
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushEvents();
      } else {
        // Check for session timeout
        if (Date.now() - lastActivity > CONFIG.sessionTimeout) {
          sessionStarted = false;
          startSession();
        }
      }
    });

    // Handle SPA navigation
    if (window.history && window.history.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        originalPushState.apply(this, args);
        trackPageView();
      };

      window.addEventListener('popstate', () => {
        trackPageView();
      });
    }

    // Global error handler
    window.addEventListener('error', (event) => {
      trackError('javascript_error', event.message, {
        errorCode: 'UNCAUGHT_ERROR'
      });
    });

    // Unhandled promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      trackError('promise_rejection', event.reason?.message || 'Unhandled promise rejection', {
        errorCode: 'PROMISE_REJECTION'
      });
    });

    debug('Analytics initialized');
  }

  // Public API
  const ROMAnalytics = {
    // Configuration
    config: CONFIG,
    setDebug: (enabled) => { CONFIG.debug = enabled; },

    // Event Types
    EventType,
    EventCategory,
    FeedbackType,

    // Core methods
    init,
    trackEvent,
    trackPageView,
    trackDocumentGeneration,
    trackChatMessage,
    trackSearch,
    trackFeatureUsed,
    trackError,
    submitFeedback,
    flushEvents,
    startSession,
    endSession,

    // UI Components
    createFeedbackButtons,

    // Utilities
    getSessionId
  };

  // Expose to window
  window.ROMAnalytics = ROMAnalytics;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
