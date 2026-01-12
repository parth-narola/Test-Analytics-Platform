const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

let db = null;

/**
 * Initialize the SQLite database connection and run migrations
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Promise<sqlite3.Database>} - The database instance
 */
function initDatabase(dbPath = './test-analytics.db') {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    // Create database connection
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return reject(err);
      }

      // Enable foreign key constraints
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          return reject(err);
        }

        // Enable WAL mode for better concurrent read/write performance
        db.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            return reject(err);
          }

          // Run migrations
          runMigrations()
            .then(() => resolve(db))
            .catch(reject);
        });
      });
    });
  });
}

/**
 * Run database migrations from migrations/init.sql
 */
function runMigrations() {
  return new Promise((resolve, reject) => {
    const migrationPath = path.join(__dirname, '../../migrations/init.sql');
    
    if (!fs.existsSync(migrationPath)) {
      return reject(new Error(`Migration file not found: ${migrationPath}`));
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration SQL
    db.exec(migrationSQL, (err) => {
      if (err) {
        return reject(err);
      }
      console.log('Database migrations completed successfully');
      resolve();
    });
  });
}

/**
 * Get the current database instance
 * @returns {sqlite3.Database} - The database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          return reject(err);
        }
        db = null;
        console.log('Database connection closed');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
