/**
 * Campus Pulse — Authentication Enforcement Middleware
 * 
 * Protects restricted application and API routes.
 * Inspects HTTP-only cookies and Authorization headers for a valid session token.
 */

const { getSession } = require('../services/session.service');

const COOKIE_NAME = 'campus_pulse_session';

/**
 * Middleware: Strictly requires an authenticated MIT Moradabad student session
 */
function requireAuth(req, res, next) {
  // 1. Check HTTP-only cookie first
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  // 2. Fallback to Bearer token header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. You must be signed in with an authorized MIT Moradabad student account.',
      status: 401
    });
  }

  const session = getSession(token);
  if (!session) {
    // If token was present but invalid/expired, clear cookie
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has expired or is invalid. Please sign in again.',
      status: 401
    });
  }

  // Attach student to request context
  req.student = session.student;
  req.sessionToken = token;
  next();
}

module.exports = {
  COOKIE_NAME,
  requireAuth
};

