const { authenticate } = require('../../src/middleware/auth');
const { hashToken } = require('../../src/utils/crypto');
const tokenDB = require('../../src/db/tokenDB');
const { UnauthorizedError } = require('../../src/utils/errors');

// Mock the tokenDB module
jest.mock('../../src/db/tokenDB');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create mock request, response, and next function
    req = {
      headers: {}
    };
    res = {};
    next = jest.fn();
  });

  describe('Missing Authorization header', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe('Missing Authorization header');
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('Invalid Authorization header format', () => {
    it('should return 401 when Authorization header does not start with "Bearer "', async () => {
      req.headers.authorization = 'Basic sometoken';
      
      await authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toContain('Invalid Authorization header format');
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('should return 401 when Authorization header is just "Bearer" without token', async () => {
      req.headers.authorization = 'Bearer';
      
      await authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      // Token will be empty string, which won't match any hash
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('Valid token authentication', () => {
    it('should attach projectId to request when token is valid', async () => {
      const validToken = 'ta_live_abc123def456';
      const projectId = 'project-uuid-123';
      
      req.headers.authorization = `Bearer ${validToken}`;
      
      // Mock tokenDB to return a project ID
      tokenDB.findProjectByTokenHash.mockResolvedValue(projectId);
      
      await authenticate(req, res, next);
      
      // Verify token was hashed and looked up
      expect(tokenDB.findProjectByTokenHash).toHaveBeenCalledTimes(1);
      expect(tokenDB.findProjectByTokenHash).toHaveBeenCalledWith(hashToken(validToken));
      
      // Verify projectId was attached to request
      expect(req.projectId).toBe(projectId);
      
      // Verify next was called without error
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Invalid token rejection', () => {
    it('should return 401 when token is not found in database', async () => {
      const invalidToken = 'ta_live_invalid_token';
      
      req.headers.authorization = `Bearer ${invalidToken}`;
      
      // Mock tokenDB to return null (token not found)
      tokenDB.findProjectByTokenHash.mockResolvedValue(null);
      
      await authenticate(req, res, next);
      
      // Verify token was looked up
      expect(tokenDB.findProjectByTokenHash).toHaveBeenCalledTimes(1);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe('Invalid token');
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      
      // Verify projectId was NOT attached to request
      expect(req.projectId).toBeUndefined();
    });

    it('should return 401 when token hash does not match any stored hash', async () => {
      const unknownToken = 'ta_live_unknown123456';
      
      req.headers.authorization = `Bearer ${unknownToken}`;
      
      // Mock tokenDB to return null
      tokenDB.findProjectByTokenHash.mockResolvedValue(null);
      
      await authenticate(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe('Invalid token');
    });
  });

  describe('Database errors', () => {
    it('should pass database errors to error handler', async () => {
      const validToken = 'ta_live_abc123';
      const dbError = new Error('Database connection failed');
      
      req.headers.authorization = `Bearer ${validToken}`;
      
      // Mock tokenDB to throw an error
      tokenDB.findProjectByTokenHash.mockRejectedValue(dbError);
      
      await authenticate(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
