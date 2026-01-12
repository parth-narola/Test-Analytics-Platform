const fc = require('fast-check');
const { generateToken, hashToken } = require('../../src/utils/crypto');

/**
 * Feature: test-analytics-backend, Property 1: Token Security and Isolation (partial - hashing consistency)
 * Validates: Requirements 3.1, 3.3
 * 
 * This property test verifies that:
 * 1. Generated tokens have the correct format (ta_live_ prefix + 64 hex chars)
 * 2. Token hashing is consistent (same token always produces same hash)
 * 3. Different tokens produce different hashes
 * 4. Hashes are never equal to the original token (one-way function)
 */
describe('Property Test: Token Security and Isolation (hashing consistency)', () => {
  
  test('generated tokens have correct format', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const token = generateToken();
        
        // Token should start with 'ta_live_'
        expect(token).toMatch(/^ta_live_/);
        
        // Token should be 'ta_live_' (8 chars) + 64 hex chars = 72 chars total
        expect(token).toHaveLength(72);
        
        // After prefix, should only contain hex characters
        const hexPart = token.substring(8);
        expect(hexPart).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 100 }
    );
  });

  test('token hashing is consistent', () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (hexString) => {
        const token = 'ta_live_' + hexString;
        
        // Hash the same token multiple times
        const hash1 = hashToken(token);
        const hash2 = hashToken(token);
        const hash3 = hashToken(token);
        
        // All hashes should be identical
        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
        
        // Hash should be a 64-character hex string (SHA-256 output)
        expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 100 }
    );
  });

  test('different tokens produce different hashes', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        fc.hexaString({ minLength: 64, maxLength: 64 }),
        (hex1, hex2) => {
          // Skip if tokens are identical
          fc.pre(hex1 !== hex2);
          
          const token1 = 'ta_live_' + hex1;
          const token2 = 'ta_live_' + hex2;
          
          const hash1 = hashToken(token1);
          const hash2 = hashToken(token2);
          
          // Different tokens should produce different hashes
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hash is never equal to original token (one-way function)', () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 64, maxLength: 64 }), (hexString) => {
        const token = 'ta_live_' + hexString;
        const hash = hashToken(token);
        
        // Hash should never equal the original token
        expect(hash).not.toBe(token);
        
        // Hash should not contain the token prefix
        expect(hash).not.toMatch(/^ta_live_/);
      }),
      { numRuns: 100 }
    );
  });

  test('hashing is deterministic across multiple calls', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Generate a token once
        const token = generateToken();
        
        // Hash it multiple times
        const hashes = Array.from({ length: 10 }, () => hashToken(token));
        
        // All hashes should be identical
        const firstHash = hashes[0];
        expect(hashes.every(h => h === firstHash)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
