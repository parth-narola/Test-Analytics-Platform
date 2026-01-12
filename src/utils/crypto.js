const crypto = require('crypto');

/**
 * Generate a cryptographically secure API token
 * Format: 'ta_live_' prefix + 32 random hex bytes (64 hex characters)
 * @returns {string} - The generated token
 */
function generateToken() {
  // Generate 32 random bytes (256 bits of entropy)
  const randomBytes = crypto.randomBytes(32);
  const token = 'ta_live_' + randomBytes.toString('hex');
  return token;
}

/**
 * Hash a token using SHA-256
 * @param {string} token - The token to hash
 * @returns {string} - The hex-encoded hash
 */
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

module.exports = { generateToken, hashToken };
