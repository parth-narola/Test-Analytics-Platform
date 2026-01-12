const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgDB = require('../../src/db/orgDB');
const projectDB = require('../../src/db/projectDB');
const fs = require('fs');

describe('Project DB Module', () => {
  const testDbPath = './test-project.db';
  let testOrg;

  beforeAll(async () => {
    // Initialize test database
    await initDatabase(testDbPath);
    // Create a test organization for foreign key tests
    testOrg = await orgDB.create('Test Organization');
  });

  afterAll(async () => {
    // Close database and clean up
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('create', () => {
    it('should create a new project successfully with valid organization', async () => {
      const name = 'Test Project';
      const project = await projectDB.create(testOrg.id, name);

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(typeof project.id).toBe('string');
      expect(project.organization_id).toBe(testOrg.id);
      expect(project.name).toBe(name);
      expect(project.created_at).toBeDefined();
    });

    it('should reject creation with non-existent organization (foreign key violation)', async () => {
      const nonExistentOrgId = '00000000-0000-0000-0000-000000000000';
      const name = 'Invalid Project';

      await expect(projectDB.create(nonExistentOrgId, name)).rejects.toThrow();
      
      try {
        await projectDB.create(nonExistentOrgId, name);
      } catch (error) {
        expect(error.code).toBe('FOREIGN_KEY_VIOLATION');
      }
    });

    it('should create projects with unique IDs', async () => {
      const project1 = await projectDB.create(testOrg.id, 'Project 1');
      const project2 = await projectDB.create(testOrg.id, 'Project 2');

      expect(project1.id).not.toBe(project2.id);
    });
  });

  describe('findById', () => {
    it('should find an existing project by ID', async () => {
      const created = await projectDB.create(testOrg.id, 'Findable Project');
      const found = await projectDB.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.organization_id).toBe(testOrg.id);
      expect(found.name).toBe(created.name);
    });

    it('should return null for non-existent project ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const found = await projectDB.findById(nonExistentId);

      expect(found).toBeNull();
    });
  });
});
