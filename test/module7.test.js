/**
 * Campus Pulse — Module 7: Calendar Test Suite
 *
 * Runs against a live local server (same convention as Modules 1–6):
 *   1. node src/server.js
 *   2. node test/module7.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 7 CALENDAR TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   ${err.message}`);
    }
  }

  function getCookie(response) {
    const raw = response.headers.get('set-cookie');
    if (!raw) return null;
    return raw.split(';')[0];
  }

  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, options);
    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }
    return { response, data };
  }

  async function createNotice(cookie, text, sourceType = 'General') {
    const { response, data } = await jsonRequest(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ text, sourceType })
    });
    assert.strictEqual(response.status, 201, 'Notice submission must succeed');
    return data.notice;
  }

  async function verifyNotice(cookie, noticeId, fields) {
    return jsonRequest(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ noticeId, ...fields })
    });
  }

  async function createVerified(cookie, fields) {
    const notice = await createNotice(
      cookie,
      `Calendar seed record for ${fields.title}. Marker: ${fields.title}`,
      'Email'
    );
    const { response, data } = await verifyNotice(cookie, notice.id, fields);
    assert.strictEqual(response.status, 200, `Verification must succeed for ${fields.title}`);
    assert.ok(data.notice, 'Verification must return the notice');
    return { id: notice.id, ...fields };
  }

  async function getCalendar(cookie, { year = null, month = null, rawQuery = null } = {}) {
    let url = `${BASE_URL}/api/calendar`;
    if (rawQuery !== null) {
      url += `?${rawQuery}`;
    } else if (year !== null || month !== null) {
      const params = new URLSearchParams();
      if (year !== null) params.set('year', String(year));
      if (month !== null) params.set('month', String(month));
      url += `?${params.toString()}`;
    }
    return jsonRequest(url, {
      headers: {
        'Accept': 'application/json',
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    });
  }

  // -------------------------------------------------------------------------
  // Unit checks: date and calendar helpers (isolated from the live server)
  // -------------------------------------------------------------------------
  const store = require('../src/services/notice-store');

  await test('Date validation accepts real dates, including leap day 2028-02-29', async () => {
    assert.strictEqual(store.isValidCalendarDate('2028-02-29'), true);
    assert.strictEqual(store.isValidCalendarDate('2026-12-31'), true);
    assert.strictEqual(store.isValidCalendarDate('2027-01-01'), true);
  });

  await test('Date validation rejects impossible dates (2026-02-29, 2026-02-30, 2026-13-01)', async () => {
    assert.strictEqual(store.isValidCalendarDate('2026-02-29'), false);
    assert.strictEqual(store.isValidCalendarDate('2026-02-30'), false);
    assert.strictEqual(store.isValidCalendarDate('2026-13-01'), false);
    assert.strictEqual(store.isValidCalendarDate('29-02-2028'), false);
    assert.strictEqual(store.isValidCalendarDate('2028-2-29'), false);
  });

  await test('Month metadata: February 2026 has 28 days and starts on Sunday', async () => {
    const meta = store.getMonthMeta(2026, 2);
    assert.strictEqual(meta.daysInMonth, 28);
    assert.strictEqual(meta.firstWeekday, 0);
  });

  await test('Month metadata: February 2028 has 29 days and starts on Tuesday', async () => {
    const meta = store.getMonthMeta(2028, 2);
    assert.strictEqual(meta.daysInMonth, 29);
    assert.strictEqual(meta.firstWeekday, 2);
  });

  await test('Month metadata: December 2026 has 31 days and starts on Tuesday', async () => {
    const meta = store.getMonthMeta(2026, 12);
    assert.strictEqual(meta.daysInMonth, 31);
    assert.strictEqual(meta.firstWeekday, 2);
  });

  await test('Month metadata: January 2027 has 31 days and starts on Friday', async () => {
    const meta = store.getMonthMeta(2027, 1);
    assert.strictEqual(meta.daysInMonth, 31);
    assert.strictEqual(meta.firstWeekday, 5);
  });

  await test('Empty in-memory store returns no calendar events for any month', async () => {
    assert.deepStrictEqual(store.getVerifiedEventsForMonth(2026, 12), []);
    assert.deepStrictEqual(store.getVerifiedEventsForMonth(2028, 2), []);
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------
  await test('Unauthenticated calendar request is rejected (401)', async () => {
    const { response, data } = await getCalendar(null, { year: 2026, month: 12 });
    assert.strictEqual(response.status, 401);
    assert.strictEqual(data.error, 'Unauthorized');
  });

  await test('Forged session token is rejected (401)', async () => {
    const { response } = await getCalendar('campus_pulse_session=forged-token-value', {
      year: 2026,
      month: 12
    });
    assert.strictEqual(response.status, 401);
  });

  // Authenticate as an official MIT Moradabad student
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit.cse22@mitmoradabad.edu.in',
      password: 'MitStudent@2026'
    })
  });
  const sessionCookie = getCookie(loginRes);
  assert.ok(sessionCookie, 'Login must return a session cookie');

  // -------------------------------------------------------------------------
  // Seed records through the existing Module 3 + Module 5 APIs.
  // No direct store manipulation: every calendar event below is a real
  // student-verified record.
  // -------------------------------------------------------------------------
  const token = `m7${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

  const dec15Tech = await createVerified(sessionCookie, {
    title: `Winter Tech Fest ${token}`,
    date: '2026-12-15',
    time: '10:00 AM',
    venue: 'Main Auditorium',
    category: 'Technical'
  });

  const dec15Robotics = await createVerified(sessionCookie, {
    title: `Robotics Workshop ${token}`,
    date: '2026-12-15',
    category: 'Workshop'
  });

  const dec20Cultural = await createVerified(sessionCookie, {
    title: `Cultural Night ${token}`,
    date: '2026-12-20',
    time: '06:00 PM',
    venue: 'Open Ground',
    category: 'Cultural'
  });

  const dec31Seminar = await createVerified(sessionCookie, {
    title: `Year End Seminar ${token}`,
    date: '2026-12-31',
    time: '11:00 PM',
    venue: 'Seminar Hall',
    category: 'Seminar'
  });

  const jan1Academic = await createVerified(sessionCookie, {
    title: `New Year Orientation ${token}`,
    date: '2027-01-01',
    time: '09:00 AM',
    venue: 'Block A',
    category: 'Academic'
  });

  const leapDayEvent = await createVerified(sessionCookie, {
    title: `Leap Day Workshop ${token}`,
    date: '2028-02-29',
    time: '02:00 PM',
    venue: 'Innovation Lab',
    category: 'Workshop'
  });

  const feb2026Event = await createVerified(sessionCookie, {
    title: `Winter Exam Briefing ${token}`,
    date: '2026-02-28',
    time: '11:00 AM',
    venue: 'Examination Hall',
    category: 'Examination'
  });

  // Verified, but deliberately has no confirmed date. Must not appear.
  const noDateNotice = await createNotice(sessionCookie, `Date pending notice ${token}`, 'General');
  const noDateVerify = await verifyNotice(sessionCookie, noDateNotice.id, {
    title: `Date Pending Notice ${token}`,
    category: 'General'
  });
  assert.strictEqual(noDateVerify.response.status, 200);

  // Submitted but never verified. Must never appear.
  const unverifiedNotice = await createNotice(
    sessionCookie,
    `Unverified calendar draft ${token}. Not confirmed by any student.`,
    'WhatsApp'
  );

  // Verified event with unsafe HTML text, used for safe-rendering checks.
  const xssTitle = `<img src=x onerror=alert(1)>XSS Calendar ${token}`;
  const xssVenue = `<script>alert("calendar-xss")</script> Hall ${token}`;
  const xssNotice = await createNotice(sessionCookie, `XSS calendar payload ${token}`, 'Poster');
  const xssVerify = await verifyNotice(sessionCookie, xssNotice.id, {
    title: xssTitle,
    date: '2026-12-22',
    time: '01:00 PM',
    venue: xssVenue,
    category: 'General'
  });
  assert.strictEqual(xssVerify.response.status, 200);

  // -------------------------------------------------------------------------
  // Core retrieval and event placement
  // -------------------------------------------------------------------------
  await test('Authenticated student receives structured calendar JSON for a month', async () => {
    const { response, data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.year, 2026);
    assert.strictEqual(data.month, 12);
    assert.strictEqual(data.monthLabel, 'December 2026');
    assert.strictEqual(data.daysInMonth, 31);
    assert.strictEqual(data.firstWeekday, 2);
    assert.ok(Array.isArray(data.events));
    assert.strictEqual(data.count, data.events.length);
    assert.deepStrictEqual(Object.keys(data).sort(), [
      'count', 'daysInMonth', 'events', 'firstWeekday',
      'month', 'monthLabel', 'success', 'year'
    ]);
    assert.strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  await test('Verified events appear on their confirmed dates', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const tech = data.events.find(e => e.id === dec15Tech.id);
    const cultural = data.events.find(e => e.id === dec20Cultural.id);

    assert.ok(tech, 'December 15 event must be present');
    assert.strictEqual(tech.date, '2026-12-15');
    assert.strictEqual(tech.title, dec15Tech.title);

    assert.ok(cultural, 'December 20 event must be present');
    assert.strictEqual(cultural.date, '2026-12-20');

    assert.ok(
      data.events.every(e => e.date.startsWith('2026-12-')),
      'No event may appear outside the requested month'
    );
  });

  await test('Unverified submissions are excluded from the calendar', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    assert.strictEqual(
      data.events.some(e => e.id === unverifiedNotice.id),
      false,
      'Unverified notice must never appear'
    );
  });

  await test('Verified records without a confirmed date are excluded from the calendar', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    assert.strictEqual(
      data.events.some(e => e.id === noDateNotice.id),
      false,
      'A verified notice with no date must not appear in any month'
    );

    const allMonths = [[2026, 1], [2026, 2], [2026, 12], [2027, 1]];
    for (const [year, month] of allMonths) {
      const result = await getCalendar(sessionCookie, { year, month });
      assert.strictEqual(
        result.data.events.some(e => e.id === noDateNotice.id),
        false,
        `No-date record must not appear in ${year}-${month}`
      );
    }
  });

  await test('Multiple verified events on the same date are all returned', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const sameDay = data.events.filter(e => e.date === '2026-12-15');
    const ids = sameDay.map(e => e.id);

    assert.ok(ids.includes(dec15Tech.id));
    assert.ok(ids.includes(dec15Robotics.id));
    assert.ok(sameDay.length >= 2);
    assert.strictEqual(new Set(ids).size, ids.length, 'No duplicate event IDs');
  });

  await test('Events are returned in stable chronological order without duplicates', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const dates = data.events.map(e => e.date);
    const sorted = [...dates].sort();
    assert.deepStrictEqual(dates, sorted);

    const ids = data.events.map(e => e.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });

  await test('Missing time and venue are returned as null (never invented)', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const robotics = data.events.find(e => e.id === dec15Robotics.id);

    assert.ok(robotics);
    assert.strictEqual(robotics.time, null);
    assert.strictEqual(robotics.venue, null);
    assert.strictEqual(robotics.title, dec15Robotics.title);
    assert.strictEqual(robotics.category, 'Workshop');
  });

  await test('Event payload exposes only calendar fields (no PII or internals)', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    assert.ok(data.events.length > 0);

    for (const event of data.events) {
      assert.deepStrictEqual(Object.keys(event).sort(), [
        'category', 'date', 'id', 'time', 'title', 'venue'
      ]);
    }

    const serialized = JSON.stringify(data);
    for (const forbidden of [
      'submittedBy', 'verifiedBy', 'rawText', 'aiExtraction', 'extraction',
      'rohit.cse22@mitmoradabad.edu.in', '2200820100045', 'studentId'
    ]) {
      assert.strictEqual(serialized.includes(forbidden), false, `Response leaked ${forbidden}`);
    }
  });

  // -------------------------------------------------------------------------
  // Leap year, non-leap year and weekday alignment
  // -------------------------------------------------------------------------
  await test('February 2028 (leap year) reports 29 days, Tuesday start and the Feb 29 event', async () => {
    const { response, data } = await getCalendar(sessionCookie, { year: 2028, month: 2 });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.daysInMonth, 29);
    assert.strictEqual(data.firstWeekday, 2);

    const leap = data.events.find(e => e.id === leapDayEvent.id);
    assert.ok(leap, 'Leap-day event must appear');
    assert.strictEqual(leap.date, '2028-02-29');
  });

  await test('February 2026 (non-leap year) reports 28 days, Sunday start and its Feb 28 event', async () => {
    const { response, data } = await getCalendar(sessionCookie, { year: 2026, month: 2 });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.daysInMonth, 28);
    assert.strictEqual(data.firstWeekday, 0);

    const event = data.events.find(e => e.id === feb2026Event.id);
    assert.ok(event, 'February 28 event must appear');
    assert.strictEqual(event.date, '2026-02-28');
  });

  await test('Weekday alignment matches known anchors (Dec 2026 Tue, Jan 2027 Fri, Jul 2031 Tue)', async () => {
    const dec = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const jan = await getCalendar(sessionCookie, { year: 2027, month: 1 });
    const jul = await getCalendar(sessionCookie, { year: 2031, month: 7 });

    assert.strictEqual(dec.data.firstWeekday, 2);
    assert.strictEqual(dec.data.daysInMonth, 31);
    assert.strictEqual(jan.data.firstWeekday, 5);
    assert.strictEqual(jan.data.daysInMonth, 31);
    assert.strictEqual(jul.data.firstWeekday, 2);
    assert.strictEqual(jul.data.daysInMonth, 31);
  });

  // -------------------------------------------------------------------------
  // Month boundaries and timezone safety
  // -------------------------------------------------------------------------
  await test('December 31 and January 1 stay in their own months (no timezone shift)', async () => {
    const dec = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const jan = await getCalendar(sessionCookie, { year: 2027, month: 1 });

    assert.ok(dec.data.events.some(e => e.id === dec31Seminar.id && e.date === '2026-12-31'));
    assert.strictEqual(dec.data.events.some(e => e.id === jan1Academic.id), false);

    assert.ok(jan.data.events.some(e => e.id === jan1Academic.id && e.date === '2027-01-01'));
    assert.strictEqual(jan.data.events.some(e => e.id === dec31Seminar.id), false);
  });

  await test('Every returned event date is valid and belongs to the requested month', async () => {
    for (const [year, month] of [[2026, 12], [2027, 1], [2028, 2]]) {
      const { data } = await getCalendar(sessionCookie, { year, month });
      for (const event of data.events) {
        assert.strictEqual(store.isValidCalendarDate(event.date), true);
        const [eventYear, eventMonth] = event.date.split('-').map(Number);
        assert.strictEqual(eventYear, year);
        assert.strictEqual(eventMonth, month);
      }
    }
  });

  await test('Month with no events returns an empty list (200, not an error)', async () => {
    const { response, data } = await getCalendar(sessionCookie, { year: 2031, month: 7 });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.count, 0);
    assert.deepStrictEqual(data.events, []);
    assert.strictEqual(data.daysInMonth, 31);
    assert.strictEqual(data.firstWeekday, 2);
  });

  // -------------------------------------------------------------------------
  // Parameter validation and defaults
  // -------------------------------------------------------------------------
  await test('Omitted year and month default to the server current month', async () => {
    const now = new Date();
    const { response, data } = await getCalendar(sessionCookie);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.year, now.getFullYear());
    assert.strictEqual(data.month, now.getMonth() + 1);
  });

  await test('Only the month supplied defaults the year, and vice versa', async () => {
    const { response: monthOnly } = await getCalendar(sessionCookie, { month: 12 });
    assert.strictEqual(monthOnly.status, 200);

    const { response: yearOnly } = await getCalendar(sessionCookie, { year: 2026 });
    assert.strictEqual(yearOnly.status, 200);
  });

  const invalidParamCases = [
    ['year=abcd&month=12', 'non-numeric year'],
    ['year=20266&month=12', 'five-digit year'],
    ['year=1899&month=12', 'year below range'],
    ['year=2101&month=12', 'year above range'],
    ['year=2026&month=0', 'month below range'],
    ['year=2026&month=13', 'month above range'],
    ['year=2026&month=1.5', 'fractional month'],
    ['year=2026&month=', 'empty month'],
    ['year=&month=12', 'empty year'],
    ['year=2026&month=Dec', 'non-numeric month']
  ];

  for (const [rawQuery, label] of invalidParamCases) {
    await test(`Invalid date parameter (${label}) is rejected with 400`, async () => {
      const { response, data } = await getCalendar(sessionCookie, { rawQuery });
      assert.strictEqual(response.status, 400);
      assert.strictEqual(data.error, 'Bad Request');
      assert.strictEqual(typeof data.message, 'string');
      assert.ok(data.message.length > 0);
    });
  }

  await test('Repeated year parameter is rejected with 400', async () => {
    const { response } = await getCalendar(sessionCookie, {
      rawQuery: 'year=2026&year=2027&month=12'
    });
    assert.strictEqual(response.status, 400);
  });

  await test('Repeated month parameter is rejected with 400', async () => {
    const { response } = await getCalendar(sessionCookie, {
      rawQuery: 'year=2026&month=12&month=1'
    });
    assert.strictEqual(response.status, 400);
  });

  await test('Invalid verification date is rejected and never reaches the calendar', async () => {
    const notice = await createNotice(sessionCookie, `Invalid date attempt ${token}`, 'General');
    const { response } = await verifyNotice(sessionCookie, notice.id, {
      title: `Invalid Date Attempt ${token}`,
      date: '2027-02-29',
      category: 'General'
    });
    assert.strictEqual(response.status, 400);

    const { data } = await getCalendar(sessionCookie, { year: 2027, month: 2 });
    assert.strictEqual(data.events.some(e => e.id === notice.id), false);
  });

  // -------------------------------------------------------------------------
  // Safe rendering
  // -------------------------------------------------------------------------
  await test('User-provided event text is returned literally and rendered with textContent', async () => {
    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const xssEvent = data.events.find(e => e.id === xssNotice.id);

    assert.ok(xssEvent, 'XSS test event must be returned');
    assert.strictEqual(xssEvent.title, xssTitle);
    assert.strictEqual(xssEvent.venue, xssVenue);

    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('chip.textContent = event.title'), 'Chips must use textContent');
    assert.ok(js.includes('title.textContent = event.title'), 'Detail titles must use textContent');
    assert.ok(js.includes('valueEl.textContent'), 'Detail field values must use textContent');
    assert.strictEqual(/innerHTML\s*=/.test(js), false, 'Calendar UI must never assign innerHTML');
    assert.strictEqual(/insertAdjacentHTML/.test(js), false, 'Calendar UI must never inject HTML');
  });

  await test('Frontend validates API month metadata and event dates before rendering', async () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('validateCalendarResponse'));
    assert.ok(js.includes('isValidCalendarDateKey'));
    assert.ok(js.includes('data.year !== expectedYear'));
    assert.ok(js.includes('data.month !== expectedMonth'));
  });

  // -------------------------------------------------------------------------
  // Frontend structure and responsiveness
  // -------------------------------------------------------------------------
  await test('Frontend includes month heading, navigation, calendar grid and details panel', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

    for (const id of [
      'calendar-section',
      'calendar-heading',
      'calendar-count-badge',
      'calendar-prev-month',
      'calendar-next-month',
      'calendar-month-heading',
      'calendar-loading',
      'calendar-error',
      'calendar-empty-note',
      'calendar-grid',
      'calendar-body',
      'calendar-details',
      'calendar-details-heading',
      'calendar-event-details'
    ]) {
      assert.ok(html.includes(`id="${id}"`), `Missing element: ${id}`);
    }

    assert.ok(html.includes('>Sun</th>'));
    assert.ok(html.includes('>Sat</th>'));
    assert.ok(html.includes('btn-retry-calendar'));
  });

  await test('Frontend loads the calendar from the API and supports month navigation', async () => {
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('/api/calendar?'));
    assert.ok(js.includes('function navigateCalendarMonth'));
    assert.ok(js.includes('function loadCalendarMonth'));
    assert.ok(js.includes('calendar-prev-month'));
    assert.ok(js.includes('calendar-next-month'));
    assert.ok(js.includes('selectCalendarDate'));
    assert.ok(js.includes('renderCalendarDetails'));
    assert.ok(js.includes('openCalendar();'));
    assert.ok(js.includes('refreshCalendar()'));
  });

  await test('Responsive calendar CSS covers 320px, 375px, 768px, 1024px and 1440px', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('.calendar-section'));
    assert.ok(css.includes('.calendar-grid'));
    assert.ok(css.includes('.calendar-day'));
    assert.ok(css.includes('.calendar-event-chip'));
    assert.ok(css.includes('.calendar-mobile-count'));
    assert.ok(css.includes('@media (max-width: 599px)'));
    assert.ok(css.includes('min-width: 768px'));
    assert.ok(css.includes('min-width: 1024px'));
    assert.ok(css.includes('min-width: 1440px'));
  });

  // -------------------------------------------------------------------------
  // Regression: Modules 1–6
  // -------------------------------------------------------------------------
  await test('Modules 1–6 regression: health, auth, input, extraction, verification and organized view still work', async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(health.status, 200);

    const me = await fetch(`${BASE_URL}/api/auth/me`, { headers: { 'Cookie': sessionCookie } });
    assert.strictEqual(me.status, 200);
    const meData = await me.json();
    assert.strictEqual(meData.authenticated, true);

    const regressionNotice = await createNotice(sessionCookie, `Regression input ${token}`, 'General');
    assert.ok(regressionNotice.id);

    const verify = await verifyNotice(sessionCookie, regressionNotice.id, {
      title: `Regression Verified ${token}`,
      date: '2026-12-24',
      time: '11:00 AM',
      venue: 'Regression Hall',
      category: 'General'
    });
    assert.strictEqual(verify.response.status, 200);

    const organized = await jsonRequest(`${BASE_URL}/api/notices/verified`, {
      headers: { 'Accept': 'application/json', 'Cookie': sessionCookie }
    });
    assert.strictEqual(organized.response.status, 200);
    assert.ok(organized.data.notices.some(n => n.id === regressionNotice.id));

    const calendar = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    assert.ok(calendar.data.events.some(e => e.id === regressionNotice.id));
  });

  await test('Module 4 extraction validation still rejects blank input (400)', async () => {
    const { response } = await jsonRequest(`${BASE_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ text: '   ' })
    });
    assert.strictEqual(response.status, 400);
  });

  await test('Duplicate verification remains rejected and does not duplicate the calendar event', async () => {
    const duplicate = await verifyNotice(sessionCookie, dec15Tech.id, {
      title: dec15Tech.title,
      date: '2026-12-15',
      time: '10:00 AM',
      venue: 'Main Auditorium',
      category: 'Technical'
    });
    assert.strictEqual(duplicate.response.status, 409);

    const { data } = await getCalendar(sessionCookie, { year: 2026, month: 12 });
    const matches = data.events.filter(e => e.id === dec15Tech.id);
    assert.strictEqual(matches.length, 1);
  });

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed}/${total} passed`);
  console.log('====================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
