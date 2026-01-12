const testRunDB = require('../db/testRunDB');
const { ValidationError } = require('../utils/errors');
const { validate: isValidUUID } = require('uuid');

/**
 * Validate ISO 8601 timestamp format
 * @param {string} timestamp - Timestamp string to validate
 * @returns {boolean} - True if valid ISO 8601 format
 */
function isValidISO8601(timestamp) {
  if (typeof timestamp !== 'string') return false;
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Ingest a test run with validation and idempotency
 * @param {string} projectId - Project ID (from authentication)
 * @param {string} runId - Run ID (UUID)
 * @param {Object} data - Test run data
 * @param {string} data.status - Test status ('passed' or 'failed')
 * @param {number} data.duration_ms - Test duration in milliseconds
 * @param {string} data.timestamp - ISO 8601 timestamp
 * @returns {Promise<Object>} - Object with testRun and created flag
 * @throws {ValidationError} - If any input is invalid
 */
async function ingestTestRun(projectId, runId, data) {
  const { status, duration_ms, timestamp } = data;

  // Validate run_id is a valid UUID
  if (!runId || !isValidUUID(runId)) {
    throw new ValidationError('run_id must be a valid UUID');
  }

  // Validate status is 'passed' or 'failed'
  if (!status || !['passed', 'failed'].includes(status)) {
    throw new ValidationError('status must be "passed" or "failed"');
  }

  // Validate duration_ms is a positive integer
  if (typeof duration_ms !== 'number' || duration_ms < 0 || !Number.isInteger(duration_ms)) {
    throw new ValidationError('duration_ms must be a non-negative integer');
  }

  // Validate timestamp is valid ISO 8601 format
  if (!timestamp || !isValidISO8601(timestamp)) {
    throw new ValidationError('timestamp must be a valid ISO 8601 date string');
  }

  try {
    // Try to insert the test run
    const testRun = await testRunDB.create(projectId, runId, status, duration_ms, timestamp);
    return { testRun, created: true };
  } catch (error) {
    // Check if it's a unique constraint violation (idempotency case)
    if (error.code === 'UNIQUE_VIOLATION') {
      // Fetch and return existing record
      const existingTestRun = await testRunDB.findByRunId(projectId, runId);
      if (!existingTestRun) {
        throw new Error('Constraint violation but record not found');
      }
      return { testRun: existingTestRun, created: false };
    }
    // Re-throw other errors
    throw error;
  }
}

module.exports = {
  ingestTestRun
};
