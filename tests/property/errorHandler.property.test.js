const fc = require('fast-check');
const { errorHandler } = require('../../src/middleware/errorHandler');
const {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
} = require('../../src/utils/errors');

/**
 * Feature: test-analytics-backend, Property 7: Error Response Safety
 * Validates: Requirements 8.1, 8.4, 8.5
 * 
 * For any error condition (authentication failure, validation error, not found, database error),
 * the system should return an appropriate HTTP status code (400, 401, 404, 409, 500),
 * a JSON error response with a descriptive message, and never expose internal implementation
 * details, stack traces, or sensitive data.
 */
describe('Property 7: Error Response Safety', () => {
  let req, res, next;

  beforeEach(() => {
    // Create mock request with minimal properties
    req = {
      method: 'POST',
      path: '/test',
      requestId: 'test-request-id'
    };

    // Create mock response
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  /**
   * Property: Error responses never expose stack traces
   */
  it('should never expose stack traces in error responses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('Validation failed')),
          fc.constant(new UnauthorizedError('Auth failed')),
          fc.constant(new NotFoundError('Not found')),
          fc.constant(new ConflictError('Conflict')),
          fc.constant(new Error('Internal error'))
        ),
        (error) => {
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();

          // Call error handler
          errorHandler(error, req, res, next);

          // Get the response body
          expect(res.json).toHaveBeenCalledTimes(1);
          const responseBody = res.json.mock.calls[0][0];

          // Verify response structure
          expect(responseBody).toHaveProperty('error');
          expect(responseBody.error).toHaveProperty('code');
          expect(responseBody.error).toHaveProperty('message');
          expect(responseBody.error).toHaveProperty('request_id');

          // Verify no stack trace in response
          const responseString = JSON.stringify(responseBody);
          expect(responseString).not.toContain('stack');
          expect(responseString).not.toContain('Error:');
          expect(responseString).not.toContain('at ');

          // Verify no internal error details exposed for 500 errors
          if (res.status.mock.calls[0][0] === 500) {
            expect(responseBody.error.message).toBe('An internal server error occurred');
            expect(responseBody.error.message).not.toContain('Internal error');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error responses always have correct HTTP status codes
   */
  it('should map errors to correct HTTP status codes', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.record({
            error: fc.constant(new ValidationError('Validation failed')),
            expectedStatus: fc.constant(400)
          }),
          fc.record({
            error: fc.constant(new UnauthorizedError('Auth failed')),
            expectedStatus: fc.constant(401)
          }),
          fc.record({
            error: fc.constant(new NotFoundError('Not found')),
            expectedStatus: fc.constant(404)
          }),
          fc.record({
            error: fc.constant(new ConflictError('Conflict')),
            expectedStatus: fc.constant(409)
          }),
          fc.record({
            error: fc.constant(new Error('Internal error')),
            expectedStatus: fc.constant(500)
          })
        ),
        ({ error, expectedStatus }) => {
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();

          // Call error handler
          errorHandler(error, req, res, next);

          // Verify correct status code
          expect(res.status).toHaveBeenCalledWith(expectedStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error responses always return valid JSON structure
   */
  it('should always return valid JSON error structure', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('Validation failed')),
          fc.constant(new UnauthorizedError('Auth failed')),
          fc.constant(new NotFoundError('Not found')),
          fc.constant(new ConflictError('Conflict')),
          fc.constant(new Error('Internal error'))
        ),
        fc.string({ minLength: 1, maxLength: 50 }), // request_id
        (error, requestId) => {
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();
          req.requestId = requestId;

          // Call error handler
          errorHandler(error, req, res, next);

          // Get the response body
          const responseBody = res.json.mock.calls[0][0];

          // Verify structure
          expect(responseBody).toMatchObject({
            error: {
              code: expect.any(String),
              message: expect.any(String),
              request_id: requestId
            }
          });

          // Verify error code is one of the expected values
          expect(['invalid_request', 'unauthorized', 'not_found', 'conflict', 'internal_error', 'error'])
            .toContain(responseBody.error.code);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error responses never expose sensitive data
   */
  it('should never expose sensitive data in error responses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('Validation failed')),
          fc.constant(new UnauthorizedError('Auth failed')),
          fc.constant(new NotFoundError('Not found')),
          fc.constant(new ConflictError('Conflict')),
          fc.constant(new Error('Database connection string: postgres://user:password@host'))
        ),
        (error) => {
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();

          // Call error handler
          errorHandler(error, req, res, next);

          // Get the response body
          const responseBody = res.json.mock.calls[0][0];
          const responseString = JSON.stringify(responseBody);

          // Verify no sensitive patterns in response
          expect(responseString).not.toMatch(/password/i);
          expect(responseString).not.toMatch(/secret/i);
          expect(responseString).not.toMatch(/token/i);
          expect(responseString).not.toMatch(/postgres:\/\//);
          expect(responseString).not.toMatch(/mysql:\/\//);
          expect(responseString).not.toMatch(/mongodb:\/\//);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: JSON parsing errors are handled correctly
   */
  it('should handle JSON parsing errors with 400 status', () => {
    // Create a JSON parsing error (simulating express.json() error)
    const jsonError = new SyntaxError('Unexpected token in JSON');
    jsonError.status = 400;
    jsonError.body = '{ invalid json }';

    // Call error handler
    errorHandler(jsonError, req, res, next);

    // Verify 400 status
    expect(res.status).toHaveBeenCalledWith(400);

    // Verify response structure
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.error.code).toBe('invalid_json');
    expect(responseBody.error.message).toBe('Invalid JSON in request body');

    // Verify no internal details exposed
    const responseString = JSON.stringify(responseBody);
    expect(responseString).not.toContain('Unexpected token');
  });

  /**
   * Property: Error handler includes request_id in all responses
   */
  it('should always include request_id in error responses', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(new ValidationError('Validation failed')),
          fc.constant(new UnauthorizedError('Auth failed')),
          fc.constant(new NotFoundError('Not found')),
          fc.constant(new ConflictError('Conflict')),
          fc.constant(new Error('Internal error'))
        ),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }), // request_id or undefined
        (error, requestId) => {
          // Reset mocks
          res.status.mockClear();
          res.json.mockClear();
          req.requestId = requestId;

          // Call error handler
          errorHandler(error, req, res, next);

          // Get the response body
          const responseBody = res.json.mock.calls[0][0];

          // Verify request_id is present
          expect(responseBody.error).toHaveProperty('request_id');

          // If requestId was provided, it should match; otherwise should be 'unknown'
          if (requestId) {
            expect(responseBody.error.request_id).toBe(requestId);
          } else {
            expect(responseBody.error.request_id).toBe('unknown');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
