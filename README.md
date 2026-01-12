# Test Analytics Backend

A minimal, production-ready backend service for ingesting automated test results from CI systems. Built with Node.js, Express, and SQLite, this service prioritizes correctness, security, and simplicity.

## Features

- **Multi-tenant architecture** with strict data isolation
- **Secure API token authentication** with SHA-256 hashing
- **Idempotent test ingestion** to handle retries safely
- **Comprehensive input validation** for all endpoints
- **Structured JSON logging** for observability
- **Property-based testing** for correctness guarantees

## Table of Contents

- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Design Decisions](#design-decisions)
- [Testing](#testing)
- [Scaling Considerations](#scaling-considerations)
- [Development](#development)

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- SQLite3 (included as dependency)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd test-analytics-backend
```

2. Install dependencies:
```bash
npm install
```

3. Initialize the database:
```bash
# The database will be automatically initialized on first run
# Or manually run the migration:
sqlite3 test_analytics.db < migrations/init.sql
```

4. Configure environment variables (optional):
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

5. Start the server:
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

Most endpoints require no authentication except `/ingest`, which requires a Bearer token:

```http
Authorization: Bearer ta_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

### 1. Create Organization

Create a new organization (top-level tenant).

**Endpoint:** `POST /orgs`

**Request Body:**
```json
{
  "name": "Acme Corp"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corp",
  "created_at": "2026-01-12T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing or invalid name
- `409 Conflict` - Organization already exists

**Example:**
```bash
curl -X POST http://localhost:3000/orgs \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'
```

---

### 2. Create Project

Create a new project within an organization.

**Endpoint:** `POST /projects`

**Request Body:**
```json
{
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Backend API"
}
```

**Response:** `201 Created`
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Backend API",
  "created_at": "2026-01-12T10:05:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing or invalid fields
- `404 Not Found` - Organization doesn't exist

**Example:**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Backend API"
  }'
```

---

### 3. Create API Token

Generate an API token for a project.

**Endpoint:** `POST /tokens`

**Request Body:**
```json
{
  "project_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response:** `201 Created`
```json
{
  "token": "ta_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "project_id": "660e8400-e29b-41d4-a716-446655440001",
  "warning": "Store this token securely. It will not be shown again."
}
```

**Important:** The raw token is only shown once. Store it securely!

**Error Responses:**
- `400 Bad Request` - Missing project_id
- `404 Not Found` - Project doesn't exist

**Example:**
```bash
curl -X POST http://localhost:3000/tokens \
  -H "Content-Type: application/json" \
  -d '{"project_id": "660e8400-e29b-41d4-a716-446655440001"}'
```

---

### 4. Ingest Test Run

Submit test results to the platform. **Requires authentication.**

**Endpoint:** `POST /ingest`

**Headers:**
```
Authorization: Bearer ta_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Content-Type: application/json
```

**Request Body:**
```json
{
  "run_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "passed",
  "duration_ms": 1234,
  "timestamp": "2026-01-12T10:10:00Z"
}
```

**Field Validation:**
- `run_id`: Must be a valid UUID
- `status`: Must be either "passed" or "failed"
- `duration_ms`: Must be a non-negative integer
- `timestamp`: Must be a valid ISO 8601 timestamp

**Response:** `201 Created` (new) or `200 OK` (idempotent)
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "project_id": "660e8400-e29b-41d4-a716-446655440001",
  "run_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "passed",
  "duration_ms": 1234,
  "timestamp": "2026-01-12T10:10:00Z",
  "created_at": "2026-01-12T10:10:05.000Z"
}
```

**Status Codes:**
- `201 Created` - New test run created
- `200 OK` - Idempotent request (run_id already exists)
- `400 Bad Request` - Invalid payload
- `401 Unauthorized` - Missing or invalid token

**Example:**
```bash
curl -X POST http://localhost:3000/ingest \
  -H "Authorization: Bearer ta_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "770e8400-e29b-41d4-a716-446655440002",
    "status": "passed",
    "duration_ms": 1234,
    "timestamp": "2026-01-12T10:10:00Z"
  }'
```

---

## Design Decisions

### 1. Idempotency Strategy

**Problem:** Network retries and system crashes can cause duplicate test run submissions.

**Solution:** Database UNIQUE constraint on `(project_id, run_id)`

**Why this approach?**
- Database enforces idempotency atomically (no race conditions)
- Survives crashes (constraint persists in database)
- Simple implementation (no distributed locks or caching)

**Implementation:**
```javascript
try {
  // Try to insert directly
  const testRun = db.insert(data);
  return { testRun, statusCode: 201 };  // New record
} catch (error) {
  if (error.code === 'SQLITE_CONSTRAINT') {
    // Fetch and return existing record
    const existing = db.findByRunId(projectId, runId);
    return { testRun: existing, statusCode: 200 };  // Idempotent
  }
  throw error;
}
```

**Key Insight:** Let the database enforce constraints instead of checking first (which creates race conditions).

### 2. Token Security

**Approach:** SHA-256 hashing with constant-time comparison

**Why SHA-256 instead of bcrypt?**
- API tokens are high-entropy random values (32+ bytes)
- SHA-256 is fast and sufficient for this use case
- bcrypt is designed for passwords (intentionally slow)

**Token Format:** `ta_live_` prefix + 32 random hex characters

**Security Measures:**
- Raw tokens are NEVER stored in the database
- Only SHA-256 hashes are persisted
- Tokens are shown only once during creation
- Constant-time comparison prevents timing attacks

### 3. Multi-Tenancy Isolation

**Guarantee:** One project's data can never be accessed by another project's token.

**Implementation:**
- Every API token is scoped to exactly one project
- Authentication middleware attaches `projectId` to requests
- All database queries filter by `projectId`
- Foreign key constraints enforce referential integrity

**Testing:** Property-based tests verify isolation across randomly generated projects and tokens.

### 4. The Intentional Bug (and Fix)

**Bug:** Race condition in idempotency check

**Scenario:** Two concurrent requests with the same `run_id` arrive simultaneously.

**What happens without the fix:**
```
Request A: Check if run_id exists → No
Request B: Check if run_id exists → No
Request A: Insert test run → Success
Request B: Insert test run → UNIQUE constraint violation → Error 500
```

**Why it happens:**
- Check-then-insert is not atomic
- Time gap between SELECT and INSERT allows race condition

**The Fix:** Rely on database UNIQUE constraint
```
Request A: INSERT test run → Success (201)
Request B: INSERT test run → Constraint violation → SELECT existing → Return 200
```

**Key Lesson:** Database constraints are atomic. Use them instead of application-level checks.

---

## Testing

The project includes three types of tests:

### Unit Tests

Test specific functions and edge cases:

```bash
npm test tests/unit
```

Examples:
- Token hashing consistency
- UUID validation
- Authentication middleware behavior

### Property-Based Tests

Verify universal properties across many generated inputs (minimum 100 iterations each):

```bash
npm test tests/property
```

Properties tested:
- Token security and isolation
- Idempotency of test run ingestion
- Multi-tenancy isolation
- Run ID scoping per project
- Comprehensive input validation
- Referential integrity enforcement

### Integration Tests

Test end-to-end flows:

```bash
npm test tests/integration
```

Examples:
- Complete flow: create org → project → token → ingest
- Idempotency: ingest same run_id twice
- Multi-tenancy: verify data isolation

### Run All Tests

```bash
npm test
```

---

## Scaling Considerations

### What Breaks First at 10× Traffic?

**Answer:** SQLite write throughput

**Why:**
- SQLite handles ~1,000-5,000 writes/second (hardware dependent)
- Read throughput is much higher (~100k+ reads/sec with WAL mode)
- The `/ingest` endpoint is write-heavy
- At 10× traffic, write contention becomes the bottleneck

**Symptoms:**
- Increased latency on `/ingest` requests
- Database lock timeouts
- Request queuing

### Premature Optimization We Avoided

**What we did NOT do:** Cache token lookups in memory

**Why not?**
- SQLite with index is already fast (<1ms for token lookup)
- Adds complexity (cache invalidation, memory management)
- Doesn't solve the write bottleneck (which breaks first)
- Premature optimization

**When to consider:**
- After measuring that token lookup is actually a bottleneck
- When read traffic significantly exceeds write traffic
- When profiling shows token validation is >10% of request time

### Future Scaling Path

If traffic grows beyond SQLite capacity:

1. **Short-term:** Optimize SQLite (WAL mode, larger cache, SSD)
2. **Medium-term:** Move to PostgreSQL (better concurrent writes)
3. **Long-term:** Shard by `project_id` (horizontal scaling)

---

## Development

### Project Structure

```
test-analytics-backend/
├── src/
│   ├── index.js                 # Entry point, server setup
│   ├── app.js                   # Express app configuration
│   ├── routes/                  # HTTP layer
│   ├── middleware/              # Express middleware
│   ├── services/                # Business logic
│   ├── db/                      # Data layer
│   └── utils/                   # Utilities
├── migrations/
│   └── init.sql                 # Database schema
├── tests/
│   ├── unit/                    # Unit tests
│   ├── property/                # Property-based tests
│   └── integration/             # Integration tests
└── package.json
```

### Environment Variables

See `.env.example` for available configuration options:

- `PORT` - Server port (default: 3000)
- `DATABASE_PATH` - SQLite database file path (default: ./test_analytics.db)
- `LOG_LEVEL` - Logging level (default: info)

### Development Workflow

1. Make changes to source code
2. Run tests: `npm test`
3. Test manually with curl or Postman
4. Check logs for structured output

### Logging

All logs are output in structured JSON format:

```json
{
  "timestamp": "2026-01-12T10:10:05Z",
  "level": "info",
  "request_id": "req_abc123",
  "method": "POST",
  "path": "/ingest",
  "status": 201,
  "duration_ms": 45,
  "project_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**What is NOT logged:**
- Raw API tokens
- Token hashes
- Sensitive request data

---

## License

ISC

## Contributing

Contributions are welcome! Please ensure all tests pass before submitting a pull request.

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         HTTP Layer (Handlers)           │
│  - Request parsing & validation         │
│  - Authentication middleware            │
│  - Response formatting                  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       Business Logic Layer (Service)    │
│  - Token generation & hashing           │
│  - Idempotency enforcement              │
│  - Multi-tenancy isolation              │
│  - Input validation                     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           Data Layer (DB)               │
│  - SQLite database                      │
│  - CRUD operations                      │
│  - Transaction management               │
└─────────────────────────────────────────┘
```

---

**Built with ❤️ for correctness and simplicity.**
