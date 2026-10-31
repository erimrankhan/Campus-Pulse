const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  extractNoticeDetails,
  validateAndSanitizeExtraction
} = require('../services/ai-extraction.service');
const {
  getNoticeById,
  updateNoticeExtraction,
  validateNoticeContent,
  MAX_NOTICE_LENGTH
} = require('../services/notice-store');

const router = express.Router();

/**
 * POST /api/extract
 * Extracts: title, date, time, venue, category from notice text using Gemini AI
 * Protected: Requires authenticated MIT Moradabad student session.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { text, noticeId } = req.body;

    let noticeText = '';
    let targetNotice = null;

    if (noticeId) {
      targetNotice = getNoticeById(noticeId);
      if (!targetNotice) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Referenced notice submission not found.',
          status: 404
        });
      }

      // Authorization check on the notice record
      if (targetNotice.submittedBy.studentId !== req.student.studentId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied to this notice submission.',
          status: 403
        });
      }

      noticeText = targetNotice.rawText;
    } else if (typeof text === 'string') {
      const validation = validateNoticeContent(text);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Bad Request',
          message: validation.reason,
          status: 400
        });
      }
      noticeText = validation.trimmedText;
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either noticeId or text content must be provided for AI extraction.',
        status: 400
      });
    }

    // Call Gemini Extraction Service
    const result = await extractNoticeDetails(noticeText);

    // If linked to a notice record, update record
    if (targetNotice) {
      updateNoticeExtraction(targetNotice.id, result.extraction);
    }

    return res.status(200).json({
      success: true,
      originalText: noticeText,
      extraction: result.extraction,
      model: result.model,
      extractedAt: new Date().toISOString()
    });
  } catch (error) {
    const statusCode = error.status || (error.code === 'CONFIG_MISSING' ? 503 : 500);
    return res.status(statusCode).json({
      error: error.code || 'Extraction Error',
      message: error.message || 'Failed to extract notice details.',
      status: statusCode
    });
  }
});

module.exports = router;

