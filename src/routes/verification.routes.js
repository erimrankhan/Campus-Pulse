const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { confirmNoticeVerification } = require('../services/notice-store');

const router = express.Router();

/**
 * POST /api/verify
 * Confirms and stores the student-verified notice data.
 * Protected: Requires authenticated MIT Moradabad student session.
 */
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { noticeId } = req.body;

    if (!noticeId || typeof noticeId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'noticeId is required for verification confirmation.',
        status: 400
      });
    }

    const result = confirmNoticeVerification(noticeId, req.student, req.body);

    if (!result.success) {
      return res.status(result.status).json({
        error: result.reason,
        message: result.message,
        status: result.status
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notice information verified and confirmed successfully.',
      notice: result.notice
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/verify/:id
 * RESTful variant accepting notice ID in route parameters.
 */
router.post('/:id', requireAuth, (req, res, next) => {
  try {
    const noticeId = req.params.id;
    const result = confirmNoticeVerification(noticeId, req.student, req.body);

    if (!result.success) {
      return res.status(result.status).json({
        error: result.reason,
        message: result.message,
        status: result.status
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notice information verified and confirmed successfully.',
      notice: result.notice
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

