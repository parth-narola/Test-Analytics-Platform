const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const orgDB = require('../../src/db/orgDB');
const projectDB = require('../../src/db/projectDB');
const testRunDB = require('../../src/db/testRunDB');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 2: Idempotency of Test Run Ingestion
 * Validates: Requirements 6.1, 6.2
 * 
 * Property: For any valid test run with a specific run_id and project_id, 
 * ingesting it N times (where N ≥ 1) should result in exactly one database record,
 * and attempting to insert the same run_id again should fail with a unique constraint violation.
 */
describe('Test Run DB Property Tests', () => {
  const testDbPath = './test-testrun-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 2: Idempotency - same run_id cannot be inserted twice for same project', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          runId: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        async (testRunData) => {
          // Create organization and project
          const org = await orgDB.create(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectDB.create(org.id, `Project-${Date.now()}-${Math.random()}`);
          
          // Insert test run first time - should succeed
          const firstInsert = await testRunDB.create(
            project.id,
            testRunData.runId,
            testRunData.status,
            testRunData.durationMs,
            testRunData.timestamp
          );
          
          expect(firstInsert).toBeDefined();
          expect(firstInsert.run_id).toBe(testRunData.runId);
          expect(firstInsert.project_id).toBe(project.id);
          
          // Attempt to insert same run_id again - should fail with unique constraint
          await expect(
            testRunDB.create(
              project.id,
              testRunData.runId,
              testRunData.status,
              testRunData.durationMs,
              testRunData.timestamp
            )
          ).rejects.toThrow();
          
          // Verify only one record exists
          const found = await testRunDB.findByRunId(project.id, testRunData.runId);
          expect(found).toBeDefined();
          expect(found.id).toBe(firstInsert.id);
          
          // Verify findAllByProject returns exactly one record for this run_id
          const allRuns = await testRunDB.findAllByProject(project.id);
          const matchingRuns = allRuns.filter(run => run.run_id === testRunData.runId);
          expect(matchingRuns.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test

  it('Property 2: Same run_id can exist in different projects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          runId: fc.uuid(),
          status: fc.constantFrom('passed', 'failed'),
          durationMs: fc.integer({ min: 0, max: 100000 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        async (testRunData) => {
          // Create two organizations and projects
          const org1 = await orgDB.create(`Org1-${Date.now()}-${Math.random()}`);
          const project1 = await projectDB.create(org1.id, `Project1-${Date.now()}-${Math.random()}`);
          
          const org2 = await orgDB.create(`Org2-${Date.now()}-${Math.random()}`);
          const project2 = await projectDB.create(org2.id, `Project2-${Date.now()}-${Math.random()}`);
          
          // Insert same run_id in both projects - both should succeed
          const run1 = await testRunDB.create(
            project1.id,
            testRunData.runId,
            testRunData.status,
            testRunData.durationMs,
            testRunData.timestamp
          );
          
          const run2 = await testRunDB.create(
            project2.id,
            testRunData.runId,
            testRunData.status,
            testRunData.durationMs,
            testRunData.timestamp
          );
          
          // Verify both records exist with different IDs
          expect(run1.id).not.toBe(run2.id);
          expect(run1.run_id).toBe(testRunData.runId);
          expect(run2.run_id).toBe(testRunData.runId);
          expect(run1.project_id).toBe(project1.id);
          expect(run2.project_id).toBe(project2.id);
          
          // Verify each project has its own record
          const found1 = await testRunDB.findByRunId(project1.id, testRunData.runId);
          const found2 = await testRunDB.findByRunId(project2.id, testRunData.runId);
          
          expect(found1.id).toBe(run1.id);
          expect(found2.id).toBe(run2.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property test
});
