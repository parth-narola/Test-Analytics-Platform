-- Test Analytics Backend Database Schema
-- This schema supports multi-tenant test result ingestion with proper isolation

-- Organizations table (top-level tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table (belongs to an organization)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, name)  -- Ensure project names are unique within each organization
);

-- API tokens table (scoped to a single project)
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Test runs table (test execution results)
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('passed', 'failed')),
  duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0),
  timestamp TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, run_id)  -- Idempotency constraint: one run_id per project
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);
