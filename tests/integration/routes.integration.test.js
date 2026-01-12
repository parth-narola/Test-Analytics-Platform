const request = require('supertest');
const { createApp } = require('../../src/app');
const { initDatabase, getDatabase, closeDatabase } = require('../../src/db/database');
const fs = require('fs');

describe('Routes Integration Tests', () => {
  let app;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeAll(async () => {
    // Initialize test database
    await initDatabase(testDbPath);
    
    // Create Express app
    app = createApp();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach((done) => {
    // Clear all tables before each test
    const db = getDatabase();
    db.serialize(() => {
      db.run('DELETE FROM test_runs');
      db.run('DELETE FROM api_tokens');
      db.run('DELETE FROM projects');
      db.run('DELETE FROM organizations', done);
    });
  });

  describe('Complete Flow: create org → project → token → ingest', () => {
    test('should successfully complete the full workflow', async () => {
      // Step 1: Create organization
      const orgResponse = await request(app)
        .post('/orgs')
        .send({ name: 'Test Organization' })
        .expect(201);

      expect(orgResponse.body).toHaveProperty('id');
      expect(orgResponse.body.name).toBe('Test Organization');
      const orgId = orgResponse.body.id;

      // Step 2: Create project
      const projectResponse = await request(app)
        .post('/projects')
        .send({
          organization_id: orgId,
          name: 'Test Project'
        })
        .expect(201);

      expect(projectResponse.body).toHaveProperty('id');
      expect(projectResponse.body.organization_id).toBe(orgId);
      expect(projectResponse.body.name).toBe('Test Project');
      const projectId = projectResponse.body.id;

      // Step 3: Create token
      const tokenResponse = await request(app)
        .post('/tokens')
        .send({ project_id: projectId })
        .expect(201);

      expect(tokenResponse.body).toHaveProperty('token');
      expect(tokenResponse.body.project_id).toBe(projectId);
      expect(tokenResponse.body.warning).toContain('Store this token securely');
      const token = tokenResponse.body.token;

      // Step 4: Ingest test run
      const ingestResponse = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'passed',
          duration_ms: 1234,
          timestamp: '2026-01-12T10:00:00.000Z'
        })
        .expect(201);

      expect(ingestResponse.body).toHaveProperty('id');
      expect(ingestResponse.body.project_id).toBe(projectId);
      expect(ingestResponse.body.run_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(ingestResponse.body.status).toBe('passed');
      expect(ingestResponse.body.duration_ms).toBe(1234);
    });
  });

  describe('Idempotency: ingest same run_id twice', () => {
    test('should return 201 for first request and 200 for subsequent requests', async () => {
      // Setup: Create org, project, and token
      const orgResponse = await request(app)
        .post('/orgs')
        .send({ name: 'Test Org' })
        .expect(201);
      const orgId = orgResponse.body.id;

      const projectResponse = await request(app)
        .post('/projects')
        .send({ organization_id: orgId, name: 'Test Project' })
        .expect(201);
      const projectId = projectResponse.body.id;

      const tokenResponse = await request(app)
        .post('/tokens')
        .send({ project_id: projectId })
        .expect(201);
      const token = tokenResponse.body.token;

      const testRunData = {
        run_id: '660e8400-e29b-41d4-a716-446655440001',
        status: 'failed',
        duration_ms: 5678,
        timestamp: '2026-01-12T11:00:00.000Z'
      };

      // First ingestion - should return 201
      const firstResponse = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send(testRunData)
        .expect(201);

      expect(firstResponse.body.run_id).toBe(testRunData.run_id);
      const firstId = firstResponse.body.id;

      // Second ingestion with same run_id - should return 200
      const secondResponse = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send(testRunData)
        .expect(200);

      expect(secondResponse.body.run_id).toBe(testRunData.run_id);
      expect(secondResponse.body.id).toBe(firstId); // Same record
      expect(secondResponse.body.status).toBe(testRunData.status);
      expect(secondResponse.body.duration_ms).toBe(testRunData.duration_ms);
    });
  });

  describe('Multi-tenancy: verify data isolation between projects', () => {
    test('should isolate test runs between different projects', async () => {
      // Create two organizations with projects and tokens
      const org1Response = await request(app)
        .post('/orgs')
        .send({ name: 'Org 1' })
        .expect(201);
      const org1Id = org1Response.body.id;

      const project1Response = await request(app)
        .post('/projects')
        .send({ organization_id: org1Id, name: 'Project 1' })
        .expect(201);
      const project1Id = project1Response.body.id;

      const token1Response = await request(app)
        .post('/tokens')
        .send({ project_id: project1Id })
        .expect(201);
      const token1 = token1Response.body.token;

      const org2Response = await request(app)
        .post('/orgs')
        .send({ name: 'Org 2' })
        .expect(201);
      const org2Id = org2Response.body.id;

      const project2Response = await request(app)
        .post('/projects')
        .send({ organization_id: org2Id, name: 'Project 2' })
        .expect(201);
      const project2Id = project2Response.body.id;

      const token2Response = await request(app)
        .post('/tokens')
        .send({ project_id: project2Id })
        .expect(201);
      const token2 = token2Response.body.token;

      // Ingest test run to project 1
      const testRun1 = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          run_id: '770e8400-e29b-41d4-a716-446655440002',
          status: 'passed',
          duration_ms: 1000,
          timestamp: '2026-01-12T12:00:00.000Z'
        })
        .expect(201);

      expect(testRun1.body.project_id).toBe(project1Id);

      // Ingest test run to project 2
      const testRun2 = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          run_id: '880e8400-e29b-41d4-a716-446655440003',
          status: 'failed',
          duration_ms: 2000,
          timestamp: '2026-01-12T13:00:00.000Z'
        })
        .expect(201);

      expect(testRun2.body.project_id).toBe(project2Id);

      // Verify data isolation: check database directly
      const db = getDatabase();
      
      const project1Runs = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM test_runs WHERE project_id = ?', [project1Id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      const project2Runs = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM test_runs WHERE project_id = ?', [project2Id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(project1Runs).toHaveLength(1);
      expect(project1Runs[0].run_id).toBe('770e8400-e29b-41d4-a716-446655440002');

      expect(project2Runs).toHaveLength(1);
      expect(project2Runs[0].run_id).toBe('880e8400-e29b-41d4-a716-446655440003');
    });

    test('should allow same run_id in different projects', async () => {
      // Create two projects
      const orgResponse = await request(app)
        .post('/orgs')
        .send({ name: 'Test Org' })
        .expect(201);
      const orgId = orgResponse.body.id;

      const project1Response = await request(app)
        .post('/projects')
        .send({ organization_id: orgId, name: 'Project A' })
        .expect(201);
      const project1Id = project1Response.body.id;

      const token1Response = await request(app)
        .post('/tokens')
        .send({ project_id: project1Id })
        .expect(201);
      const token1 = token1Response.body.token;

      const project2Response = await request(app)
        .post('/projects')
        .send({ organization_id: orgId, name: 'Project B' })
        .expect(201);
      const project2Id = project2Response.body.id;

      const token2Response = await request(app)
        .post('/tokens')
        .send({ project_id: project2Id })
        .expect(201);
      const token2 = token2Response.body.token;

      const sameRunId = '990e8400-e29b-41d4-a716-446655440004';

      // Ingest same run_id to both projects - both should succeed
      const testRun1 = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          run_id: sameRunId,
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T14:00:00.000Z'
        })
        .expect(201);

      expect(testRun1.body.project_id).toBe(project1Id);
      expect(testRun1.body.run_id).toBe(sameRunId);

      const testRun2 = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          run_id: sameRunId,
          status: 'failed',
          duration_ms: 200,
          timestamp: '2026-01-12T15:00:00.000Z'
        })
        .expect(201);

      expect(testRun2.body.project_id).toBe(project2Id);
      expect(testRun2.body.run_id).toBe(sameRunId);

      // Verify both records exist
      const db = getDatabase();
      const allRuns = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM test_runs WHERE run_id = ?', [sameRunId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      expect(allRuns).toHaveLength(2);
    });
  });

  describe('Authentication: valid and invalid tokens', () => {
    test('should reject request without Authorization header', async () => {
      const response = await request(app)
        .post('/ingest')
        .send({
          run_id: 'aa0e8400-e29b-41d4-a716-446655440005',
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T16:00:00.000Z'
        })
        .expect(401);

      expect(response.body.error.code).toBe('unauthorized');
      expect(response.body.error.message).toContain('Authorization');
    });

    test('should reject request with invalid Authorization header format', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', 'InvalidFormat token123')
        .send({
          run_id: 'bb0e8400-e29b-41d4-a716-446655440006',
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T17:00:00.000Z'
        })
        .expect(401);

      expect(response.body.error.code).toBe('unauthorized');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', 'Bearer ta_live_invalidtoken123456789012345678901234')
        .send({
          run_id: 'cc0e8400-e29b-41d4-a716-446655440007',
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T18:00:00.000Z'
        })
        .expect(401);

      expect(response.body.error.code).toBe('unauthorized');
      expect(response.body.error.message).toContain('Invalid token');
    });

    test('should accept request with valid token', async () => {
      // Setup: Create org, project, and token
      const orgResponse = await request(app)
        .post('/orgs')
        .send({ name: 'Auth Test Org' })
        .expect(201);
      const orgId = orgResponse.body.id;

      const projectResponse = await request(app)
        .post('/projects')
        .send({ organization_id: orgId, name: 'Auth Test Project' })
        .expect(201);
      const projectId = projectResponse.body.id;

      const tokenResponse = await request(app)
        .post('/tokens')
        .send({ project_id: projectId })
        .expect(201);
      const token = tokenResponse.body.token;

      // Should succeed with valid token
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: 'dd0e8400-e29b-41d4-a716-446655440008',
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T19:00:00.000Z'
        })
        .expect(201);

      expect(response.body.project_id).toBe(projectId);
    });
  });

  describe('Validation: various invalid payloads', () => {
    let token;
    let projectId;

    beforeEach(async () => {
      // Setup: Create org, project, and token for validation tests
      const orgResponse = await request(app)
        .post('/orgs')
        .send({ name: 'Validation Test Org' })
        .expect(201);
      const orgId = orgResponse.body.id;

      const projectResponse = await request(app)
        .post('/projects')
        .send({ organization_id: orgId, name: 'Validation Test Project' })
        .expect(201);
      projectId = projectResponse.body.id;

      const tokenResponse = await request(app)
        .post('/tokens')
        .send({ project_id: projectId })
        .expect(201);
      token = tokenResponse.body.token;
    });

    test('should reject missing run_id', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T20:00:00.000Z'
        })
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject invalid run_id format (not UUID)', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: 'not-a-valid-uuid',
          status: 'passed',
          duration_ms: 100,
          timestamp: '2026-01-12T20:00:00.000Z'
        })
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject invalid status value', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: 'ee0e8400-e29b-41d4-a716-446655440009',
          status: 'invalid_status',
          duration_ms: 100,
          timestamp: '2026-01-12T20:00:00.000Z'
        })
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject negative duration_ms', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: 'ff0e8400-e29b-41d4-a716-446655440010',
          status: 'passed',
          duration_ms: -100,
          timestamp: '2026-01-12T20:00:00.000Z'
        })
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject invalid timestamp format', async () => {
      const response = await request(app)
        .post('/ingest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          run_id: '000e8400-e29b-41d4-a716-446655440011',
          status: 'passed',
          duration_ms: 100,
          timestamp: 'not-a-valid-timestamp'
        })
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject organization creation with missing name', async () => {
      const response = await request(app)
        .post('/orgs')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('invalid_request');
    });

    test('should reject project creation with non-existent organization_id', async () => {
      const response = await request(app)
        .post('/projects')
        .send({
          organization_id: '111e8400-e29b-41d4-a716-446655440012',
          name: 'Test Project'
        })
        .expect(404);

      expect(response.body.error.code).toBe('not_found');
    });

    test('should reject token creation with non-existent project_id', async () => {
      const response = await request(app)
        .post('/tokens')
        .send({
          project_id: '222e8400-e29b-41d4-a716-446655440013'
        })
        .expect(404);

      expect(response.body.error.code).toBe('not_found');
    });
  });
});
