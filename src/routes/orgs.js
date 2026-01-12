const express = require('express');
const { body, validationResult } = require('express-validator');
const orgService = require('../services/orgService');
const { ConflictError, ValidationError } = require('../utils/errors');

const router = express.Router();

/**
 * POST /orgs
 * Create a new organization
 */
router.post('/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Organization name is required')
      .isString()
      .withMessage('Organization name must be a string')
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { name } = req.body;

      try {
        // Call organization service
        const org = await orgService.createOrganization(name);
        
        // Return 201 with created organization
        res.status(201).json(org);
      } catch (serviceError) {
        // Check if it's a duplicate organization error
        // SQLite returns SQLITE_CONSTRAINT for unique violations
        if (serviceError.code === 'SQLITE_CONSTRAINT' || 
            (serviceError.message && serviceError.message.includes('UNIQUE'))) {
          throw new ConflictError(`Organization with name "${name}" already exists`);
        }
        throw serviceError;
      }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
