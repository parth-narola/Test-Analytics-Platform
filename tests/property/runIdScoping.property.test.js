const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgService = require('../../src/services/orgService');
const projectService = require('../../src/services/projectService');
const ingestionService = require('../../src/services/ingestionService');
const testRunDB = require('../../src/db/testRunDB');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 4: Run ID Scoping Per Project
 * Validates: Requirements 6.3
 * 
 * Property: For any run_id value, it should be possible to create test runs
 * with the same run_id in different projects, and each project should maintain
 * its own independent test run with that run_id without conflicts.
 */
describe('Run ID Scoping Property Tests', () => {
  const testDbPath = './test-runid-scoping-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 4: Run ID scoping - same run_id can exist in different projects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectAName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectBName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          sharedRunId: fc.uuid(),
          statusA: fc.constantFrom('passed', 'failed'),
          statusB: fc.constantFrom('passed', 'failed'),
          durationMsA: fc.integer({ min: 0, max: 100000 }),
          durationMsB: fc.integer({ min: 0, max: 100000 }),
          timestampA: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          timestampB: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, projectAName, projectBName, sharedRunId, statusA, statusB, durationMsA, durationMsB, timestampA, timestampB }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create two different projects
          const projectA = await projectService.createProject(org.id, `${projectAName}-A`);
          const projectB = await projectService.createProject(org.id, `${projectBName}-B`);
          
          // Ingest test run with same run_id for project A
          const testRunDataA = {
            status: statusA,
            duration_ms: durationMsA,
            timestamp: timestampA.toISOString()
          };
          
          const resultA = await ingestionService.ingestTestRun(projectA.id, sharedRunId, testRunDataA);
          
          // Verify test run was created for project A
          expect(resultA.testRun.project_id).toBe(projectA.id);
          expect(resultA.testRun.run_id).toBe(sharedRunId);
          expect(resultA.testRun.status).toBe(statusA);
          expect(resultA.testRun.duration_ms).toBe(durationMsA);
          expect(resultA.created).toBe(true);
          
          // Ingest test run with SAME run_id for project B (should succeed without conflict)
          const testRunDataB = {
            status: statusB,
            duration_ms: durationMsB,
            timestamp: timestampB.toISOString()
          };
          
          const resultB = await ingestionService.ingestTestRun(projectB.id, sharedRunId, testRunDataB);
          
          // Verify test run was created for project B
          expect(resultB.testRun.project_id).toBe(projectB.id);
          expect(resultB.testRun.run_id).toBe(sharedRunId);
          expect(resultB.testRun.status).toBe(statusB);
          expect(resultB.testRun.duration_ms).toBe(durationMsB);
          expect(resultB.created).toBe(true);
          
          // Verify both test runs exist independently
          const testRunA = await testRunDB.findByRunId(projectA.id, sharedRunId);
          const testRunB = await testRunDB.findByRunId(projectB.id, sharedRunId);
          
          expect(testRunA).not.toBeNull();
          expect(testRunB).not.toBeNull();
          
          // Verify they are different records with different data
          expect(testRunA.id).not.toBe(testRunB.id);
          expect(testRunA.project_id).toBe(projectA.id);
          expect(testRunB.project_id).toBe(projectB.id);
          expect(testRunA.status).toBe(statusA);
          expect(testRunB.status).toBe(statusB);
          expect(testRunA.duration_ms).toBe(durationMsA);
          expect(testRunB.duration_ms).toBe(durationMsB);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('Property 4: Run ID scoping - multiple projects can use same run_id without conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          numProjects: fc.integer({ min: 2, max: 5 }),
          sharedRunId: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, numProjects, sharedRunId, status, durationMs, timestamp }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create multiple projects
          const projects = [];
          for (let i = 0; i < numProjects; i++) {
            const project = await projectService.createProject(org.id, `Project-${i}-${Date.now()}`);
            projects.push(project);
          }
          
          // Ingest test run with same run_id for all projects
          const testRunData = {
            status,
            duration_ms: durationMs,
            timestamp: timestamp.toISOString()
          };
          
          const results = [];
          for (const project of projects) {
            const result = await ingestionService.ingestTestRun(project.id, sharedRunId, testRunData);
            results.push(result);
          }
          
          // Verify all test runs were created successfully
          expect(results.length).toBe(numProjects);
          
          for (let i = 0; i < numProjects; i++) {
            expect(results[i].testRun.project_id).toBe(projects[i].id);
            expect(results[i].testRun.run_id).toBe(sharedRunId);
            expect(results[i].created).toBe(true);
          }
          
          // Verify each project has its own independent test run
          for (const project of projects) {
            const testRun = await testRunDB.findByRunId(project.id, sharedRunId);
            expect(testRun).not.toBeNull();
            expect(testRun.project_id).toBe(project.id);
            expect(testRun.run_id).toBe(sharedRunId);
          }
          
          // Verify all test run IDs are unique (different database records)
          const testRunIds = results.map(r => r.testRun.id);
          const uniqueIds = new Set(testRunIds);
          expect(uniqueIds.size).toBe(numProjects);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('Property 4: Run ID scoping - run_id uniqueness is enforced per project, not globally', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orgName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectAName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          projectBName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          sharedRunId: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        }),
        async ({ orgName, projectAName, projectBName, sharedRunId, status, durationMs, timestamp }) => {
          // Create organization
          const org = await orgService.createOrganization(`${orgName}-${Date.now()}-${Math.random()}`);
          
          // Create two different projects
          const projectA = await projectService.createProject(org.id, `${projectAName}-A`);
          const projectB = await projectService.createProject(org.id, `${projectBName}-B`);
          
          const testRunData = {
            status,
            duration_ms: durationMs,
            timestamp: timestamp.toISOString()
          };
          
          // Ingest test run with run_id for project A
          const resultA1 = await ingestionService.ingestTestRun(projectA.id, sharedRunId, testRunData);
          expect(resultA1.created).toBe(true);
          
          // Ingest same run_id again for project A (should be idempotent)
          const resultA2 = await ingestionService.ingestTestRun(projectA.id, sharedRunId, testRunData);
          expect(resultA2.created).toBe(false); // Idempotent, not created
          expect(resultA2.testRun.id).toBe(resultA1.testRun.id); // Same record
          
          // Ingest same run_id for project B (should create new record, not conflict)
          const resultB1 = await ingestionService.ingestTestRun(projectB.id, sharedRunId, testRunData);
          expect(resultB1.created).toBe(true); // New record created
          expect(resultB1.testRun.id).not.toBe(resultA1.testRun.id); // Different record
          
          // Verify project A has exactly one test run with this run_id
          const projectATestRuns = await testRunDB.findAllByProject(projectA.id);
          const projectAMatchingRuns = projectATestRuns.filter(tr => tr.run_id === sharedRunId);
          expect(projectAMatchingRuns.length).toBe(1);
          
          // Verify project B has exactly one test run with this run_id
          const projectBTestRuns = await testRunDB.findAllByProject(projectB.id);
          const projectBMatchingRuns = projectBTestRuns.filter(tr => tr.run_id === sharedRunId);
          expect(projectBMatchingRuns.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
