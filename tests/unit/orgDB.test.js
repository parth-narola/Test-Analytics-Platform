const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgDB = require('../../src/db/orgDB');
const fs = require('fs');

describe('Organization DB Module', () => {
  const testDbPath = './test-org.db';

  beforeAll(async () => {
    // Initialize test database
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    // Close database and clean up
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create', () => {
    it('should create a new organization successfully', async () => {
      const name = 'Test Organization';
      const org = await orgDB.create(name);

      expect(org).toBeDefined();
      expect(org.id).toBeDefined();
      expect(typeof org.id).toBe('string');
      expect(org.name).toBe(name);
      expect(org.created_at).toBeDefined();
    });

    it('should create organizations with unique IDs', async () => {
      const org1 = await orgDB.create('Org 1');
      const org2 = await orgDB.create('Org 2');

      expect(org1.id).not.toBe(org2.id);
    });
  });

  describe('findById', () => {
    it('should find an existing organization by ID', async () => {
      const created = await orgDB.create('Findable Org');
      const found = await orgDB.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe(created.name);
    });

    it('should return null for non-existent organization ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const found = await orgDB.findById(nonExistentId);

      expect(found).toBeNull();
    });
  });
});
