/**
 * Structured logger utility
 * Outputs JSON-formatted logs with timestamp, level, message, and context
 * Ensures sensitive data (tokens) are never logged
 */

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Sanitize context to remove sensitive data
 * @param {Object} context - The context object to sanitize
 * @returns {Object} - Sanitized context
 */
function sanitizeContext(context) {
  if (!context || typeof context !== 'object') {
    return context;
  }

  const sanitized = { ...context };
  
  // List of sensitive field names to redact
  const sensitiveFields = [
    'token',
    'password',
    'secret',
    'authorization',
    'api_key',
    'apiKey',
    'token_hash',
    'tokenHash'
  ];

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    // Check if field name contains sensitive keywords
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Create a log entry
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {Object} context - Additional context (optional)
 */
function log(level, message, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeContext(context)
  };

  // Output as JSON
  console.log(JSON.stringify(logEntry));
}

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Object} context - Additional context (optional)
 */
function error(message, context = {}) {
  log(LOG_LEVELS.ERROR, message, context);
}

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {Object} context - Additional context (optional)
 */
function warn(message, context = {}) {
  log(LOG_LEVELS.WARN, message, context);
}

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {Object} context - Additional context (optional)
 */
function info(message, context = {}) {
  log(LOG_LEVELS.INFO, message, context);
}

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {Object} context - Additional context (optional)
 */
function debug(message, context = {}) {
  log(LOG_LEVELS.DEBUG, message, context);
}

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS
};
