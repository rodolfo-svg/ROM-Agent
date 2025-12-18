/**
 * ROM Agent - Structured Logger
 * JSON-formatted logs for better observability
 */

import featureFlags from './feature-flags.js';

class StructuredLogger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
  }

  /**
   * Get current log level from flags
   */
  getCurrentLevel() {
    const level = featureFlags.get('LOG_LEVEL') || 'info';
    return this.levels[level] || this.levels.info;
  }

  /**
   * Check if level should be logged
   */
  shouldLog(level) {
    return this.levels[level] >= this.getCurrentLevel();
  }

  /**
   * Format log entry as JSON
   */
  formatLog(level, message, metadata = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
    });
  }

  /**
   * Log debug message
   */
  debug(message, metadata = {}) {
    if (!this.shouldLog('debug')) return;
    console.log(this.formatLog('debug', message, metadata));
  }

  /**
   * Log info message
   */
  info(message, metadata = {}) {
    if (!this.shouldLog('info')) return;
    console.log(this.formatLog('info', message, metadata));
  }

  /**
   * Log warning message
   */
  warn(message, metadata = {}) {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatLog('warn', message, metadata));
  }

  /**
   * Log error message
   */
  error(message, metadata = {}) {
    if (!this.shouldLog('error')) return;

    // Handle Error objects
    if (metadata.error instanceof Error) {
      metadata.error = {
        message: metadata.error.message,
        stack: metadata.error.stack,
        name: metadata.error.name,
      };
    }

    console.error(this.formatLog('error', message, metadata));
  }
}

// Singleton instance
const structuredLogger = new StructuredLogger();

export default structuredLogger;
export { StructuredLogger };
