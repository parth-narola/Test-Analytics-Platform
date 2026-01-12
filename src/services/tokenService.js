const tokenDB = require('../db/tokenDB');
const projectDB = require('../db/projectDB');
const { generateToken, hashToken } = require('../utils/crypto');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Create a new API token for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} - Object containing raw token, project_id, and warning message
 * @throws {ValidationError} - If projectId is missing or invalid
 * @throws {NotFoundError} - If project does not exist
 */
async function createToken(projectId) {
  // Validate projectId is provided
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Project ID is required and must be a string');
  }

  // Check if project exists
  const project = await projectDB.findById(projectId);
  if (!project) {
    throw new NotFoundError(`Project with id ${projectId} does not exist`);
  }

  // Generate random token
  const rawToken = generateToken();
  
  // Hash token before storing
  const tokenHash = hashToken(rawToken);
  
  // Store hashed token in database
  await tokenDB.create(projectId, tokenHash);

  // Return raw token with warning (only shown once)
  return {
    token: rawToken,
    project_id: projectId,
    warning: 'Store this token securely. It will not be shown again.'
  };
}

/**
 * Validate a token and return the associated project ID
 * @param {string} rawToken - Raw API token
 * @returns {Promise<string|null>} - Project ID or null if token is invalid
 */
async function validateToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  // Hash the provided token
  const tokenHash = hashToken(rawToken);
  
  // Look up project by token hash
  const projectId = await tokenDB.findProjectByTokenHash(tokenHash);
  
  return projectId;
}

module.exports = {
  createToken,
  validateToken
};
