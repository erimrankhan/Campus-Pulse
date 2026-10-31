/**
 * Campus Pulse — Notice Storage Service (Modules 3, 4 & 5)
 * 
 * Stores raw notices, preserves AI-extracted attributes, and records
 * student-verified and confirmed campus notice information.
 */

const crypto = require('crypto');
const { APPROVED_CATEGORIES } = require('./ai-extraction.service');

// In-memory notice store: Map<id, noticeRecord>
const notices = new Map();

const MAX_NOTICE_LENGTH = 5000;
const MAX_SEARCH_LENGTH = 120;

/**
 * Strictly validates a YYYY-MM-DD calendar date using UTC date parts.
 * Returns true only for real dates, including correct leap-year handling.
 */
function isValidCalendarDate(value) {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Returns month metadata using UTC so weekday alignment is timezone-independent.
 * firstWeekday is Sunday-based (0 = Sunday).
 */
function getMonthMeta(year, month) {
  return {
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  };
}

/**
 * Retrieves verified notices that have a confirmed valid date in the requested month.
 * Records without a confirmed date are deliberately excluded.
 */
function getVerifiedEventsForMonth(year, month) {
  const events = [];
  const seenIds = new Set();

  for (const notice of notices.values()) {
    if (notice.status !== 'VERIFIED' || !notice.verifiedData) continue;

    const data = notice.verifiedData;
    if (!isValidCalendarDate(data.date)) continue;

    const [eventYear, eventMonth] = data.date.split('-').map(Number);
    if (eventYear !== year || eventMonth !== month) continue;

    if (seenIds.has(notice.id)) continue;
    seenIds.add(notice.id);

    events.push({
      id: notice.id,
      title: data.title,
      date: data.date,
      time: data.time || null,
      venue: data.venue || null,
      category: data.category
    });
  }

  events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byTime = String(a.time || '').localeCompare(String(b.time || ''));
    if (byTime !== 0) return byTime;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  return events;
}

/**
 * Normalizes free-text user input for safe, case-insensitive matching.
 * Collapses repeated whitespace and trims leading/trailing spaces.
 */
function normalizeSearchTerm(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Resolves a category query value against the supported category list.
 * Returns null when no filter was supplied and undefined when invalid.
 */
function resolveCategoryFilter(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  const matched = APPROVED_CATEGORIES.find(
    (category) => category.toLowerCase() === trimmed.toLowerCase()
  );
  return matched || undefined;
}

/**
 * Retrieves only student-verified notices with optional search and category filters.
 *
 * Matching rules:
 * - search is case-insensitive and whitespace-trimmed
 * - search checks title, original notice text, and venue
 * - category must be one of the supported campus categories
 *
 * Returns public, minimal notice records (no submitter or verifier identity).
 */
function getVerifiedNotices({ search = '', category = '' } = {}) {
  const searchTerm = normalizeSearchTerm(search);
  const categoryFilter = resolveCategoryFilter(category);

  if (categoryFilter === undefined) {
    return { valid: false, reason: 'Unsupported category filter.' };
  }

  if (typeof search === 'string' && search.trim().length > MAX_SEARCH_LENGTH) {
    return {
      valid: false,
      reason: `Search term exceeds the maximum allowed length of ${MAX_SEARCH_LENGTH} characters.`
    };
  }

  const results = [];

  for (const notice of notices.values()) {
    // Strictly verified records only. Unverified AI extraction output is never exposed.
    if (notice.status !== 'VERIFIED' || !notice.verifiedData) continue;

    const data = notice.verifiedData;

    if (categoryFilter && data.category !== categoryFilter) continue;

    if (searchTerm) {
      const haystack = normalizeSearchTerm(
        [data.title, notice.rawText, data.venue].filter(Boolean).join(' ')
      );
      if (!haystack.includes(searchTerm)) continue;
    }

    results.push({
      id: notice.id,
      title: data.title,
      date: data.date || null,
      time: data.time || null,
      venue: data.venue || null,
      category: data.category,
      verifiedAt: notice.verifiedAt || null
    });
  }

  // Newest verified notices first.
  results.sort((a, b) => {
    const aTime = a.verifiedAt ? Date.parse(a.verifiedAt) : 0;
    const bTime = b.verifiedAt ? Date.parse(b.verifiedAt) : 0;
    return bTime - aTime;
  });

  return { valid: true, notices: results };
}

/**
 * Validates notice input content
 */
function validateNoticeContent(rawText) {
  if (typeof rawText !== 'string') {
    return { isValid: false, reason: 'Notice content must be a text string.' };
  }

  const trimmed = rawText.trim();

  if (trimmed.length === 0) {
    return { isValid: false, reason: 'Notice text cannot be empty or contain only whitespace.' };
  }

  if (trimmed.length > MAX_NOTICE_LENGTH) {
    return {
      isValid: false,
      reason: `Notice text exceeds maximum allowed length of ${MAX_NOTICE_LENGTH} characters (received ${trimmed.length}).`
    };
  }

  return { isValid: true, trimmedText: trimmed };
}

/**
 * Stores a validated notice submission
 */
function saveNoticeSubmission(rawText, student, sourceType = 'General') {
  const id = `notice-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const noticeRecord = {
    id,
    rawText,
    characterCount: rawText.length,
    sourceType: ['WhatsApp', 'Email', 'Poster', 'General'].includes(sourceType) ? sourceType : 'General',
    submittedBy: {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      branch: student.branch
    },
    submittedAt: now,
    status: 'PENDING_EXTRACTION',
    aiExtraction: null,
    verifiedData: null
  };

  notices.set(id, noticeRecord);
  return noticeRecord;
}

/**
 * Retrieves a notice by ID
 */
function getNoticeById(id) {
  return notices.get(id) || null;
}

/**
 * Retrieves notices submitted by a specific student
 */
function getNoticesByStudent(studentId) {
  const studentNotices = [];
  for (const notice of notices.values()) {
    if (notice.submittedBy.studentId === studentId) {
      studentNotices.push(notice);
    }
  }
  // Return sorted newest first
  return studentNotices.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

/**
 * Updates a notice with extraction result
 * Preserves the original raw AI output
 */
function updateNoticeExtraction(id, extraction) {
  const notice = notices.get(id);
  if (!notice) return null;
  notice.aiExtraction = extraction; // Preserve original AI output
  notice.extraction = extraction;   // Backwards-compatible alias
  if (notice.status !== 'VERIFIED') {
    notice.status = 'EXTRACTED';
  }
  notice.extractedAt = new Date().toISOString();
  return notice;
}

/**
 * Validates student confirmation data (Module 5)
 */
function validateVerificationInput(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, reason: 'Invalid verification payload' };
  }

  // 1. Title is required and cannot be empty
  if (typeof data.title !== 'string' || !data.title.trim()) {
    return { isValid: false, reason: 'Title is required and cannot be empty.' };
  }
  const cleanTitle = data.title.trim().slice(0, 200);

  // 2. Date is optional, but if provided must be a valid YYYY-MM-DD calendar date
  let cleanDate = null;
  if (data.date && typeof data.date === 'string' && data.date.trim()) {
    const dStr = data.date.trim();
    const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return { isValid: false, reason: 'Date must be formatted as YYYY-MM-DD or left empty if unspecified.' };
    }
    if (!isValidCalendarDate(dStr)) {
      return { isValid: false, reason: 'Provided date is an invalid calendar date.' };
    }
    cleanDate = dStr;
  }

  // 3. Time is optional
  let cleanTime = null;
  if (data.time && typeof data.time === 'string' && data.time.trim()) {
    cleanTime = data.time.trim().slice(0, 100);
  }

  // 4. Venue is optional
  let cleanVenue = null;
  if (data.venue && typeof data.venue === 'string' && data.venue.trim()) {
    cleanVenue = data.venue.trim().slice(0, 200);
  }

  // 5. Category must be valid
  let cleanCategory = 'General';
  if (data.category && typeof data.category === 'string') {
    const matched = APPROVED_CATEGORIES.find(c => c.toLowerCase() === data.category.trim().toLowerCase());
    if (!matched) {
      return {
        isValid: false,
        reason: `Category must be one of: ${APPROVED_CATEGORIES.join(', ')}.`
      };
    }
    cleanCategory = matched;
  }

  return {
    isValid: true,
    verifiedData: {
      title: cleanTitle,
      date: cleanDate,
      time: cleanTime,
      venue: cleanVenue,
      category: cleanCategory
    }
  };
}

/**
 * Confirms and stores the student-verified notice data
 */
function confirmNoticeVerification(noticeId, student, inputData) {
  const notice = notices.get(noticeId);
  if (!notice) {
    return { success: false, status: 404, reason: 'NOT_FOUND', message: 'Notice not found.' };
  }

  // Authorization check: student can only verify their own notices
  if (notice.submittedBy.studentId !== student.studentId) {
    return {
      success: false,
      status: 403,
      reason: 'FORBIDDEN',
      message: 'Access denied. You cannot verify notice submissions belonging to another student.'
    };
  }

  // Prevent duplicate confirmation
  if (notice.status === 'VERIFIED') {
    return {
      success: false,
      status: 409,
      reason: 'DUPLICATE',
      message: 'This notice information has already been confirmed and verified.'
    };
  }

  // Validate fields
  const validation = validateVerificationInput(inputData);
  if (!validation.isValid) {
    return {
      success: false,
      status: 400,
      reason: 'VALIDATION_ERROR',
      message: validation.reason
    };
  }

  // Save verified data while strictly preserving original rawText and aiExtraction separately
  const now = new Date().toISOString();
  notice.verifiedData = validation.verifiedData;
  notice.status = 'VERIFIED';
  notice.verifiedAt = now;
  notice.verifiedBy = {
    studentId: student.studentId,
    name: student.name,
    email: student.email,
    branch: student.branch
  };

  return {
    success: true,
    status: 200,
    notice
  };
}

module.exports = {
  MAX_NOTICE_LENGTH,
  MAX_SEARCH_LENGTH,
  validateNoticeContent,
  saveNoticeSubmission,
  getNoticeById,
  getNoticesByStudent,
  updateNoticeExtraction,
  validateVerificationInput,
  confirmNoticeVerification,
  normalizeSearchTerm,
  resolveCategoryFilter,
  getVerifiedNotices,
  isValidCalendarDate,
  getMonthMeta,
  getVerifiedEventsForMonth
};
