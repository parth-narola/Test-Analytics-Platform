const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgDB = require('../../src/db/orgDB');
const projectDB = require('../../src/db/projectDB');
const tokenDB = require('../../src/db/tokenDB');
const { hashToken } = require('../../src/utils/crypto');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 1: Token Security and Isolation (partial - one token per project)
 * Validates: Requirements 3.4
 * 
 * Property: For any generated token hash associated with a project, 
 * the token should be associated with exactly one project_id, and 
 * querying by that token hash should return the correct project_id.
 */
describe('Token DB Property Tests', () => {
  const testDbPath = './test-token-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 1: Token hash associates with exactly one project', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Random token string
        async (tokenString) => {
          // Create organization and project
          const org = await orgDB.create(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectDB.create(org.id, `Project-${Date.now()}-${Math.random()}`);
          
          // Hash the token
          const tokenHash = hashToken(tokenString);
          
          // Create token in database
          const token = await tokenDB.create(project.id, tokenHash);
          
          // Verify token is associated with exactly one project
          expect(token.project_id).toBe(project.id);
          
          // Verify we can retrieve the project_id by token hash
          const foundProjectId = await tokenDB.findProjectByTokenHash(tokenHash);
          expect(foundProjectId).toBe(project.id);
          
          // Verify the association is correct
          expect(foundProjectId).toBe(token.project_id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test

  it('Property 1: Token hash uniqueness constraint is enforced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Random token string
        async (tokenString) => {
          // Create two organizations and projects
          const org1 = await orgDB.create(`Org1-${Date.now()}-${Math.random()}`);
          const project1 = await projectDB.create(org1.id, `Project1-${Date.now()}-${Math.random()}`);
          
          const org2 = await orgDB.create(`Org2-${Date.now()}-${Math.random()}`);
          const project2 = await projectDB.create(org2.id, `Project2-${Date.now()}-${Math.random()}`);
          
          // Hash the same token
          const tokenHash = hashToken(tokenString);
          
          // Create token for first project
          await tokenDB.create(project1.id, tokenHash);
          
          // Attempt to create token with same hash for second project should fail
          await expect(tokenDB.create(project2.id, tokenHash)).rejects.toThrow();
          
          // Verify the token is still associated with the first project only
          const foundProjectId = await tokenDB.findProjectByTokenHash(tokenHash);
          expect(foundProjectId).toBe(project1.id);
          expect(foundProjectId).not.toBe(project2.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test
});
