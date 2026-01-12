const express = require('express');
const { body, validationResult } = require('express-validator');
const projectService = require('../services/projectService');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

/**
 * POST /projects
 * Create a new project
 */
router.post('/',
  [
    body('organization_id')
      .trim()
      .notEmpty()
      .withMessage('Organization ID is required')
      .isString()
      .withMessage('Organization ID must be a string'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Project name is required')
      .isString()
      .withMessage('Project name must be a string')
  ],
  async (req, res, next) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { organization_id, name } = req.body;

      // Call project service (handles NotFoundError if org doesn't exist)
      const project = await projectService.createProject(organization_id, name);
      
      // Return 201 with created project
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
