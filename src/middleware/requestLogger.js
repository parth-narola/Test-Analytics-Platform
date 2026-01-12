const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request logging middleware
 * Logs request method, path, timestamp at start
 * Logs response status, duration_ms at end
 * Uses structured JSON format
 * Includes project_id if authenticated
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requestLogger(req, res, next) {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Record start time
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request start
  logger.info('Request received', {
    request_id: requestId,
    method: req.method,
    path: req.path,
    timestamp
  });
  
  // Capture the original res.json and res.send methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  // Flag to ensure we only log once
  let logged = false;
  
  /**
   * Log response details
   */
  function logResponse() {
    if (logged) return;
    logged = true;
    
    const duration_ms = Date.now() - startTime;
    
    const logContext = {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms
    };
    
    // Include project_id if authenticated (set by auth middleware)
    if (req.projectId) {
      logContext.project_id = req.projectId;
    }
    
    logger.info('Request completed', logContext);
  }
  
  // Override res.json to log after response
  res.json = function(body) {
    logResponse();
    return originalJson(body);
  };
  
  // Override res.send to log after response
  res.send = function(body) {
    logResponse();
    return originalSend(body);
  };
  
  // Also log on response finish event (catches cases where json/send aren't used)
  res.on('finish', logResponse);
  
  next();
}

module.exports = { requestLogger };
