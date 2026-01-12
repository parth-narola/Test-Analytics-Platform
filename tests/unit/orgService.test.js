const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgService = require('../../src/services/orgService');
const { ValidationError, ConflictError } = require('../../src/utils/errors');
const fs = require('fs');

describe('Organization Service', () => {
  const testDbPath = './test-org-service.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createOrganization', () => {
    it('should create a new organization successfully', async () => {
      const name = 'Test Organization';
      const org = await orgService.createOrganization(name);

      expect(org).toBeDefined();
      expect(org.id).toBeDefined();
      expect(typeof org.id).toBe('string');
      expect(org.name).toBe(name);
      expect(org.created_at).toBeDefined();
    });

    it('should trim whitespace from organization name', async () => {
      const name = '  Trimmed Org  ';
      const org = await orgService.createOrganization(name);

      expect(org.name).toBe('Trimmed Org');
    });

    it('should throw ValidationError for missing name', async () => {
      await expect(orgService.createOrganization()).rejects.toThrow(ValidationError);
      await expect(orgService.createOrganization()).rejects.toThrow('Organization name is required');
    });

    it('should throw ValidationError for empty string name', async () => {
      await expect(orgService.createOrganization('')).rejects.toThrow(ValidationError);
      await expect(orgService.createOrganization('')).rejects.toThrow('Organization name is required');
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      await expect(orgService.createOrganization('   ')).rejects.toThrow(ValidationError);
      await expect(orgService.createOrganization('   ')).rejects.toThrow('Organization name is required');
    });

    it('should throw ValidationError for non-string name', async () => {
      await expect(orgService.createOrganization(123)).rejects.toThrow(ValidationError);
      await expect(orgService.createOrganization(null)).rejects.toThrow(ValidationError);
      await expect(orgService.createOrganization({})).rejects.toThrow(ValidationError);
    });
  });
});
