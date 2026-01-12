const express = require('express');
const { errorHandler } = require('./middleware/errorHandler');
const orgRoutes = require('./routes/orgs');
const projectRoutes = require('./routes/projects');
const tokenRoutes = require('./routes/tokens');
const ingestRoutes = require('./routes/ingest');

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Routes
  app.use('/orgs', orgRoutes);
  app.use('/projects', projectRoutes);
  app.use('/tokens', tokenRoutes);
  app.use('/ingest', ingestRoutes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
