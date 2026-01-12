const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

/**
 * Create a new project
 * @param {string} organizationId - Organization ID (foreign key)
 * @param {string} name - Project name
 * @returns {Promise<Object>} - Created project with id, organization_id, name, and created_at
 */
function create(organizationId, name) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const sql = 'INSERT INTO projects (id, organization_id, name, created_at) VALUES (?, ?, ?, ?)';

    db.run(sql, [id, organizationId, name, createdAt], function(err) {
      if (err) {
        // Check for foreign key constraint violation
        if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
          const error = new Error(`Organization with id ${organizationId} does not exist`);
          error.code = 'FOREIGN_KEY_VIOLATION';
          return reject(error);
        }
        return reject(err);
      }

      resolve({
        id,
        organization_id: organizationId,
        name,
        created_at: createdAt
      });
    });
  });
}

/**
 * Find a project by ID
 * @param {string} id - Project ID
 * @returns {Promise<Object|null>} - Project object or null if not found
 */
function findById(id) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const sql = 'SELECT id, organization_id, name, created_at FROM projects WHERE id = ?';

    db.get(sql, [id], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

module.exports = {
  create,
  findById
};
