const express = require('express');
const { body, validationResult } = require('express-validator');
const tokenService = require('../services/tokenService');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

/**
 * POST /tokens
 * Create a new API token for a project
 */
router.post('/',
  [
    body('project_id')
      .trim()
      .notEmpty()
      .withMessage('Project ID is required')
      .isString()
      .withMessage('Project ID must be a string')
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { project_id } = req.body;

      // Call token service (handles NotFoundError if project doesn't exist)
      const tokenData = await tokenService.createToken(project_id);
      
      // Return 201 with raw token and warning message
      res.status(201).json(tokenData);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
