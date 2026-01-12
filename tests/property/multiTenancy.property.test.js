const fc = require('fast-check');
const { initDatabase, closeDatabase, getDatabase } = require('../../src/db/database');
const orgService = require('../../src/services/orgService');
const projectService = require('../../src/services/projectService');
const tokenService = require('../../src/services/tokenService');
const ingestionService = require('../../src/services/ingestionService');
const testRunDB = require('../../src/db/testRunDB');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 3: Multi-Tenancy Isolation
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 * 
 * Property: For any two different projects with their respective tokens,
 * a test run ingested using token A should only be accessible when authenticated
 * with token A, never with token B, and querying with token B should return zero
 * results for data created with token A.
 */
describe('Multi-Tenancy Isolation Property Tests', () => {
  const testDbPath = './test-multi-tenancy-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 3: Multi-tenancy isolation - test runs are isolated between projects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectAName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectBName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          runId: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, projectAName, projectBName, runId, status, durationMs, timestamp }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create two different projects
          const projectA = await projectService.createProject(org.id, `${projectAName}-A`);
          const projectB = await projectService.createProject(org.id, `${projectBName}-B`);
          
          // Create tokens for both projects
          const tokenA = await tokenService.createToken(projectA.id);
          const tokenB = await tokenService.createToken(projectB.id);
          
          // Ingest test run using project A's token
          const testRunData = {
            status,
            duration_ms: durationMs,
            timestamp: timestamp.toISOString()
          };
          
          const result = await ingestionService.ingestTestRun(projectA.id, runId, testRunData);
          
          // Verify test run was created for project A
          expect(result.testRun.project_id).toBe(projectA.id);
          expect(result.testRun.run_id).toBe(runId);
          
          // Query test runs for project A - should find the test run
          const projectATestRuns = await testRunDB.findAllByProject(projectA.id);
          const foundInA = projectATestRuns.some(tr => tr.run_id === runId);
          expect(foundInA).toBe(true);
          
          // Query test runs for project B - should NOT find the test run
          const projectBTestRuns = await testRunDB.findAllByProject(projectB.id);
          const foundInB = projectBTestRuns.some(tr => tr.run_id === runId);
          expect(foundInB).toBe(false);
          
          // Verify project B has zero test runs with this run_id
          const projectBSpecificRun = await testRunDB.findByRunId(projectB.id, runId);
          expect(projectBSpecificRun).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('Property 3: Multi-tenancy isolation - tokens only access their own project data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectAName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectBName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          runIdA: fc.uuid(),
          runIdB: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, projectAName, projectBName, runIdA, runIdB, status, durationMs, timestamp }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create two different projects
          const projectA = await projectService.createProject(org.id, `${projectAName}-A`);
          const projectB = await projectService.createProject(org.id, `${projectBName}-B`);
          
          // Create tokens for both projects
          const tokenA = await tokenService.createToken(projectA.id);
          const tokenB = await tokenService.createToken(projectB.id);
          
          // Validate tokens return correct project IDs
          const validatedProjectA = await tokenService.validateToken(tokenA.token);
          const validatedProjectB = await tokenService.validateToken(tokenB.token);
          
          expect(validatedProjectA).toBe(projectA.id);
          expect(validatedProjectB).toBe(projectB.id);
          
          // Ingest test runs for both projects
          const testRunData = {
            status,
            duration_ms: durationMs,
            timestamp: timestamp.toISOString()
          };
          
          await ingestionService.ingestTestRun(projectA.id, runIdA, testRunData);
          await ingestionService.ingestTestRun(projectB.id, runIdB, testRunData);
          
          // Verify each project only sees its own test runs
          const projectATestRuns = await testRunDB.findAllByProject(projectA.id);
          const projectBTestRuns = await testRunDB.findAllByProject(projectB.id);
          
          // Project A should have runIdA but not runIdB
          const aHasA = projectATestRuns.some(tr => tr.run_id === runIdA);
          const aHasB = projectATestRuns.some(tr => tr.run_id === runIdB);
          expect(aHasA).toBe(true);
          expect(aHasB).toBe(false);
          
          // Project B should have runIdB but not runIdA
          const bHasA = projectBTestRuns.some(tr => tr.run_id === runIdA);
          const bHasB = projectBTestRuns.some(tr => tr.run_id === runIdB);
          expect(bHasA).toBe(false);
          expect(bHasB).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('Property 3: Multi-tenancy isolation - cross-project data access is impossible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectAName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectBName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          runIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, projectAName, projectBName, runIds, status, durationMs, timestamp }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create two different projects
          const projectA = await projectService.createProject(org.id, `${projectAName}-A`);
          const projectB = await projectService.createProject(org.id, `${projectBName}-B`);
          
          // Ingest multiple test runs for project A
          const testRunData = {
            status,
            duration_ms: durationMs,
            timestamp: timestamp.toISOString()
          };
          
          for (const runId of runIds) {
            await ingestionService.ingestTestRun(projectA.id, runId, testRunData);
          }
          
          // Verify project A has all the test runs
          const projectATestRuns = await testRunDB.findAllByProject(projectA.id);
          expect(projectATestRuns.length).toBeGreaterThanOrEqual(runIds.length);
          
          // Verify project B has NONE of project A's test runs
          const projectBTestRuns = await testRunDB.findAllByProject(projectB.id);
          
          for (const runId of runIds) {
            const foundInB = projectBTestRuns.some(tr => tr.run_id === runId);
            expect(foundInB).toBe(false);
          }
          
          // Verify querying project B with project A's run IDs returns null
          for (const runId of runIds) {
            const result = await testRunDB.findByRunId(projectB.id, runId);
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
