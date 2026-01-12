const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

/**
 * Create a new API token
 * @param {string} projectId - Project ID (foreign key)
 * @param {string} tokenHash - Hashed token value
 * @returns {Promise<Object>} - Created token with id, project_id, token_hash, and created_at
 */
function create(projectId, tokenHash) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const sql = 'INSERT INTO api_tokens (id, project_id, token_hash, created_at) VALUES (?, ?, ?, ?)';

    db.run(sql, [id, projectId, tokenHash, createdAt], function(err) {
      if (err) {
        // Check for unique constraint violation on token_hash
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          const error = new Error('Token hash already exists');
          error.code = 'UNIQUE_VIOLATION';
          return reject(error);
        }
        // Check for foreign key constraint violation
        if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
          const error = new Error(`Project with id ${projectId} does not exist`);
          error.code = 'FOREIGN_KEY_VIOLATION';
          return reject(error);
        }
        return reject(err);
      }

      resolve({
        id,
        project_id: projectId,
        token_hash: tokenHash,
        created_at: createdAt
      });
    });
  });
}

/**
 * Find project ID by token hash
 * @param {string} tokenHash - Hashed token value
 * @returns {Promise<string|null>} - Project ID or null if not found
 */
function findProjectByTokenHash(tokenHash) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const sql = 'SELECT project_id FROM api_tokens WHERE token_hash = ?';

    db.get(sql, [tokenHash], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row ? row.project_id : null);
    });
  });
}

module.exports = {
  create,
  findProjectByTokenHash
};
