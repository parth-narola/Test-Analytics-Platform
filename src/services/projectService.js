const projectDB = require('../db/projectDB');
const orgDB = require('../db/orgDB');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Create a new project with validation
 * @param {string} organizationId - Organization ID (foreign key)
 * @param {string} name - Project name
 * @returns {Promise<Object>} - Created project
 * @throws {ValidationError} - If name is missing or empty
 * @throws {NotFoundError} - If organization does not exist
 */
async function createProject(organizationId, name) {
  // Validate name is non-empty string
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('Project name is required and must be a non-empty string');
  }

  // Validate organizationId is provided
  if (!organizationId || typeof organizationId !== 'string') {
    throw new ValidationError('Organization ID is required and must be a string');
  }

  // Check if organization exists
  const org = await orgDB.findById(organizationId);
  if (!org) {
    throw new NotFoundError(`Organization with id ${organizationId} does not exist`);
  }

  // Create project in database
  try {
    const project = await projectDB.create(organizationId, name.trim());
    return project;
  } catch (err) {
    // Handle unique constraint violation
    if (err.code === 'UNIQUE_VIOLATION') {
      throw new ConflictError(err.message);
    }
    throw err;
  }
}

module.exports = {
  createProject
};
