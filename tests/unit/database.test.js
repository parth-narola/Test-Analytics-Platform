const { initDatabase, getDatabase, closeDatabase } = require('../../src/db/database');
const fs = require('fs');

describe('Database Module', () => {
  const testDbPath = './test-db.sqlite';

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should initialize database successfully', async () => {
    const db = await initDatabase(testDbPath);
    expect(db).toBeDefined();
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  test('should run migrations and create tables', async () => {
    await initDatabase(testDbPath);
    const db = getDatabase();

    // Check if tables exist
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        (err, tables) => {
          if (err) return reject(err);
          
          const tableNames = tables.map(t => t.name);
          expect(tableNames).toContain('organizations');
          expect(tableNames).toContain('projects');
          expect(tableNames).toContain('api_tokens');
          expect(tableNames).toContain('test_runs');
          resolve();
        }
      );
    });
  });

  test('should enable foreign key constraints', async () => {
    await initDatabase(testDbPath);
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.get('PRAGMA foreign_keys', (err, result) => {
        if (err) return reject(err);
        expect(result.foreign_keys).toBe(1);
        resolve();
      });
    });
  });

  test('should return same instance on multiple calls', async () => {
    const db1 = await initDatabase(testDbPath);
    const db2 = await initDatabase(testDbPath);
    expect(db1).toBe(db2);
  });

  test('should throw error when getting database before initialization', () => {
    expect(() => getDatabase()).toThrow('Database not initialized');
  });
});
