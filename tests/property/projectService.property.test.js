const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const projectService = require('../../src/services/projectService');
const orgService = require('../../src/services/orgService');
const { NotFoundError } = require('../../src/utils/errors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 6: Referential Integrity Enforcement (projects)
 * Validates: Requirements 2.2
 * 
 * Property: For any request to create a project with a non-existent organization_id,
 * the system should reject the request with HTTP 404 and not create any database record.
 */
describe('Project Service Property Tests', () => {
  const testDbPath = './test-project-service-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 6: Referential integrity enforcement for projects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Random non-empty project name
        async (projectName) => {
          // Generate a random non-existent organization ID
          const nonExistentOrgId = uuidv4();
          
          // Attempt to create project with non-existent organization ID
          // Should throw NotFoundError
          await expect(
            projectService.createProject(nonExistentOrgId, projectName)
          ).rejects.toThrow(NotFoundError);
          
          await expect(
            projectService.createProject(nonExistentOrgId, projectName)
          ).rejects.toThrow(`Organization with id ${nonExistentOrgId} does not exist`);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test

  it('Property 6: Valid organization ID allows project creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Random non-empty project name
        async (projectName) => {
          // Create a valid organization
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          
          // Create project with valid organization ID should succeed
          const project = await projectService.createProject(org.id, projectName);
          
          expect(project).toBeDefined();
          expect(project.id).toBeDefined();
          expect(project.organization_id).toBe(org.id);
          expect(project.name).toBe(projectName.trim());
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test
});
