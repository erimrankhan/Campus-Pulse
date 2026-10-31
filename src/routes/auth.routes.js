const express = require('express');
const { verifyStudentCredentials, isValidInstitutionalDomain, OFFICIAL_DOMAIN } = require('../services/student-registry');
const { createSession, destroySession, SESSION_TTL_MS } = require('../services/session.service');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticates verified MIT Moradabad students
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Institutional email and password are required',
        status: 400
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Domain Check
    if (!isValidInstitutionalDomain(cleanEmail)) {
      return res.status(403).json({
        error: 'Forbidden Domain',
        message: `Access denied. Campus Pulse is restricted exclusively to MIT Moradabad students with an @${OFFICIAL_DOMAIN} email.`,
        status: 403
      });
    }

    // 2. Student Registry Verification & Credential Check
    const verification = await verifyStudentCredentials(cleanEmail, String(password));
    if (!verification.success) {
      // Use generic 401 for bad password or unregistered student to prevent user enumeration
      const isUnregistered = verification.reason && verification.reason.includes('not found');
      return res.status(401).json({
        error: 'Unauthorized',
        message: isUnregistered ? 'Account not recognized in the MIT Moradabad student directory' : 'Invalid email or password',
        status: 401
      });
    }

    // 3. Create Authenticated Session
    const { token, expiresAt } = createSession(verification.student);

    // 4. Set Secure HTTP-only Cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
      path: '/'
    });

    return res.status(200).json({
      success: true,
      message: 'Student authentication successful',
      student: verification.student,
      token // also provided for non-browser/API clients
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Terminates the authenticated student session
 */
router.post('/logout', (req, res) => {
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  if (token) {
    destroySession(token);
  }

  res.clearCookie(COOKIE_NAME, { path: '/' });

  return res.status(200).json({
    success: true,
    message: 'Signed out successfully'
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated student context (Protected Route)
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    authenticated: true,
    student: req.student
  });
});

module.exports = router;

