const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Global error handler middleware
 * Catches all errors from routes and services
 * Maps custom errors to HTTP status codes
 * Returns JSON error response with code, message, request_id
 * Never exposes stack traces or internal details
 * Logs errors with full context
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error
  let statusCode = 500;
  let errorCode = 'internal_error';
  let message = 'An internal server error occurred';
  
  // If it's one of our custom AppError instances, use its properties
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    
    // Map status codes to error codes
    switch (statusCode) {
      case 400:
        errorCode = 'invalid_request';
        break;
      case 401:
        errorCode = 'unauthorized';
        break;
      case 404:
        errorCode = 'not_found';
        break;
      case 409:
        errorCode = 'conflict';
        break;
      default:
        errorCode = 'error';
    }
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    // Handle JSON parsing errors from express.json()
    statusCode = 400;
    errorCode = 'invalid_json';
    message = 'Invalid JSON in request body';
  }
  
  // Log the error with full context
  const logContext = {
    request_id: req.requestId || 'unknown',
    method: req.method,
    path: req.path,
    status: statusCode,
    error_code: errorCode,
    error_message: message,
    error_name: err.name
  };
  
  // Include project_id if authenticated
  if (req.projectId) {
    logContext.project_id = req.projectId;
  }
  
  // For 500 errors, log the full error details (but not in response)
  if (statusCode === 500) {
    logContext.error_stack = err.stack;
    logContext.error_details = err.message;
    logger.error('Internal server error', logContext);
  } else {
    logger.warn('Request error', logContext);
  }
  
  // Build error response (never include stack traces or internal details)
  const errorResponse = {
    error: {
      code: errorCode,
      message: message,
      request_id: req.requestId || 'unknown'
    }
  };
  
  // Include validation details if available (from ValidationError)
  if (err.details) {
    errorResponse.error.details = err.details;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
}

module.exports = { errorHandler };
