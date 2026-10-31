/**
 * Campus Pulse — Client Application
 * Module 1: Foundation
 * Module 2: MIT Student Authentication
 * Module 3: Smart Input Intake
 * Module 4: AI Extraction
 * Module 5: Extracted Information Verification
 * Module 6: Organized View
 * Module 7: Calendar
 */

// Application State
const state = {
  student: null,
  isAuthenticated: false,
  submittedNotices: [],
  lastExtraction: null,
  activeVerificationNoticeId: null,
  organizedSearch: '',
  organizedCategory: '',
  organizedNotices: [],
  organizedRequestId: 0,
  calendarYear: null,
  calendarMonth: null,
  calendarMonthLabel: '',
  calendarDaysInMonth: 0,
  calendarFirstWeekday: 0,
  calendarEvents: [],
  calendarSelectedDate: null,
  calendarRequestId: 0
};

const MAX_NOTICE_LENGTH = 5000;

document.addEventListener('DOMContentLoaded', () => {
  initSystemClock();
  initAuthForm();
  initSignOut();
  initSmartInput();
  initAIExtraction();
  initVerification();
  initOrganizedView();
  initCalendar();
  checkHealthStatus();
  checkAuthSession();

  // Periodic health ping every 30 seconds
  setInterval(checkHealthStatus, 30000);
});

/**
 * Initializes live system time in the UI
 */
function initSystemClock() {
  const timeElement = document.getElementById('system-time');
  if (!timeElement) return;

  function updateClock() {
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * Verifies if an active HTTP-only session exists on page load/refresh
 */
async function checkAuthSession() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.authenticated && data.student) {
        state.isAuthenticated = true;
        state.student = data.student;
        renderAuthState();
        loadSubmittedNotices();
        loadOrganizedView();
        openCalendar();
        return;
      }
    }
  } catch (err) {
    // Session check error or unauthenticated
  }

  state.isAuthenticated = false;
  state.student = null;
  renderAuthState();
}

/**
 * Configures the student sign-in form handler
 */
function initAuthForm() {
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('input-email');
  const passwordInput = document.getElementById('input-password');
  const submitBtn = document.getElementById('btn-submit-signin');
  const btnText = document.getElementById('btn-signin-text');
  const btnSpinner = document.getElementById('btn-signin-spinner');
  const alertBox = document.getElementById('auth-alert');
  const alertMsg = document.getElementById('auth-alert-msg');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    // Client-side quick validation
    if (!email || !password) {
      showAlert('Please enter both your institutional email and password.');
      return;
    }

    if (!email.endsWith('@mitmoradabad.edu.in')) {
      showAlert('Access restricted. Please use your official MIT Moradabad student email (@mitmoradabad.edu.in).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please check your credentials.');
      }

      state.isAuthenticated = true;
      state.student = data.student;
      form.reset();
      renderAuthState();
      loadSubmittedNotices();
      loadOrganizedView();
      openCalendar();
    } catch (error) {
      showAlert(error.message);
    } finally {
      setLoading(false);
    }
  });

  function showAlert(msg) {
    if (alertBox && alertMsg) {
      alertMsg.textContent = msg;
      alertBox.style.display = 'flex';
    }
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.style.display = 'none';
    }
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (btnText) btnText.textContent = isLoading ? 'Verifying Student...' : 'Sign In to Campus Pulse';
    if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
  }
}

/**
 * Configures the student sign-out handler
 */
function initSignOut() {
  const signoutBtn = document.getElementById('btn-signout');
  if (!signoutBtn) return;

  signoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin'
      });
    } catch (err) {
      console.warn('Logout request error:', err);
    } finally {
      state.isAuthenticated = false;
      state.student = null;
      state.submittedNotices = [];
      state.lastExtraction = null;
      state.activeVerificationNoticeId = null;
      state.organizedSearch = '';
      state.organizedCategory = '';
      state.organizedNotices = [];
      state.organizedRequestId++;
      resetOrganizedViewUi();
      state.calendarRequestId++;
      resetCalendarUi();
      renderAuthState();
    }
  });
}

/**
 * Toggles UI between Sign-In View and Authenticated Workspace
 */
function renderAuthState() {
  const authSection = document.getElementById('auth-section');
  const protectedWorkspace = document.getElementById('protected-workspace');
  const authUserBar = document.getElementById('auth-user-bar');
  const userDisplayName = document.getElementById('user-display-name');
  const heroStudentName = document.getElementById('hero-student-name');
  const profileStudentId = document.getElementById('profile-student-id');
  const profileBranch = document.getElementById('profile-branch');
  const profileEmail = document.getElementById('profile-email');

  if (state.isAuthenticated && state.student) {
    if (authSection) authSection.style.display = 'none';
    if (protectedWorkspace) protectedWorkspace.style.display = 'block';
    if (authUserBar) authUserBar.style.display = 'flex';

    if (userDisplayName) userDisplayName.textContent = state.student.name;
    if (heroStudentName) heroStudentName.textContent = state.student.name;
    if (profileStudentId) profileStudentId.textContent = state.student.studentId;
    if (profileBranch) profileBranch.textContent = state.student.branch;
    if (profileEmail) profileEmail.textContent = state.student.email;
  } else {
    if (authSection) authSection.style.display = 'flex';
    if (protectedWorkspace) protectedWorkspace.style.display = 'none';
    if (authUserBar) authUserBar.style.display = 'none';
  }
}

/* ==========================================================================
   MODULE 3: SMART INPUT FUNCTIONALITY
   ========================================================================= */

function initSmartInput() {
  const form = document.getElementById('smart-input-form');
  const textarea = document.getElementById('notice-raw-text');
  const charCounter = document.getElementById('char-counter');
  const submitBtn = document.getElementById('btn-submit-notice');
  const submitText = document.getElementById('btn-submit-text');
  const submitSpinner = document.getElementById('btn-submit-spinner');
  const resetBtn = document.getElementById('btn-reset-notice');
  const feedbackBanner = document.getElementById('smart-input-feedback');
  const feedbackIcon = document.getElementById('feedback-icon');
  const feedbackTitle = document.getElementById('feedback-title');
  const feedbackMsg = document.getElementById('feedback-msg');

  if (!form || !textarea) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCounter.textContent = `${len.toLocaleString()} / ${MAX_NOTICE_LENGTH.toLocaleString()} characters`;

    charCounter.classList.remove('warning', 'limit');
    if (len >= MAX_NOTICE_LENGTH) {
      charCounter.classList.add('limit');
    } else if (len >= MAX_NOTICE_LENGTH * 0.9) {
      charCounter.classList.add('warning');
    }
  });

  resetBtn.addEventListener('click', () => {
    textarea.value = '';
    charCounter.textContent = `0 / ${MAX_NOTICE_LENGTH.toLocaleString()} characters`;
    charCounter.classList.remove('warning', 'limit');
    hideFeedback();
    textarea.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideFeedback();

    const rawText = textarea.value;
    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
      showFeedback('error', 'Validation Error', 'Notice text cannot be empty or contain only whitespace.');
      textarea.focus();
      return;
    }

    if (trimmed.length > MAX_NOTICE_LENGTH) {
      showFeedback(
        'error',
        'Length Exceeded',
        `Notice text exceeds the maximum permitted limit of ${MAX_NOTICE_LENGTH} characters.`
      );
      return;
    }

    const selectedSource = form.querySelector('input[name="sourceType"]:checked');
    const sourceType = selectedSource ? selectedSource.value : 'General';

    setSubmitting(true);

    try {
      const response = await fetch('/api/notices/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          text: rawText,
          sourceType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit notice content.');
      }

      showFeedback(
        'success',
        'Notice Received Successfully',
        `Notice [ID: ${data.notice.id}] recorded and safely preserved for Module 4 extraction.`
      );

      textarea.value = '';
      charCounter.textContent = `0 / ${MAX_NOTICE_LENGTH.toLocaleString()} characters`;
      charCounter.classList.remove('warning', 'limit');

      loadSubmittedNotices();
    } catch (error) {
      showFeedback('error', 'Submission Failed', error.message);
    } finally {
      setSubmitting(false);
    }
  });

  function showFeedback(type, title, message) {
    if (!feedbackBanner) return;
    feedbackBanner.className = `feedback-banner ${type}`;
    if (feedbackIcon) feedbackIcon.textContent = type === 'success' ? '✅' : '⚠️';
    if (feedbackTitle) feedbackTitle.textContent = title;
    if (feedbackMsg) feedbackMsg.textContent = message;
    feedbackBanner.style.display = 'flex';
  }

  function hideFeedback() {
    if (!feedbackBanner) return;
    feedbackBanner.style.display = 'none';
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (submitText) submitText.textContent = isSubmitting ? 'Recording Notice...' : 'Submit Notice Text';
    if (submitSpinner) submitSpinner.style.display = isSubmitting ? 'inline-block' : 'none';
  }
}

/* ==========================================================================
   MODULE 4: AI EXTRACTION FUNCTIONALITY
   ========================================================================== */

function initAIExtraction() {
  const extractDirectBtn = document.getElementById('btn-extract-direct');
  const extractText = document.getElementById('btn-extract-text');
  const extractSpinner = document.getElementById('btn-extract-spinner');
  const textarea = document.getElementById('notice-raw-text');
  const form = document.getElementById('smart-input-form');

  if (!extractDirectBtn || !textarea) return;

  extractDirectBtn.addEventListener('click', async () => {
    const rawText = textarea.value;
    const trimmed = rawText.trim();

    if (trimmed.length === 0) {
      showExtractionFeedback('error', 'Input Required', 'Please enter or paste notice text to extract.');
      textarea.focus();
      return;
    }

    if (trimmed.length > MAX_NOTICE_LENGTH) {
      showExtractionFeedback(
        'error',
        'Length Exceeded',
        `Notice text exceeds the maximum permitted limit of ${MAX_NOTICE_LENGTH} characters.`
      );
      return;
    }

    const selectedSource = form ? form.querySelector('input[name="sourceType"]:checked') : null;
    const sourceType = selectedSource ? selectedSource.value : 'General';

    setExtracting(true);
    hideExtractionFeedback();

    try {
      // 1. Submit notice first to preserve raw record
      const submitRes = await fetch('/api/notices/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ text: rawText, sourceType })
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.message || 'Failed to record notice.');
      }

      // 2. Execute AI Extraction
      await executeExtraction({
        noticeId: submitData.notice.id,
        text: rawText
      });

      // Clear textarea upon success
      textarea.value = '';
      const charCounter = document.getElementById('char-counter');
      if (charCounter) charCounter.textContent = `0 / ${MAX_NOTICE_LENGTH.toLocaleString()} characters`;

      loadSubmittedNotices();
    } catch (err) {
      showExtractionFeedback('error', 'AI Extraction Error', err.message);
    } finally {
      setExtracting(false);
    }
  });

  function setExtracting(isExtracting) {
    if (!extractDirectBtn) return;
    extractDirectBtn.disabled = isExtracting;
    if (extractText) extractText.textContent = isExtracting ? 'Analyzing with Gemini AI...' : '⚡ Submit & Extract with AI';
    if (extractSpinner) extractSpinner.style.display = isExtracting ? 'inline-block' : 'none';
  }
}

/**
 * Triggers backend AI extraction and displays results
 */
async function executeExtraction(payload) {
  const resultsCard = document.getElementById('extraction-results-card');
  const emptyBox = document.getElementById('empty-extraction-box');

  hideExtractionFeedback();

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'AI extraction failed.');
    }

    state.lastExtraction = data.extraction;

    // Render extracted fields
    renderExtractedFields(data.extraction, data.originalText);

    if (emptyBox) emptyBox.style.display = 'none';
    if (resultsCard) resultsCard.style.display = 'flex';

    showExtractionFeedback(
      'success',
      'AI Extraction Complete',
      `Event details extracted using ${data.model || 'Gemini AI'}. Review the structured fields below.`
    );

    // Smooth scroll to extraction section
    const extractionSection = document.getElementById('ai-extraction-section');
    if (extractionSection) {
      extractionSection.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    showExtractionFeedback('error', 'Extraction Failed', error.message);
    throw error;
  }
}

/**
 * Renders extracted fields safely using textContent
 */
function renderExtractedFields(extraction, originalText) {
  const fields = [
    { id: 'ext-val-title', val: extraction.title },
    { id: 'ext-val-date', val: extraction.date },
    { id: 'ext-val-time', val: extraction.time },
    { id: 'ext-val-venue', val: extraction.venue },
    { id: 'ext-val-category', val: extraction.category }
  ];

  fields.forEach(({ id, val }) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (val && String(val).trim()) {
      el.textContent = String(val).trim();
      el.classList.remove('empty-field');
    } else {
      el.textContent = 'Not specified';
      el.classList.add('empty-field');
    }
  });

  // Reference comparison text
  const compEl = document.getElementById('ext-comparison-raw');
  if (compEl) {
    compEl.textContent = originalText || 'No original text available.';
  }
}

function showExtractionFeedback(type, title, message) {
  const banner = document.getElementById('extraction-feedback');
  const icon = document.getElementById('extraction-feedback-icon');
  const titleEl = document.getElementById('extraction-feedback-title');
  const msgEl = document.getElementById('extraction-feedback-msg');

  if (!banner) return;
  banner.className = `feedback-banner ${type}`;
  if (icon) icon.textContent = type === 'success' ? '✅' : '⚠️';
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  banner.style.display = 'flex';
}

function hideExtractionFeedback() {
  const banner = document.getElementById('extraction-feedback');
  if (banner) banner.style.display = 'none';
}

/**
 * Loads and renders notices submitted by the authenticated student
 */
async function loadSubmittedNotices() {
  const container = document.getElementById('submissions-container');
  const countBadge = document.getElementById('submissions-count-badge');
  const emptyMsg = document.getElementById('empty-submissions-msg');

  if (!container) return;

  try {
    const response = await fetch('/api/notices/input', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (response.ok) {
      const data = await response.json();
      state.submittedNotices = data.notices || [];

      if (countBadge) {
        countBadge.textContent = `${state.submittedNotices.length} Submission${state.submittedNotices.length === 1 ? '' : 's'}`;
      }

      container.replaceChildren();

      if (state.submittedNotices.length === 0) {
        if (emptyMsg) {
          container.appendChild(emptyMsg);
          emptyMsg.style.display = 'block';
        }
        return;
      }

      state.submittedNotices.forEach(notice => {
        const card = document.createElement('article');
        card.className = 'submission-card';

        // Header
        const header = document.createElement('div');
        header.className = 'submission-header';

        const meta = document.createElement('div');
        meta.className = 'submission-meta';

        const idSpan = document.createElement('span');
        idSpan.className = 'submission-id';
        idSpan.textContent = notice.id;

        const sourceSpan = document.createElement('span');
        sourceSpan.textContent = `• Origin: ${notice.sourceType}`;

        const countSpan = document.createElement('span');
        countSpan.textContent = `• ${notice.characterCount.toLocaleString()} chars`;

        const timeSpan = document.createElement('span');
        timeSpan.textContent = `• ${new Date(notice.submittedAt).toLocaleTimeString()}`;

        meta.appendChild(idSpan);
        meta.appendChild(sourceSpan);
        meta.appendChild(countSpan);
        meta.appendChild(timeSpan);

        const statusBadge = document.createElement('span');
        if (notice.status === 'VERIFIED') {
          statusBadge.className = 'submission-status status-verified';
          statusBadge.textContent = 'Verified';
        } else if (notice.status === 'EXTRACTED') {
          statusBadge.className = 'submission-status status-extracted';
          statusBadge.textContent = 'AI Extracted';
        } else {
          statusBadge.className = 'submission-status';
          statusBadge.textContent = 'Pending AI Extraction';
        }

        header.appendChild(meta);
        header.appendChild(statusBadge);

        // Body with preserved raw text (Safe textContent rendering)
        const rawPre = document.createElement('pre');
        rawPre.className = 'submission-raw-text';
        rawPre.textContent = notice.rawText;

        // Action row: Extract with AI button on card
        const actionsRow = document.createElement('div');
        actionsRow.className = 'submission-actions-row';

        const extractBtn = document.createElement('button');
        extractBtn.type = 'button';
        extractBtn.className = 'btn-extract-card';
        extractBtn.textContent = '⚡ Extract with AI';
        extractBtn.addEventListener('click', async () => {
          extractBtn.disabled = true;
          extractBtn.textContent = 'Extracting...';
          try {
            await executeExtraction({
              noticeId: notice.id,
              text: notice.rawText
            });
            loadSubmittedNotices();
          } catch (err) {
            // Handled in executeExtraction
          } finally {
            extractBtn.disabled = false;
            extractBtn.textContent = '⚡ Extract with AI';
          }
        });

        actionsRow.appendChild(extractBtn);

        const verifyBtn = document.createElement('button');
        verifyBtn.type = 'button';
        verifyBtn.className = 'btn-verify-card';
        verifyBtn.textContent = notice.status === 'VERIFIED' ? '✓ View Verified Data' : '✓ Verify & Confirm';
        verifyBtn.addEventListener('click', () => openVerificationForNotice(notice));
        actionsRow.appendChild(verifyBtn);

        card.appendChild(header);
        card.appendChild(rawPre);
        card.appendChild(actionsRow);
        container.appendChild(card);
      });
    }
  } catch (err) {
    console.warn('Failed to load notices:', err);
  }
}

/* ==========================================================================
   MODULE 5: VERIFICATION & CONFIRMATION FUNCTIONALITY
   ========================================================================== */

function initVerification() {
  const form = document.getElementById('verification-form');
  const emptyBox = document.getElementById('empty-verification-box');
  const card = document.getElementById('verification-card');
  const feedbackBanner = document.getElementById('verification-feedback');
  const feedbackIcon = document.getElementById('verification-feedback-icon');
  const feedbackTitle = document.getElementById('verification-feedback-title');
  const feedbackMsg = document.getElementById('verification-feedback-msg');
  const noticeIdBadge = document.getElementById('verify-notice-id-badge');
  const rawTextEl = document.getElementById('verify-original-raw-text');
  const titleInput = document.getElementById('verify-title');
  const dateInput = document.getElementById('verify-date');
  const timeInput = document.getElementById('verify-time');
  const venueInput = document.getElementById('verify-venue');
  const categorySelect = document.getElementById('verify-category');
  const submitBtn = document.getElementById('btn-confirm-verification');
  const submitText = document.getElementById('btn-confirm-text');
  const submitSpinner = document.getElementById('btn-confirm-spinner');

  if (!form || !titleInput || !categorySelect) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideVerificationFeedback();

    const noticeId = state.activeVerificationNoticeId;
    if (!noticeId) {
      showVerificationFeedback('error', 'No Notice Selected', 'Select a submitted notice before confirming verification.');
      return;
    }

    const title = titleInput.value.trim();
    if (!title) {
      showVerificationFeedback('error', 'Title Required', 'Please enter a title before confirming verification.');
      titleInput.focus();
      return;
    }

    setVerificationSubmitting(true);

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          noticeId,
          title,
          date: dateInput.value.trim(),
          time: timeInput.value.trim(),
          venue: venueInput.value.trim(),
          category: categorySelect.value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification could not be confirmed.');
      }

      renderConfirmedSummary(data.notice.verifiedData, data.notice.verifiedAt);
      showVerificationFeedback('success', 'Notice Verified', 'The confirmed information is now available in the organized verified notice list.');

      await Promise.all([loadSubmittedNotices(), loadOrganizedView(), refreshCalendar()]);
    } catch (error) {
      showVerificationFeedback('error', 'Verification Failed', error.message);
    } finally {
      setVerificationSubmitting(false);
      if (state.activeVerificationNoticeId) {
        const active = state.submittedNotices.find(n => n.id === state.activeVerificationNoticeId);
        if (active && active.status === 'VERIFIED') {
          setVerifiedButtonState(true);
        }
      }
    }
  });

  function setVerificationSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (submitText) submitText.textContent = isSubmitting ? 'Confirming Verification...' : '✓ Confirm Verified Information';
    if (submitSpinner) submitSpinner.style.display = isSubmitting ? 'inline-block' : 'none';
  }

  function setVerifiedButtonState(isVerified) {
    if (!submitBtn) return;
    submitBtn.disabled = isVerified;
    if (submitText) submitText.textContent = isVerified ? '✓ Information Already Verified' : '✓ Confirm Verified Information';
    if (submitSpinner) submitSpinner.style.display = 'none';
  }

  function showVerificationFeedback(type, title, message) {
    if (!feedbackBanner) return;
    feedbackBanner.className = `feedback-banner ${type}`;
    if (feedbackIcon) feedbackIcon.textContent = type === 'success' ? '✅' : '⚠️';
    if (feedbackTitle) feedbackTitle.textContent = title;
    if (feedbackMsg) feedbackMsg.textContent = message;
    feedbackBanner.style.display = 'flex';
  }

  function hideVerificationFeedback() {
    if (feedbackBanner) feedbackBanner.style.display = 'none';
  }

  // Expose helpers consumed by the submission list and shared openers below.
  window.campusPulseVerification = {
    showVerificationFeedback,
    hideVerificationFeedback,
    setVerifiedButtonState,
    emptyBox,
    card,
    noticeIdBadge,
    rawTextEl,
    titleInput,
    dateInput,
    timeInput,
    venueInput,
    categorySelect
  };
}

/**
 * Opens the verification form for a submitted notice and prefills known data.
 */
function openVerificationForNotice(notice) {
  if (!notice) return;

  const ui = window.campusPulseVerification;
  if (!ui) return;

  state.activeVerificationNoticeId = notice.id;

  if (ui.emptyBox) ui.emptyBox.style.display = 'none';
  if (ui.card) ui.card.style.display = 'flex';
  if (ui.noticeIdBadge) ui.noticeIdBadge.textContent = `ID: ${notice.id}`;
  if (ui.rawTextEl) ui.rawTextEl.textContent = notice.rawText || 'No original text available.';

  const data = notice.verifiedData || notice.aiExtraction || {};

  if (ui.titleInput) ui.titleInput.value = data.title || '';
  if (ui.dateInput) ui.dateInput.value = data.date || '';
  if (ui.timeInput) ui.timeInput.value = data.time || '';
  if (ui.venueInput) ui.venueInput.value = data.venue || '';

  if (ui.categorySelect) {
    const hasCategory = Array.from(ui.categorySelect.options).some(opt => opt.value === data.category);
    ui.categorySelect.value = hasCategory ? data.category : 'General';
  }

  ui.hideVerificationFeedback();

  const summaryBox = document.getElementById('confirmed-summary-box');

  if (notice.status === 'VERIFIED' && notice.verifiedData) {
    renderConfirmedSummary(notice.verifiedData, notice.verifiedAt);
    ui.setVerifiedButtonState(true);
  } else {
    if (summaryBox) summaryBox.style.display = 'none';
    ui.setVerifiedButtonState(false);
  }

  if (ui.card) {
    ui.card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Renders the confirmed verification summary using safe textContent.
 */
function renderConfirmedSummary(verifiedData, verifiedAt) {
  const summaryBox = document.getElementById('confirmed-summary-box');
  if (!summaryBox || !verifiedData) return;

  const values = {
    'confirmed-val-title': verifiedData.title,
    'confirmed-val-date': verifiedData.date,
    'confirmed-val-time': verifiedData.time,
    'confirmed-val-venue': verifiedData.venue,
    'confirmed-val-category': verifiedData.category
  };

  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value && String(value).trim() ? String(value).trim() : 'Not specified';
  });

  const timestampEl = document.getElementById('confirmed-timestamp');
  if (timestampEl) {
    const parsed = verifiedAt ? new Date(verifiedAt) : null;
    timestampEl.textContent = parsed && !Number.isNaN(parsed.getTime())
      ? `Verified ${parsed.toLocaleString('en-IN')}`
      : '';
  }

  summaryBox.style.display = 'block';
}

/* ==========================================================================
   MODULE 6: ORGANIZED VIEW FUNCTIONALITY
   ========================================================================== */

function initOrganizedView() {
  const form = document.getElementById('organized-filter-form');
  const searchInput = document.getElementById('notice-search');
  const categorySelect = document.getElementById('category-filter');
  const clearBtn = document.getElementById('btn-clear-filters');
  const retryBtn = document.getElementById('btn-retry-organized');

  if (!form || !searchInput || !categorySelect) return;

  const debouncedSearch = debounce(() => {
    state.organizedSearch = searchInput.value;
    loadOrganizedView();
  }, 300);

  searchInput.addEventListener('input', debouncedSearch);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state.organizedSearch = searchInput.value;
    state.organizedCategory = categorySelect.value;
    loadOrganizedView();
  });

  categorySelect.addEventListener('change', () => {
    state.organizedSearch = searchInput.value;
    state.organizedCategory = categorySelect.value;
    loadOrganizedView();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    categorySelect.value = '';
    state.organizedSearch = '';
    state.organizedCategory = '';
    loadOrganizedView();
    searchInput.focus();
  });

  if (retryBtn) {
    retryBtn.addEventListener('click', () => loadOrganizedView());
  }
}

function debounce(fn, delay) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Fetches verified notices from the protected backend endpoint and renders them.
 */
async function loadOrganizedView() {
  if (!state.isAuthenticated) return;

  const countBadge = document.getElementById('organized-count-badge');
  const list = document.getElementById('organized-notices-list');
  const emptyState = document.getElementById('organized-empty');
  const searchInput = document.getElementById('notice-search');
  const categorySelect = document.getElementById('category-filter');

  const requestId = ++state.organizedRequestId;

  setOrganizedViewState('loading');
  if (countBadge) countBadge.textContent = 'Loading…';

  const search = state.organizedSearch.trim();
  const category = state.organizedCategory;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  const query = params.toString();

  try {
    const response = await fetch(`/api/notices/verified${query ? `?${query}` : ''}`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (requestId !== state.organizedRequestId) return;

    if (response.status === 401) {
      state.isAuthenticated = false;
      state.student = null;
      resetOrganizedViewUi();
      renderAuthState();
      return;
    }

    let data = {};
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('The server returned an unexpected response.');
    }

    if (!response.ok) {
      const friendlyMessage = response.status >= 500
        ? 'The server could not load verified notices. Please try again.'
        : (data.message || 'Unable to load verified notices.');
      throw new Error(friendlyMessage);
    }

    if (!Array.isArray(data.notices)) {
      throw new Error('The server returned an unexpected notice list.');
    }

    state.organizedNotices = data.notices;

    renderOrganizedNotices(data.notices);
    setOrganizedViewState('ready');

    if (countBadge) {
      const count = data.notices.length;
      countBadge.textContent = `${count} Verified Notice${count === 1 ? '' : 's'}`;
    }

    if (searchInput) searchInput.value = state.organizedSearch;
    if (categorySelect) categorySelect.value = state.organizedCategory;
  } catch (error) {
    if (requestId !== state.organizedRequestId) return;

    state.organizedNotices = [];
    if (list) {
      list.replaceChildren();
      list.style.display = 'none';
    }
    if (emptyState) emptyState.style.display = 'none';

    const message = error && error.message
      ? error.message
      : 'Unable to load verified notices. Please check your connection and try again.';

    setOrganizedViewState('error', message);
    if (countBadge) countBadge.textContent = 'Unavailable';
  }
}

/**
 * Builds verified notice cards with textContent only (no HTML injection).
 */
function renderOrganizedNotices(notices) {
  const list = document.getElementById('organized-notices-list');
  const emptyState = document.getElementById('organized-empty');
  const emptyTitle = document.getElementById('organized-empty-title');
  const emptyMessage = document.getElementById('organized-empty-message');

  if (!list) return;

  list.replaceChildren();

  const hasFilters = Boolean(state.organizedSearch.trim() || state.organizedCategory);

  if (!Array.isArray(notices) || notices.length === 0) {
    list.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';

    if (emptyTitle) {
      emptyTitle.textContent = hasFilters ? 'No matching notices found' : 'No verified notices yet';
    }

    if (emptyMessage) {
      if (hasFilters) {
        const parts = [];
        if (state.organizedSearch.trim()) parts.push(`"${state.organizedSearch.trim()}"`);
        if (state.organizedCategory) parts.push(`the ${state.organizedCategory} category`);
        emptyMessage.textContent = `No verified notices match ${parts.join(' in ')}. Try a different search term or clear the filters.`;
      } else {
        emptyMessage.textContent = 'Confirmed notices will appear here once students verify them.';
      }
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const cards = notices.map((notice) => buildOrganizedNoticeCard(notice));
  list.replaceChildren(...cards);
  list.style.display = 'grid';
}

function buildOrganizedNoticeCard(notice) {
  const card = document.createElement('article');
  card.className = 'organized-notice-card';

  const top = document.createElement('div');
  top.className = 'notice-card-top';

  const title = document.createElement('h3');
  title.className = 'notice-card-title';
  title.textContent = notice.title && String(notice.title).trim()
    ? String(notice.title).trim()
    : 'Not specified';

  const category = document.createElement('span');
  category.className = 'notice-category-badge';
  category.textContent = notice.category && String(notice.category).trim()
    ? String(notice.category).trim()
    : 'Not specified';

  top.appendChild(title);
  top.appendChild(category);

  const meta = document.createElement('div');
  meta.className = 'notice-card-meta';

  const fields = [
    { label: 'Date', value: formatNoticeDate(notice.date) },
    { label: 'Time', value: notice.time },
    { label: 'Venue', value: notice.venue }
  ];

  fields.forEach(({ label, value }) => {
    const field = document.createElement('span');
    field.className = 'notice-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'notice-field-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'notice-field-value';

    const cleanValue = value && String(value).trim() ? String(value).trim() : 'Not specified';
    valueEl.textContent = cleanValue;
    if (cleanValue === 'Not specified') valueEl.classList.add('empty-field');

    field.appendChild(labelEl);
    field.appendChild(valueEl);
    meta.appendChild(field);
  });

  const footer = document.createElement('div');
  footer.className = 'notice-card-footer';

  const tick = document.createElement('span');
  tick.className = 'verified-tick';
  tick.textContent = '✓ Verified';

  const verifiedDate = formatVerifiedTimestamp(notice.verifiedAt);
  const footerText = document.createElement('span');
  footerText.textContent = verifiedDate ? `on ${verifiedDate}` : 'by a MIT student';

  footer.appendChild(tick);
  footer.appendChild(footerText);

  card.appendChild(top);
  card.appendChild(meta);
  card.appendChild(footer);

  return card;
}

function formatNoticeDate(value) {
  if (!value || typeof value !== 'string') return 'Not specified';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value.trim();

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatVerifiedTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function setOrganizedViewState(mode, errorMessage) {
  const loading = document.getElementById('organized-loading');
  const errorState = document.getElementById('organized-error');
  const errorMessageEl = document.getElementById('organized-error-message');
  const emptyState = document.getElementById('organized-empty');
  const list = document.getElementById('organized-notices-list');

  if (loading) loading.style.display = mode === 'loading' ? 'flex' : 'none';
  if (errorState) errorState.style.display = mode === 'error' ? 'flex' : 'none';

  if (mode === 'loading' || mode === 'error') {
    if (emptyState) emptyState.style.display = 'none';
    if (list) list.style.display = 'none';
  }

  if (mode === 'error' && errorMessageEl) {
    errorMessageEl.textContent = errorMessage || 'Please check your connection and try again.';
  }
}

function resetOrganizedViewUi() {
  const searchInput = document.getElementById('notice-search');
  const categorySelect = document.getElementById('category-filter');
  const list = document.getElementById('organized-notices-list');
  const countBadge = document.getElementById('organized-count-badge');
  const loading = document.getElementById('organized-loading');
  const errorState = document.getElementById('organized-error');
  const emptyState = document.getElementById('organized-empty');

  state.organizedSearch = '';
  state.organizedCategory = '';
  state.organizedNotices = [];

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = '';
  if (list) {
    list.replaceChildren();
    list.style.display = 'none';
  }
  if (countBadge) countBadge.textContent = '0 Verified Notices';
  if (loading) loading.style.display = 'none';
  if (errorState) errorState.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
}

/* ==========================================================================
   MODULE 7: CALENDAR FUNCTIONALITY
   ========================================================================== */

const CALENDAR_MIN_YEAR = 1900;
const CALENDAR_MAX_YEAR = 2100;
const CALENDAR_MAX_VISIBLE_CHIPS = 2;
const CALENDAR_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function initCalendar() {
  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');
  const retryBtn = document.getElementById('btn-retry-calendar');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigateCalendarMonth(-1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateCalendarMonth(1));
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => refreshCalendar());
  }

  const today = getLocalDateParts(new Date());
  state.calendarYear = today.year;
  state.calendarMonth = today.month;
  state.calendarMonthLabel = formatMonthLabel(today.year, today.month);
  state.calendarSelectedDate = null;

  const heading = document.getElementById('calendar-month-heading');
  if (heading) heading.textContent = state.calendarMonthLabel;

  updateCalendarNavState();
}

/**
 * Loads the current local month for a freshly authenticated session.
 */
function openCalendar() {
  if (!state.isAuthenticated) return;

  const today = getLocalDateParts(new Date());
  state.calendarSelectedDate = null;
  loadCalendarMonth(today.year, today.month);
}

/**
 * Reloads the currently displayed month (used after a notice is verified).
 */
function refreshCalendar() {
  if (!state.isAuthenticated) return;
  if (!state.calendarYear || !state.calendarMonth) return;
  loadCalendarMonth(state.calendarYear, state.calendarMonth);
}

function navigateCalendarMonth(delta) {
  if (!state.isAuthenticated) return;

  let year = state.calendarYear;
  let month = state.calendarMonth;

  if (!year || !month) {
    const today = getLocalDateParts(new Date());
    year = today.year;
    month = today.month;
  }

  month += delta;

  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }

  if (year < CALENDAR_MIN_YEAR || year > CALENDAR_MAX_YEAR) {
    return;
  }

  state.calendarSelectedDate = null;
  loadCalendarMonth(year, month);
}

/**
 * Fetches verified events for a month and renders the calendar grid.
 */
async function loadCalendarMonth(year, month) {
  if (!state.isAuthenticated) return;

  const requestId = ++state.calendarRequestId;

  state.calendarYear = year;
  state.calendarMonth = month;
  state.calendarMonthLabel = formatMonthLabel(year, month);
  state.calendarSelectedDate = null;

  const heading = document.getElementById('calendar-month-heading');
  if (heading) heading.textContent = state.calendarMonthLabel;

  const countBadge = document.getElementById('calendar-count-badge');
  if (countBadge) countBadge.textContent = 'Loading…';

  updateCalendarNavState();
  setCalendarViewState('loading');

  try {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month)
    });

    const response = await fetch(`/api/calendar?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });

    if (requestId !== state.calendarRequestId) return;

    if (response.status === 401) {
      state.isAuthenticated = false;
      state.student = null;
      state.calendarRequestId++;
      resetCalendarUi();
      resetOrganizedViewUi();
      renderAuthState();
      return;
    }

    let data = {};
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('The server returned an unexpected response.');
    }

    if (!response.ok) {
      const friendlyMessage = response.status >= 500
        ? 'The server could not load the calendar. Please try again.'
        : (data.message || 'Unable to load the calendar.');
      throw new Error(friendlyMessage);
    }

    const monthData = validateCalendarResponse(data, year, month);

    state.calendarYear = year;
    state.calendarMonth = month;
    state.calendarMonthLabel = monthData.monthLabel;
    state.calendarDaysInMonth = monthData.daysInMonth;
    state.calendarFirstWeekday = monthData.firstWeekday;
    state.calendarEvents = monthData.events;

    resetCalendarDetails();
    renderCalendarMonth();
    setCalendarViewState(monthData.events.length === 0 ? 'empty' : 'ready');

    if (countBadge) {
      const count = monthData.events.length;
      countBadge.textContent = `${count} Event${count === 1 ? '' : 's'} This Month`;
    }

    updateCalendarNavState();
  } catch (error) {
    if (requestId !== state.calendarRequestId) return;

    state.calendarEvents = [];
    state.calendarDaysInMonth = 0;
    state.calendarFirstWeekday = 0;
    state.calendarSelectedDate = null;

    const body = document.getElementById('calendar-body');
    if (body) body.replaceChildren();

    resetCalendarDetails();

    const message = error && error.message && !/failed to fetch|networkerror|load failed/i.test(error.message)
      ? error.message
      : 'Unable to load the calendar. Please check your connection and try again.';

    setCalendarViewState('error', message);
    if (countBadge) countBadge.textContent = 'Unavailable';
  }
}

/**
 * Validates the calendar API response before anything is rendered.
 * Throws on structural problems; malformed individual events are skipped.
 */
function validateCalendarResponse(data, expectedYear, expectedMonth) {
  if (!data || typeof data !== 'object') {
    throw new Error('The server returned an unexpected calendar response.');
  }

  if (data.year !== expectedYear || data.month !== expectedMonth) {
    throw new Error('The server returned calendar data for a different month.');
  }

  const monthLabel = typeof data.monthLabel === 'string' ? data.monthLabel.trim() : '';
  if (!monthLabel) {
    throw new Error('The server returned an unexpected month label.');
  }

  const daysInMonth = data.daysInMonth;
  if (!Number.isInteger(daysInMonth) || daysInMonth < 28 || daysInMonth > 31) {
    throw new Error('The server returned an invalid number of days for this month.');
  }

  const firstWeekday = data.firstWeekday;
  if (!Number.isInteger(firstWeekday) || firstWeekday < 0 || firstWeekday > 6) {
    throw new Error('The server returned an invalid weekday alignment.');
  }

  if (!Array.isArray(data.events)) {
    throw new Error('The server returned an unexpected event list.');
  }

  const events = [];
  const seenIds = new Set();

  for (const rawEvent of data.events) {
    const event = normalizeCalendarEvent(rawEvent, expectedYear, expectedMonth);
    if (!event) continue;
    if (seenIds.has(event.id)) continue;
    seenIds.add(event.id);
    events.push(event);
  }

  return { monthLabel, daysInMonth, firstWeekday, events };
}

function normalizeCalendarEvent(rawEvent, expectedYear, expectedMonth) {
  if (!rawEvent || typeof rawEvent !== 'object') return null;

  const id = (typeof rawEvent.id === 'string' || typeof rawEvent.id === 'number')
    ? String(rawEvent.id).trim()
    : '';
  if (!id) return null;

  const title = typeof rawEvent.title === 'string' ? rawEvent.title.trim() : '';
  if (!title) return null;

  const date = typeof rawEvent.date === 'string' ? rawEvent.date.trim() : '';
  if (!isValidCalendarDateKey(date)) return null;

  const parts = parseCalendarDateKey(date);
  if (!parts || parts.year !== expectedYear || parts.month !== expectedMonth) return null;

  const category = typeof rawEvent.category === 'string' && rawEvent.category.trim()
    ? rawEvent.category.trim()
    : 'Not specified';

  const time = typeof rawEvent.time === 'string' && rawEvent.time.trim()
    ? rawEvent.time.trim()
    : null;

  const venue = typeof rawEvent.venue === 'string' && rawEvent.venue.trim()
    ? rawEvent.venue.trim()
    : null;

  return { id, title, date, time, venue, category };
}

/**
 * Renders the month grid using the API-provided metadata, so weekday
 * alignment never depends on the browser timezone.
 */
function renderCalendarMonth() {
  const body = document.getElementById('calendar-body');
  if (!body) return;

  body.replaceChildren();

  const { calendarYear, calendarMonth, calendarDaysInMonth, calendarFirstWeekday } = state;
  if (!calendarDaysInMonth) return;

  const today = getLocalDateParts(new Date());
  const eventsByDate = groupCalendarEventsByDate(state.calendarEvents);
  const totalCells = calendarFirstWeekday + calendarDaysInMonth;
  const rowCount = Math.ceil(totalCells / 7);
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < rowCount; row++) {
    const tr = document.createElement('tr');

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const dayNumber = cellIndex - calendarFirstWeekday + 1;
      const td = document.createElement('td');

      if (dayNumber < 1 || dayNumber > calendarDaysInMonth) {
        td.className = 'calendar-day-empty';
        td.setAttribute('aria-hidden', 'true');
        tr.appendChild(td);
        continue;
      }

      const dateKey = buildCalendarDateKey(calendarYear, calendarMonth, dayNumber);
      const dayEvents = eventsByDate.get(dateKey) || [];

      td.appendChild(buildCalendarDayButton(dateKey, dayNumber, dayEvents, today.key));
      tr.appendChild(td);
    }

    fragment.appendChild(tr);
  }

  body.appendChild(fragment);
}

function buildCalendarDayButton(dateKey, dayNumber, dayEvents, todayKey) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendar-day';
  button.dataset.date = dateKey;
  button.setAttribute('aria-pressed', 'false');

  if (dayEvents.length > 0) button.classList.add('has-events');
  if (dateKey === todayKey) button.classList.add('is-today');
  if (dateKey === state.calendarSelectedDate) {
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
  }

  const eventSummary = dayEvents.length === 0
    ? 'no verified events'
    : `${dayEvents.length} verified event${dayEvents.length === 1 ? '' : 's'}`;
  button.setAttribute('aria-label', `${dayNumber} ${state.calendarMonthLabel}, ${eventSummary}`);
  if (dateKey === todayKey) {
    button.setAttribute('aria-current', 'date');
  }

  const number = document.createElement('span');
  number.className = 'calendar-day-number';
  number.textContent = String(dayNumber);
  button.appendChild(number);

  if (dayEvents.length > 0) {
    const eventContainer = document.createElement('div');
    eventContainer.className = 'calendar-day-events';

    dayEvents.slice(0, CALENDAR_MAX_VISIBLE_CHIPS).forEach((event) => {
      const chip = document.createElement('span');
      chip.className = 'calendar-event-chip';
      chip.textContent = event.title;
      chip.title = event.title;
      eventContainer.appendChild(chip);
    });

    if (dayEvents.length > CALENDAR_MAX_VISIBLE_CHIPS) {
      const more = document.createElement('span');
      more.className = 'calendar-more';
      more.textContent = `+${dayEvents.length - CALENDAR_MAX_VISIBLE_CHIPS} more`;
      eventContainer.appendChild(more);
    }

    const mobileCount = document.createElement('span');
    mobileCount.className = 'calendar-mobile-count';

    const dot = document.createElement('span');
    dot.className = 'calendar-mobile-dot';
    dot.setAttribute('aria-hidden', 'true');

    const countText = document.createElement('span');
    countText.textContent = String(dayEvents.length);

    mobileCount.appendChild(dot);
    mobileCount.appendChild(countText);
    eventContainer.appendChild(mobileCount);

    button.appendChild(eventContainer);
  }

  button.addEventListener('click', () => selectCalendarDate(dateKey));
  return button;
}

function selectCalendarDate(dateKey) {
  if (!isValidCalendarDateKey(dateKey)) return;

  state.calendarSelectedDate = dateKey;

  const buttons = document.querySelectorAll('#calendar-body .calendar-day');
  buttons.forEach((button) => {
    const isSelected = button.dataset.date === dateKey;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });

  renderCalendarDetails(dateKey);
}

function renderCalendarDetails(dateKey) {
  const heading = document.getElementById('calendar-details-heading');
  const countBadge = document.getElementById('calendar-details-count');
  const hint = document.getElementById('calendar-details-hint');
  const container = document.getElementById('calendar-event-details');

  if (!container) return;

  container.replaceChildren();

  const events = state.calendarEvents.filter((event) => event.date === dateKey);

  if (heading) {
    heading.textContent = formatCalendarDateLong(dateKey);
  }

  if (countBadge) {
    countBadge.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
    countBadge.style.display = 'inline-flex';
  }

  if (hint) hint.style.display = 'none';

  if (events.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'calendar-details-empty';
    empty.textContent = 'No verified events are scheduled for this date.';
    container.appendChild(empty);
    return;
  }

  const cards = events.map((event) => buildCalendarEventCard(event));
  container.replaceChildren(...cards);
}

function buildCalendarEventCard(event) {
  const card = document.createElement('article');
  card.className = 'calendar-detail-card';

  const title = document.createElement('h4');
  title.className = 'calendar-detail-title';
  title.textContent = event.title || 'Not specified';
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'calendar-detail-meta';

  const fields = [
    { label: 'Date', value: formatCalendarDateLong(event.date) },
    { label: 'Time', value: event.time },
    { label: 'Venue', value: event.venue }
  ];

  fields.forEach(({ label, value }) => {
    const field = document.createElement('span');
    field.className = 'calendar-detail-field';

    const labelEl = document.createElement('span');
    labelEl.className = 'calendar-detail-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'calendar-detail-value';

    const cleanValue = value && String(value).trim() ? String(value).trim() : 'Not specified';
    valueEl.textContent = cleanValue;
    if (cleanValue === 'Not specified') valueEl.classList.add('empty-field');

    field.appendChild(labelEl);
    field.appendChild(valueEl);
    meta.appendChild(field);
  });

  card.appendChild(meta);

  const category = document.createElement('span');
  category.className = 'calendar-detail-category';
  category.textContent = event.category || 'Not specified';
  card.appendChild(category);

  return card;
}

function resetCalendarDetails() {
  const heading = document.getElementById('calendar-details-heading');
  const countBadge = document.getElementById('calendar-details-count');
  const hint = document.getElementById('calendar-details-hint');
  const container = document.getElementById('calendar-event-details');

  if (heading) heading.textContent = 'Select a date';
  if (countBadge) {
    countBadge.textContent = '0 events';
    countBadge.style.display = 'none';
  }
  if (hint) {
    hint.style.display = 'block';
    hint.textContent = 'Select a date in the calendar to view its verified event details.';
  }
  if (container) container.replaceChildren();
}

function setCalendarViewState(mode, errorMessage) {
  const loading = document.getElementById('calendar-loading');
  const errorState = document.getElementById('calendar-error');
  const errorMessageEl = document.getElementById('calendar-error-message');
  const emptyNote = document.getElementById('calendar-empty-note');
  const wrapper = document.getElementById('calendar-table-wrapper');
  const details = document.getElementById('calendar-details');
  const section = document.getElementById('calendar-section');

  if (loading) loading.style.display = mode === 'loading' ? 'flex' : 'none';
  if (errorState) errorState.style.display = mode === 'error' ? 'flex' : 'none';
  if (emptyNote) emptyNote.style.display = mode === 'empty' ? 'flex' : 'none';

  if (mode === 'error' && errorMessageEl) {
    errorMessageEl.textContent = errorMessage || 'Please check your connection and try again.';
  }

  if (wrapper) {
    wrapper.style.display = (mode === 'loading' || mode === 'error') ? 'none' : 'block';
  }

  if (details) {
    details.style.display = (mode === 'ready' || mode === 'empty') ? 'block' : 'none';
  }

  if (section) {
    section.setAttribute('aria-busy', mode === 'loading' ? 'true' : 'false');
  }
}

function resetCalendarUi() {
  state.calendarYear = null;
  state.calendarMonth = null;
  state.calendarMonthLabel = '';
  state.calendarDaysInMonth = 0;
  state.calendarFirstWeekday = 0;
  state.calendarEvents = [];
  state.calendarSelectedDate = null;

  const body = document.getElementById('calendar-body');
  const heading = document.getElementById('calendar-month-heading');
  const countBadge = document.getElementById('calendar-count-badge');
  const loading = document.getElementById('calendar-loading');
  const errorState = document.getElementById('calendar-error');
  const emptyNote = document.getElementById('calendar-empty-note');
  const wrapper = document.getElementById('calendar-table-wrapper');
  const details = document.getElementById('calendar-details');

  if (body) body.replaceChildren();
  if (heading) heading.textContent = '—';
  if (countBadge) countBadge.textContent = '0 Events This Month';
  if (loading) loading.style.display = 'none';
  if (errorState) errorState.style.display = 'none';
  if (emptyNote) emptyNote.style.display = 'none';
  if (wrapper) wrapper.style.display = 'none';
  if (details) details.style.display = 'none';

  resetCalendarDetails();
  updateCalendarNavState();
}

function updateCalendarNavState() {
  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');

  const year = state.calendarYear;
  const month = state.calendarMonth;

  const atMin = year === CALENDAR_MIN_YEAR && month === 1;
  const atMax = year === CALENDAR_MAX_YEAR && month === 12;

  if (prevBtn) prevBtn.disabled = atMin;
  if (nextBtn) nextBtn.disabled = atMax;
}

function groupCalendarEventsByDate(events) {
  const map = new Map();
  events.forEach((event) => {
    if (!map.has(event.date)) map.set(event.date, []);
    map.get(event.date).push(event);
  });
  return map;
}

function padCalendarNumber(value) {
  return String(value).padStart(2, '0');
}

function buildCalendarDateKey(year, month, day) {
  return `${year}-${padCalendarNumber(month)}-${padCalendarNumber(day)}`;
}

function parseCalendarDateKey(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function isValidCalendarDateKey(value) {
  const parts = parseCalendarDateKey(value);
  if (!parts) return false;

  const { year, month, day } = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getLocalDateParts(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return { year, month, day, key: buildCalendarDateKey(year, month, day) };
}

/**
 * Formats "YYYY-MM-DD" as a readable date without parsing it as UTC midnight,
 * which would shift the day in negative-offset timezones.
 */
function formatCalendarDateLong(dateKey) {
  const parts = parseCalendarDateKey(dateKey);
  if (!parts || !isValidCalendarDateKey(dateKey)) return 'Not specified';

  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

function formatMonthLabel(year, month) {
  const safeMonth = Math.min(Math.max(Number(month) || 1, 1), 12);
  return `${CALENDAR_MONTH_NAMES[safeMonth - 1]} ${year}`;
}

/**
 * Queries the GET /api/health endpoint and updates the status indicators
 */
async function checkHealthStatus() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  try {
    const response = await fetch('/api/health', {
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      if (statusDot) statusDot.className = 'status-indicator online';
      if (statusText) statusText.textContent = 'Server Operational';
    } else {
      throw new Error();
    }
  } catch (error) {
    if (statusDot) statusDot.className = 'status-indicator offline';
    if (statusText) statusText.textContent = 'Connection Offline';
  }
}
