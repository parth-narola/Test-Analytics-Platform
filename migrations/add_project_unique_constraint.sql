-- Migration: Add unique constraint on (organization_id, name) for projects table
-- This ensures project names are unique within each organization

-- Step 1: Create a new table with the constraint
CREATE TABLE IF NOT EXISTS projects_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, name)
);

-- Step 2: Copy data from old table (this will fail if duplicates exist)
INSERT INTO projects_new (id, organization_id, name, created_at)
SELECT id, organization_id, name, created_at FROM projects;

-- Step 3: Drop old table
DROP TABLE projects;

-- Step 4: Rename new table
ALTER TABLE projects_new RENAME TO projects;

-- Step 5: Recreate index
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
