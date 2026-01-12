const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

/**
 * Create a new organization
 * @param {string} name - Organization name
 * @returns {Promise<Object>} - Created organization with id, name, and created_at
 */
function create(name) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const sql = 'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)';

    db.run(sql, [id, name, createdAt], function(err) {
      if (err) {
        return reject(err);
      }

      resolve({
        id,
        name,
        created_at: createdAt
      });
    });
  });
}

/**
 * Find an organization by ID
 * @param {string} id - Organization ID
 * @returns {Promise<Object|null>} - Organization object or null if not found
 */
function findById(id) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const sql = 'SELECT id, name, created_at FROM organizations WHERE id = ?';

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
