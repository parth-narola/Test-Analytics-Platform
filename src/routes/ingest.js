const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const ingestionService = require('../services/ingestionService');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

/**
 * POST /ingest
 * Ingest test run results (requires authentication)
 */
router.post('/',
  authenticate, // Apply authentication middleware first
  [
    body('run_id')
      .trim()
      .notEmpty()
      .withMessage('run_id is required')
      .custom((value) => {
        // Validate UUID format after trimming
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
          throw new Error('run_id must be a valid UUID');
        }
        return true;
      }),
    body('status')
      .trim()
      .notEmpty()
      .withMessage('status is required')
      .isIn(['passed', 'failed'])
      .withMessage('status must be "passed" or "failed"'),
    body('duration_ms')
      .notEmpty()
      .withMessage('duration_ms is required')
      .isInt({ min: 0 })
      .withMessage('duration_ms must be a non-negative integer'),
    body('timestamp')
      .trim()
      .notEmpty()
      .withMessage('timestamp is required')
      .isISO8601({ strict: false })
      .withMessage('timestamp must be a valid ISO 8601 date')
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { run_id, status, duration_ms, timestamp } = req.body;
      const projectId = req.projectId; // From authentication middleware

      // Call ingestion service
      const result = await ingestionService.ingestTestRun(projectId, run_id, {
        status,
        duration_ms,
        timestamp
      });

      // Return 201 for new records, 200 for idempotent requests
      const statusCode = result.created ? 201 : 200;
      res.status(statusCode).json(result.testRun);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
