-- Clean all data from tables while preserving schema
-- This removes all records but keeps the table structure intact

-- Delete in reverse order of foreign key dependencies
DELETE FROM test_runs;
DELETE FROM api_tokens;
DELETE FROM projects;
DELETE FROM organizations;

-- Vacuum to reclaim space (optional but recommended)
VACUUM;
