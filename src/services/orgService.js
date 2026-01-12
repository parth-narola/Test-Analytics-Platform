const orgDB = require('../db/orgDB');
const { ValidationError } = require('../utils/errors');

/**
 * Create a new organization with validation
 * @param {string} name - Organization name
 * @returns {Promise<Object>} - Created organization
 * @throws {ValidationError} - If name is missing or empty
 */
async function createOrganization(name) {
  // Validate name is non-empty string
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('Organization name is required and must be a non-empty string');
  }

  // Create organization in database
  const org = await orgDB.create(name.trim());
  return org;
}

module.exports = {
  createOrganization
};
