const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  validateNoticeContent,
  saveNoticeSubmission,
  getNoticeById,
  getNoticesByStudent,
  MAX_NOTICE_LENGTH
} = require('../services/notice-store');

const router = express.Router();

/**
 * POST /api/notices/input
 * Submits raw notice text for storage and future AI extraction.
 * Protected: Requires authenticated MIT Moradabad student session.
 */
router.post('/input', requireAuth, (req, res, next) => {
  try {
    const { text, sourceType } = req.body;

    // Validate notice content
    const validation = validateNoticeContent(text);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.reason,
        status: 400
      });
    }

    // Save submission associated with authenticated student
    const notice = saveNoticeSubmission(validation.trimmedText, req.student, sourceType);

    return res.status(201).json({
      success: true,
      message: 'Notice text successfully recorded and queued for extraction.',
      notice
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notices/input
 * Retrieves notices submitted by the authenticated student.
 * Protected: Requires authenticated MIT Moradabad student session.
 */
router.get('/input', requireAuth, (req, res, next) => {
  try {
    const studentNotices = getNoticesByStudent(req.student.studentId);
    return res.status(200).json({
      success: true,
      count: studentNotices.length,
      notices: studentNotices
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notices/input/:id
 * Retrieves a specific notice submission by ID.
 * Protected: Requires authenticated MIT Moradabad student session.
 */
router.get('/input/:id', requireAuth, (req, res, next) => {
  try {
    const notice = getNoticeById(req.params.id);
    if (!notice) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Notice submission not found',
        status: 404
      });
    }

    // Verify ownership
    if (notice.submittedBy.studentId !== req.student.studentId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this notice record',
        status: 403
      });
    }

    return res.status(200).json({
      success: true,
      notice
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

