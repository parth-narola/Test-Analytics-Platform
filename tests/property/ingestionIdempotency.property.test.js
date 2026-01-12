const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const ingestionService = require('../../src/services/ingestionService');
const orgService = require('../../src/services/orgService');
const projectService = require('../../src/services/projectService');
const testRunDB = require('../../src/db/testRunDB');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 2: Idempotency of Test Run Ingestion (service level)
 * Validates: Requirements 6.1, 6.2
 * 
 * Property: For any valid test run with a specific run_id and project_id, ingesting it N times
 * (where N ≥ 1) should result in exactly one database record, all ingestion attempts should return
 * the same test run data, and the response should be consistent regardless of how many times the request is made.
 */
describe('Ingestion Service Property Tests - Idempotency', () => {
  const testDbPath = './test-ingestion-idempotency-property.db';

  beforeAll(async () => {
    await initDatabase(testDbPath);
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 2: Ingesting same run_id N times creates exactly one record', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('passed', 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 2, max: 10 }), // Number of times to ingest (N)
        async (status, duration, numIngestions) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, `Project-${Date.now()}-${Math.random()}`);
          
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          const testRunData = {
            status,
            duration_ms: duration,
            timestamp
          };
          
          // Ingest the same test run N times
          const results = [];
          for (let i = 0; i < numIngestions; i++) {
            const result = await ingestionService.ingestTestRun(project.id, runId, testRunData);
            results.push(result);
          }
          
          // First ingestion should have created=true
          expect(results[0].created).toBe(true);
          
          // All subsequent ingestions should have created=false
          for (let i = 1; i < numIngestions; i++) {
            expect(results[i].created).toBe(false);
          }
          
          // All results should return the same test run data
          const firstTestRun = results[0].testRun;
          for (let i = 1; i < numIngestions; i++) {
            expect(results[i].testRun.id).toBe(firstTestRun.id);
            expect(results[i].testRun.run_id).toBe(firstTestRun.run_id);
            expect(results[i].testRun.status).toBe(firstTestRun.status);
            expect(results[i].testRun.duration_ms).toBe(firstTestRun.duration_ms);
          }
          
          // Verify only one record exists in database
          const allTestRuns = await testRunDB.findAllByProject(project.id);
          const matchingRuns = allTestRuns.filter(tr => tr.run_id === runId);
          expect(matchingRuns.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for property test

  it('Property 2: Idempotent requests return consistent data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('passed', 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        async (status, duration) => {
          // Create organization and project
          const org = await orgService.createOrganization(`Org-${Date.now()}-${Math.random()}`);
          const project = await projectService.createProject(org.id, `Project-${Date.now()}-${Math.random()}`);
          
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          const testRunData = {
            status,
            duration_ms: duration,
            timestamp
          };
          
          // First ingestion
          const result1 = await ingestionService.ingestTestRun(project.id, runId, testRunData);
          expect(result1.created).toBe(true);
          
          // Second ingestion (idempotent)
          const result2 = await ingestionService.ingestTestRun(project.id, runId, testRunData);
          expect(result2.created).toBe(false);
          
          // Both should return the same test run
          expect(result2.testRun.id).toBe(result1.testRun.id);
          expect(result2.testRun.run_id).toBe(result1.testRun.run_id);
          expect(result2.testRun.project_id).toBe(result1.testRun.project_id);
          expect(result2.testRun.status).toBe(result1.testRun.status);
          expect(result2.testRun.duration_ms).toBe(result1.testRun.duration_ms);
          expect(result2.testRun.timestamp).toBe(result1.testRun.timestamp);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 2: Same run_id in different projects creates separate records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('passed', 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        async (status, duration) => {
          // Create two organizations and projects
          const org1 = await orgService.createOrganization(`Org1-${Date.now()}-${Math.random()}`);
          const project1 = await projectService.createProject(org1.id, `Project1-${Date.now()}-${Math.random()}`);
          
          const org2 = await orgService.createOrganization(`Org2-${Date.now()}-${Math.random()}`);
          const project2 = await projectService.createProject(org2.id, `Project2-${Date.now()}-${Math.random()}`);
          
          // Use the same run_id for both projects
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          const testRunData = {
            status,
            duration_ms: duration,
            timestamp
          };
          
          // Ingest to project 1
          const result1 = await ingestionService.ingestTestRun(project1.id, runId, testRunData);
          expect(result1.created).toBe(true);
          
          // Ingest same run_id to project 2 (should create new record)
          const result2 = await ingestionService.ingestTestRun(project2.id, runId, testRunData);
          expect(result2.created).toBe(true);
          
          // Both should have different IDs (different records)
          expect(result1.testRun.id).not.toBe(result2.testRun.id);
          
          // But same run_id
          expect(result1.testRun.run_id).toBe(runId);
          expect(result2.testRun.run_id).toBe(runId);
          
          // And different project_ids
          expect(result1.testRun.project_id).toBe(project1.id);
          expect(result2.testRun.project_id).toBe(project2.id);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
