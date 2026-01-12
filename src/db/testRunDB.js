const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./database');

/**
 * Create a new test run
 * @param {string} projectId - Project ID (foreign key)
 * @param {string} runId - Run ID (unique per project)
 * @param {string} status - Test status ('passed' or 'failed')
 * @param {number} durationMs - Test duration in milliseconds
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {Promise<Object>} - Created test run object
 */
function create(projectId, runId, status, durationMs, timestamp) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const sql = `INSERT INTO test_runs (id, project_id, run_id, status, duration_ms, timestamp, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, projectId, runId, status, durationMs, timestamp, createdAt], function(err) {
      if (err) {
        // Check for unique constraint violation on (project_id, run_id)
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          const error = new Error(`Test run with run_id ${runId} already exists for project ${projectId}`);
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
        run_id: runId,
        status,
        duration_ms: durationMs,
        timestamp,
        created_at: createdAt
      });
    });
  });
}

/**
 * Find a test run by run_id within a specific project
 * @param {string} projectId - Project ID
 * @param {string} runId - Run ID
 * @returns {Promise<Object|null>} - Test run object or null if not found
 */
function findByRunId(projectId, runId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const sql = `SELECT id, project_id, run_id, status, duration_ms, timestamp, created_at 
                 FROM test_runs 
                 WHERE project_id = ? AND run_id = ?`;

    db.get(sql, [projectId, runId], (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

/**
 * Find all test runs for a specific project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - Array of test run objects
 */
function findAllByProject(projectId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const sql = `SELECT id, project_id, run_id, status, duration_ms, timestamp, created_at 
                 FROM test_runs 
                 WHERE project_id = ?
                 ORDER BY created_at DESC`;

    db.all(sql, [projectId], (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

module.exports = {
  create,
  findByRunId,
  findAllByProject
};
