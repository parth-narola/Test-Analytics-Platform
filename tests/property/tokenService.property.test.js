const fc = require('fast-check');
const { initDatabase, closeDatabase, getDatabase } = require('../../src/db/database');
const tokenService = require('../../src/services/tokenService');
const orgService = require('../../src/services/orgService');
const projectService = require('../../src/services/projectService');
const { hashToken } = require('../../src/utils/crypto');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 1: Token Security and Isolation (complete)
 * Validates: Requirements 3.1, 3.3, 3.4, 4.3, 4.4, 4.5
 * 
 * Property: For any generated API token, the system should:
 * (a) never store the raw token in the database, only its hash
 * (b) produce consistent hashes when hashing the same token multiple times
 * (c) associate the token with exactly one project_id
 * (d) successfully authenticate when the correct token is provided while rejecting any modified or invalid tokens
 */
describe('Token Service Property Tests', () => {
  const testDbPath = './test-token-service-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 1: Token security - raw token never stored in database', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (projectName) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, projectName);
          
          // Create token
          const result = await tokenService.createToken(project.id);
          const rawToken = result.token;
          
          // Query database directly to verify raw token is NOT stored
          const db = getDatabase();
          const rows = await new Promise((resolve, reject) => {
            db.all('SELECT token_hash FROM api_tokens WHERE project_id = ?', [project.id], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          
          // Verify no row contains the raw token
          for (const row of rows) {
            expect(row.token_hash).not.toBe(rawToken);
          }
          
          // Verify the stored value is a hash (different from raw token)
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0].token_hash).not.toBe(rawToken);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 1: Token security - consistent hashing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (tokenString) => {
          // Hash the same token multiple times
          const hash1 = hashToken(tokenString);
          const hash2 = hashToken(tokenString);
          const hash3 = hashToken(tokenString);
          
          // All hashes should be identical
          expect(hash1).toBe(hash2);
          expect(hash2).toBe(hash3);
          
          // Hash should be different from original token
          expect(hash1).not.toBe(tokenString);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 1: Token security - one token per project association', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (projectName) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, projectName);
          
          // Create token
          const result = await tokenService.createToken(project.id);
          
          // Verify token is associated with exactly one project
          expect(result.project_id).toBe(project.id);
          
          // Validate token returns the correct project ID
          const validatedProjectId = await tokenService.validateToken(result.token);
          expect(validatedProjectId).toBe(project.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 1: Token security - authentication with valid token succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (projectName) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, projectName);
          
          // Create token
          const result = await tokenService.createToken(project.id);
          const rawToken = result.token;
          
          // Validate with correct token should succeed
          const projectId = await tokenService.validateToken(rawToken);
          expect(projectId).toBe(project.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 1: Token security - authentication with invalid token fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }),
        async (invalidToken) => {
          // Validate with invalid/random token should return null
          const projectId = await tokenService.validateToken(invalidToken);
          expect(projectId).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 1: Token security - modified token fails authentication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (projectName) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, projectName);
          
          // Create token
          const result = await tokenService.createToken(project.id);
          const rawToken = result.token;
          
          // Modify the token slightly
          const modifiedToken = rawToken + 'x';
          
          // Validate with modified token should fail
          const projectId = await tokenService.validateToken(modifiedToken);
          expect(projectId).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
