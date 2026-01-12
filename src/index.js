const { createApp } = require('./app');
const { initDatabase, closeDatabase } = require('./db/database');

// Configuration from environment variables
const PORT = process.env.PORT || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || './test-analytics.db';

let server = null;

/**
 * Start the HTTP server
 */
async function startServer() {
  try {
    // Initialize database (run migrations)
    console.log('Initializing database...');
    await initDatabase(DATABASE_PATH);
    console.log('Database initialized successfully');

    // Create Express app
    const app = createApp();

    // Start HTTP server on configurable port
    server = app.listen(PORT, () => {
      console.log(`Test Analytics Backend listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handling
 */
async function shutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');

      // Close database connection
      try {
        await closeDatabase();
        console.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

module.exports = { startServer, shutdown };
