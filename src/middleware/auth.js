const { hashToken } = require('../utils/crypto');
const tokenDB = require('../db/tokenDB');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Authentication middleware
 * Extracts Bearer token from Authorization header, validates it, and attaches projectId to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
      throw new UnauthorizedError('Missing Authorization header');
    }
    
    // Check if Authorization header has correct format (Bearer <token>)
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid Authorization header format. Expected: Bearer <token>');
    }
    
    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);
    
    // Hash the token
    const tokenHash = hashToken(token);
    
    // Lookup project by token hash
    const projectId = await tokenDB.findProjectByTokenHash(tokenHash);
    
    // If no project found, token is invalid
    if (!projectId) {
      throw new UnauthorizedError('Invalid token');
    }
    
    // Attach projectId to request for use in route handlers
    req.projectId = projectId;
    
    // Continue to next middleware/handler
    next();
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
}

module.exports = { authenticate };
