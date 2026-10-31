const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  getVerifiedEventsForMonth,
  getMonthMeta
} = require('../services/notice-store');

const router = express.Router();

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function readSingleParam(value) {
  if (value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, value: null };
  return { ok: true, value };
}

/**
 * GET /api/calendar?year=YYYY&month=M
 * Returns only student-verified notices with a confirmed valid date in the month.
 *
 * Protected: Requires an authenticated MIT Moradabad student session.
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const yearParam = readSingleParam(req.query.year);
    const monthParam = readSingleParam(req.query.month);

    if (!yearParam.ok || !monthParam.ok) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Year and month must each be provided as a single value.',
        status: 400
      });
    }

    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = now.getMonth() + 1;

    const rawYear = yearParam.value === null ? String(defaultYear) : yearParam.value;
    const rawMonth = monthParam.value === null ? String(defaultMonth) : monthParam.value;

    if (!/^\d{4}$/.test(rawYear)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Year must be a four-digit number.',
        status: 400
      });
    }

    if (!/^\d{1,2}$/.test(rawMonth)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Month must be a number between 1 and 12.',
        status: 400
      });
    }

    const year = Number(rawYear);
    const month = Number(rawMonth);

    if (year < MIN_YEAR || year > MAX_YEAR) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`,
        status: 400
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Month must be a number between 1 and 12.',
        status: 400
      });
    }

    const { daysInMonth, firstWeekday } = getMonthMeta(year, month);
    const events = getVerifiedEventsForMonth(year, month);

    const monthLabel = new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      success: true,
      year,
      month,
      monthLabel,
      daysInMonth,
      firstWeekday,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Calendar retrieval failed:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unable to retrieve calendar events right now. Please try again.',
      status: 500
    });
  }
});

module.exports = router;
