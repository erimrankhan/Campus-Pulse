/**
 * Campus Pulse — Server-Side Session Service
 * Manages cryptographically random session tokens with automatic TTL expiration.
 */

const crypto = require('crypto');

// Default session duration: 24 hours
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory active session store: Map<token, sessionData>
const sessions = new Map();

/**
 * Creates a new authenticated session for a verified student
 */
function createSession(student) {
  // Generate 256-bit cryptographic session token
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const sessionData = {
    token,
    student,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS
  };

  sessions.set(token, sessionData);
  return { token, expiresAt: sessionData.expiresAt };
}

/**
 * Retrieves and validates an active session
 */
function getSession(token) {
  if (!token || typeof token !== 'string') return null;

  const session = sessions.get(token);
  if (!session) return null;

  // Check TTL expiration
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * Destroys a session token (Sign-Out)
 */
function destroySession(token) {
  if (!token) return false;
  return sessions.delete(token);
}

/**
 * Periodically purge expired sessions to prevent memory growth
 */
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}, 15 * 60 * 1000); // Check every 15 minutes

module.exports = {
  SESSION_TTL_MS,
  createSession,
  getSession,
  destroySession
};

