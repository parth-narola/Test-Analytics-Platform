const fc = require('fast-check');
const { initDatabase, closeDatabase } = require('../../src/db/database');
const ingestionService = require('../../src/services/ingestionService');
const orgService = require('../../src/services/orgService');
const projectService = require('../../src/services/projectService');
const { ValidationError } = require('../../src/utils/errors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

/**
 * Feature: test-analytics-backend, Property 5: Comprehensive Input Validation
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6
 * 
 * Property: For any invalid test run payload (missing required fields, invalid UUID format for run_id,
 * status not in ["passed", "failed"], negative or zero duration_ms, malformed timestamp),
 * the system should reject it with HTTP 400, return a descriptive error message, and create no database record.
 */
describe('Ingestion Service Property Tests - Input Validation', () => {
  const testDbPath = './test-ingestion-validation-property.db';
  let testProjectId;

  beforeAll(async () => {
    await initDatabase(testDbPath);
    // Create a test project for validation tests
    const org = await orgService.createOrganization('Test Org');
    const project = await projectService.createProject(org.id, 'Test Project');
    testProjectId = project.id;
  });

  afterAll(async () => {
    await closeDatabase();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Property 5: Invalid run_id format is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => {
          // Generate strings that are NOT valid UUIDs
          try {
            const { validate } = require('uuid');
            return !validate(s);
          } catch {
            return true;
          }
        }),
        fc.constantFrom('passed', 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        async (invalidRunId, status, duration) => {
          const timestamp = new Date().toISOString();
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, invalidRunId, {
              status,
              duration_ms: duration,
              timestamp
            })
          ).rejects.toThrow(ValidationError);
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, invalidRunId, {
              status,
              duration_ms: duration,
              timestamp
            })
          ).rejects.toThrow('run_id must be a valid UUID');
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 5: Invalid status values are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => s !== 'passed' && s !== 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        async (invalidStatus, duration) => {
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: invalidStatus,
              duration_ms: duration,
              timestamp
            })
          ).rejects.toThrow(ValidationError);
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: invalidStatus,
              duration_ms: duration,
              timestamp
            })
          ).rejects.toThrow('status must be "passed" or "failed"');
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 5: Negative duration_ms is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -100000, max: -1 }),
        async (negativeDuration) => {
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: 'passed',
              duration_ms: negativeDuration,
              timestamp
            })
          ).rejects.toThrow(ValidationError);
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: 'passed',
              duration_ms: negativeDuration,
              timestamp
            })
          ).rejects.toThrow('duration_ms must be a non-negative integer');
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 5: Non-integer duration_ms is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.1, max: 1000.9, noNaN: true }),
        async (floatDuration) => {
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: 'passed',
              duration_ms: floatDuration,
              timestamp
            })
          ).rejects.toThrow(ValidationError);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 5: Invalid timestamp format is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => {
          // Generate strings that are NOT valid ISO 8601 timestamps
          const date = new Date(s);
          return isNaN(date.getTime()) || date.toISOString() !== s;
        }),
        fc.integer({ min: 0, max: 100000 }),
        async (invalidTimestamp, duration) => {
          const runId = uuidv4();
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: 'passed',
              duration_ms: duration,
              timestamp: invalidTimestamp
            })
          ).rejects.toThrow(ValidationError);
          
          await expect(
            ingestionService.ingestTestRun(testProjectId, runId, {
              status: 'passed',
              duration_ms: duration,
              timestamp: invalidTimestamp
            })
          ).rejects.toThrow('timestamp must be a valid ISO 8601 date string');
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);

  it('Property 5: Valid inputs are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('passed', 'failed'),
        fc.integer({ min: 0, max: 100000 }),
        async (status, duration) => {
          const runId = uuidv4();
          const timestamp = new Date().toISOString();
          
          const result = await ingestionService.ingestTestRun(testProjectId, runId, {
            status,
            duration_ms: duration,
            timestamp
          });
          
          expect(result).toBeDefined();
          expect(result.testRun).toBeDefined();
          expect(result.testRun.run_id).toBe(runId);
          expect(result.testRun.status).toBe(status);
          expect(result.testRun.duration_ms).toBe(duration);
          expect(result.created).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  }, 30000);
});
