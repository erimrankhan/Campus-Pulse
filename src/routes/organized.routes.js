const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  getVerifiedNotices,
  resolveCategoryFilter,
  MAX_SEARCH_LENGTH
} = require('../services/notice-store');
const { APPROVED_CATEGORIES } = require('../services/ai-extraction.service');

const router = express.Router();

/**
 * GET /api/notices/verified
 * Returns only student-verified campus notices.
 *
 * Query parameters:
 *   search   - optional, matches title, original notice text, and venue
 *   category - optional, one of the supported campus categories
 *
 * Protected: Requires an authenticated MIT Moradabad student session.
 */
router.get('/', requireAuth, (req, res) => {
  try {
    // Reject repeated/array query values instead of guessing which one to use.
    if (req.query.search !== undefined && typeof req.query.search !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'The search parameter must be a single text value.',
        status: 400
      });
    }

    if (req.query.category !== undefined && typeof req.query.category !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'The category parameter must be a single category value.',
        status: 400
      });
    }

    const search = req.query.search || '';
    const category = req.query.category || '';

    if (search.trim().length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Search term exceeds the maximum allowed length of ${MAX_SEARCH_LENGTH} characters.`,
        status: 400
      });
    }

    const resolvedCategory = resolveCategoryFilter(category);
    if (resolvedCategory === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Category must be one of: ${APPROVED_CATEGORIES.join(', ')}.`,
        status: 400,
        supportedCategories: APPROVED_CATEGORIES
      });
    }

    const result = getVerifiedNotices({ search, category });

    if (!result.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.reason,
        status: 400
      });
    }

    // Authenticated, student-specific content must never be cached by shared proxies.
    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      success: true,
      count: result.notices.length,
      filters: {
        search: search.trim(),
        category: resolvedCategory || 'All'
      },
      supportedCategories: APPROVED_CATEGORIES,
      notices: result.notices
    });
  } catch (error) {
    // Never leak internal store/database details to the client.
    console.error('Verified notice retrieval failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to retrieve verified notices right now. Please try again.',
      status: 500
    });
  }
});

module.exports = router;
