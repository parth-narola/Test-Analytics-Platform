const { generateToken, hashToken } = require('../../src/utils/crypto');
const { ValidationError, UnauthorizedError, NotFoundError, ConflictError } = require('../../src/utils/errors');
const logger = require('../../src/utils/logger');

describe('Utility Modules', () => {
  
  describe('Crypto utilities', () => {
    test('generateToken creates token with correct format', () => {
      const token = generateToken();
      expect(token).toMatch(/^ta_live_[0-9a-f]{64}$/);
      expect(token).toHaveLength(72);
    });

    test('hashToken produces consistent hashes', () => {
      const token = 'ta_live_test123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    test('different tokens produce different hashes', () => {
      const token1 = 'ta_live_test123';
      const token2 = 'ta_live_test456';
      const hash1 = hashToken(token1);
      const hash2 = hashToken(token2);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Error classes', () => {
    test('ValidationError has correct properties', () => {
      const error = new ValidationError('Invalid input', { field: 'name' });
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'name' });
      expect(error.name).toBe('ValidationError');
    });

    test('UnauthorizedError has correct properties', () => {
      const error = new UnauthorizedError('Invalid token');
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    test('NotFoundError has correct properties', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    test('ConflictError has correct properties', () => {
      const error = new ConflictError('Duplicate resource');
      expect(error.message).toBe('Duplicate resource');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('Logger utility', () => {
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    test('info logs structured JSON', () => {
      logger.info('Test message', { userId: '123' });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('info');
      expect(logOutput.message).toBe('Test message');
      expect(logOutput.userId).toBe('123');
      expect(logOutput.timestamp).toBeDefined();
    });

    test('error logs structured JSON', () => {
      logger.error('Error occurred', { errorCode: 'ERR_001' });
      
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(logOutput.level).toBe('error');
      expect(logOutput.message).toBe('Error occurred');
      expect(logOutput.errorCode).toBe('ERR_001');
    });

    test('logger redacts sensitive data', () => {
      logger.info('User authenticated', { 
        userId: '123',
        token: 'ta_live_secret123',
        password: 'mypassword'
      });
      
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(logOutput.userId).toBe('123');
      expect(logOutput.token).toBe('[REDACTED]');
      expect(logOutput.password).toBe('[REDACTED]');
    });

    test('logger redacts nested sensitive data', () => {
      logger.info('Request processed', {
        request: {
          headers: {
            authorization: 'Bearer token123'
          }
        }
      });
      
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(logOutput.request.headers.authorization).toBe('[REDACTED]');
    });
  });
});
