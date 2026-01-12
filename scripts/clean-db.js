#!/usr/bin/env node

/**
 * Database Cleaning Script
 * Removes all data from tables while preserving the schema
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Get database path from environment or use default
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/test-analytics.db');
const cleanSqlPath = path.join(__dirname, '../migrations/clean.sql');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log('✓ Database does not exist. Nothing to clean.');
  process.exit(0);
}

// Read the clean SQL script
const cleanSql = fs.readFileSync(cleanSqlPath, 'utf8');

// Open database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('✗ Error opening database:', err.message);
    process.exit(1);
  }
});

console.log('🧹 Cleaning database...');

// Execute the clean script
db.exec(cleanSql, (err) => {
  if (err) {
    console.error('✗ Error cleaning database:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('✓ All data removed successfully');
  console.log('✓ Database schema preserved');
  
  // Close the database
  db.close((err) => {
    if (err) {
      console.error('✗ Error closing database:', err.message);
      process.exit(1);
    }
    console.log('✓ Database cleaned successfully!');
  });
});
