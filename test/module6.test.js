/**
 * Campus Pulse — Module 6: Organized View Test Suite
 *
 * Runs against a live local server (same convention as Modules 1–5):
 *   1. npm start
 *   2. npm test
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const CATEGORIES = [
  'Academic',
  'Technical',
  'Cultural',
  'Sports',
  'Workshop',
  'Seminar',
  'Examination',
  'Placement',
  'General'
];

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 6 ORGANIZED VIEW TEST SUITE');
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
    const { response, data } = await jsonRequest(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ noticeId, ...fields })
    });
    return { response, data };
  }

  async function getVerified(cookie, { search = null, category = null, rawQuery = null } = {}) {
    let url = `${BASE_URL}/api/notices/verified`;
    if (rawQuery) {
      url += `?${rawQuery}`;
    } else {
      const params = new URLSearchParams();
      if (search !== null) params.set('search', search);
      if (category !== null) params.set('category', category);
      const query = params.toString();
      if (query) url += `?${query}`;
    }
    return jsonRequest(url, {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie
      }
    });
  }

  // -------------------------------------------------------------------------
  // Unit check: an empty notice store returns an empty result set (no error)
  // -------------------------------------------------------------------------
  await test('Empty data store returns an empty verified list (200-equivalent result)', async () => {
    const { getVerifiedNotices } = require('../src/services/notice-store');
    const result = getVerifiedNotices({ search: '', category: '' });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.notices, []);
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------
  await test('Unauthenticated request to verified notices is rejected (401)', async () => {
    const { response, data } = await jsonRequest(`${BASE_URL}/api/notices/verified`);
    assert.strictEqual(response.status, 401);
    assert.strictEqual(data.error, 'Unauthorized');
  });

  await test('Request with an invalid/forged session token is rejected (401)', async () => {
    const { response } = await jsonRequest(`${BASE_URL}/api/notices/verified`, {
      headers: { 'Cookie': 'campus_pulse_session=forged-token-value' }
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
  // Seed real records through the existing Module 3 + Module 5 APIs
  // -------------------------------------------------------------------------
  const token = `m6${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const created = [];

  for (const category of CATEGORIES) {
    const title = `${category} Verified Notice ${token}`;
    const venue = `${category} Block Venue ${token}`;
    const notice = await createNotice(
      sessionCookie,
      `Official ${category} campus notice ${token}. Original text marker: original-text-marker-${token}.`,
      'Email'
    );
    const { response } = await verifyNotice(sessionCookie, notice.id, {
      title,
      date: '2026-12-15',
      time: '10:00 AM',
      venue,
      category
    });
    assert.strictEqual(response.status, 200, `Verification for ${category} must succeed`);
    created.push({ id: notice.id, title, venue, category });
  }

  // A deliberately unverified submission that must never surface.
  const unverifiedNotice = await createNotice(
    sessionCookie,
    `Draft unverified extraction result ${token}. This must never appear in the organized view.`,
    'WhatsApp'
  );

  // Verified record with unsafe HTML content, used for safe-rendering checks.
  const xssTitle = `<img src=x onerror=alert(1)>XSS Title ${token}`;
  const xssVenue = `<script>alert("xss")</script> Venue ${token}`;
  const xssNotice = await createNotice(sessionCookie, `XSS verification payload ${token}`, 'Poster');
  const xssVerify = await verifyNotice(sessionCookie, xssNotice.id, {
    title: xssTitle,
    date: '2026-12-20',
    time: '02:00 PM',
    venue: xssVenue,
    category: 'General'
  });
  assert.strictEqual(xssVerify.response.status, 200);

  // -------------------------------------------------------------------------
  // Core retrieval
  // -------------------------------------------------------------------------
  await test('Authenticated student can retrieve verified notices (200 + structured JSON)', async () => {
    const { response, data } = await getVerified(sessionCookie);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.notices));
    assert.strictEqual(data.count, data.notices.length);
    assert.deepStrictEqual(data.supportedCategories, CATEGORIES);
    assert.strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  await test('Only verified notices are returned; unverified submissions are excluded', async () => {
    const { response, data } = await getVerified(sessionCookie, { search: token });
    assert.strictEqual(response.status, 200);
    assert.ok(data.notices.some(n => n.id === created[0].id), 'Verified records must be present');
    assert.strictEqual(
      data.notices.some(n => n.id === unverifiedNotice.id),
      false,
      'Unverified record must never be returned'
    );
  });

  await test('Every returned notice exposes title, date, time, venue, category and verification timestamp', async () => {
    const { response, data } = await getVerified(sessionCookie, { search: token });
    assert.strictEqual(response.status, 200);
    assert.ok(data.notices.length > 0);

    for (const notice of data.notices) {
      for (const field of ['id', 'title', 'date', 'time', 'venue', 'category', 'verifiedAt']) {
        assert.ok(Object.prototype.hasOwnProperty.call(notice, field), `Missing field: ${field}`);
      }
      assert.ok(CATEGORIES.includes(notice.category), 'Category must be supported');
    }
  });

  await test('Verified response does not expose student PII or internal verification metadata', async () => {
    const { data } = await getVerified(sessionCookie, { search: token });
    const serialized = JSON.stringify(data.notices);
    assert.strictEqual(serialized.includes('submittedBy'), false);
    assert.strictEqual(serialized.includes('verifiedBy'), false);
    assert.strictEqual(serialized.includes('rohit.cse22@mitmoradabad.edu.in'), false);
    assert.strictEqual(serialized.includes('2200820100045'), false);
    assert.strictEqual(serialized.includes('rawText'), false);
    assert.strictEqual(serialized.includes('aiExtraction'), false);
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  await test('Search by notice title returns the matching verified notice', async () => {
    const target = created.find(n => n.category === 'Technical');
    const { response, data } = await getVerified(sessionCookie, { search: target.title });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data.notices.map(n => n.id), [target.id]);
  });

  await test('Search by venue returns the matching verified notice', async () => {
    const target = created.find(n => n.category === 'Sports');
    const { response, data } = await getVerified(sessionCookie, { search: target.venue });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(data.notices.map(n => n.id), [target.id]);
  });

  await test('Search by original notice text returns matching verified notices', async () => {
    const { response, data } = await getVerified(sessionCookie, {
      search: `original-text-marker-${token}`
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.notices.length, CATEGORIES.length);
  });

  await test('Search is case-insensitive (mixed/upper case)', async () => {
    const target = created.find(n => n.category === 'Seminar');
    const { response, data } = await getVerified(sessionCookie, {
      search: target.title.toUpperCase()
    });
    assert.strictEqual(response.status, 200);
    assert.ok(data.notices.some(n => n.id === target.id));
  });

  await test('Search trims leading and trailing spaces', async () => {
    const target = created.find(n => n.category === 'Placement');
    const { response, data } = await getVerified(sessionCookie, {
      search: `     ${target.title}     `
    });
    assert.strictEqual(response.status, 200);
    assert.ok(data.notices.some(n => n.id === target.id));
  });

  await test('Search with no matches returns an empty list (200, not an error)', async () => {
    const { response, data } = await getVerified(sessionCookie, {
      search: `no-such-notice-${token}-xyz`
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.count, 0);
    assert.deepStrictEqual(data.notices, []);
  });

  // -------------------------------------------------------------------------
  // Category filters
  // -------------------------------------------------------------------------
  for (const category of CATEGORIES) {
    await test(`Category filter: ${category} returns only ${category} verified notices`, async () => {
      const { response, data } = await getVerified(sessionCookie, { category });
      assert.strictEqual(response.status, 200);
      assert.ok(data.notices.length > 0, 'Category must include seeded verified records');
      assert.ok(data.notices.every(n => n.category === category));
      assert.ok(data.notices.some(n => n.category === category && n.title.includes(token)));
      assert.strictEqual(data.filters.category, category);
    });
  }

  await test('Category filter is case-insensitive and normalized', async () => {
    const { response, data } = await getVerified(sessionCookie, { category: 'wOrKsHoP' });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.filters.category, 'Workshop');
    assert.ok(data.notices.every(n => n.category === 'Workshop'));
  });

  await test('Search and category filter work together', async () => {
    const { response, data } = await getVerified(sessionCookie, {
      search: token,
      category: 'Workshop'
    });
    assert.strictEqual(response.status, 200);
    assert.ok(data.notices.length >= 1);
    assert.ok(data.notices.every(n => n.category === 'Workshop'));
    assert.ok(data.notices.every(n => n.title.includes(token)));
  });

  await test('Combined search + category with no matches returns empty list', async () => {
    const { response, data } = await getVerified(sessionCookie, {
      search: `no-such-notice-${token}`,
      category: 'Academic'
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.count, 0);
    assert.deepStrictEqual(data.notices, []);
  });

  // -------------------------------------------------------------------------
  // Parameter validation
  // -------------------------------------------------------------------------
  await test('Unsupported category is rejected with 400 (no new categories allowed)', async () => {
    const { response, data } = await getVerified(sessionCookie, { category: 'Hacking' });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(data.error, 'Bad Request');
    assert.ok(data.message.includes('Category must be one of'));
  });

  await test('Oversized search term is rejected with 400', async () => {
    const { response, data } = await getVerified(sessionCookie, { search: 'a'.repeat(121) });
    assert.strictEqual(response.status, 400);
    assert.strictEqual(data.error, 'Bad Request');
    assert.ok(data.message.includes('maximum allowed length'));
  });

  await test('Repeated search parameter is rejected with 400', async () => {
    const { response } = await getVerified(sessionCookie, {
      rawQuery: 'search=first&search=second'
    });
    assert.strictEqual(response.status, 400);
  });

  await test('Repeated category parameter is rejected with 400', async () => {
    const { response } = await getVerified(sessionCookie, {
      rawQuery: 'category=Academic&category=Sports'
    });
    assert.strictEqual(response.status, 400);
  });

  // -------------------------------------------------------------------------
  // Safe rendering / XSS
  // -------------------------------------------------------------------------
  await test('Stored notice HTML is returned as plain data and rendered with textContent only', async () => {
    const { response, data } = await getVerified(sessionCookie, { search: token });
    assert.strictEqual(response.status, 200);

    const stored = data.notices.find(n => n.id === xssNotice.id);
    assert.ok(stored, 'XSS test record must be returned');
    assert.strictEqual(stored.title, xssTitle, 'Backend must not execute content; it stores literal text');

    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.ok(js.includes('title.textContent'), 'Notice title must be rendered with textContent');
    assert.ok(js.includes('valueEl.textContent'), 'Notice field values must be rendered with textContent');
    assert.strictEqual(/innerHTML\s*=\s*notice/.test(js), false, 'Never assign notices to innerHTML');
    assert.strictEqual(/insertAdjacentHTML\([^)]*notice/.test(js), false, 'Never inject notice HTML');
  });

  // -------------------------------------------------------------------------
  // Empty database and error-shape handling
  // -------------------------------------------------------------------------
  await test('Empty result payload has a stable structure (success, count, filters, notices)', async () => {
    const { response, data } = await getVerified(sessionCookie, { search: `void-${token}` });
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(Object.keys(data).sort(), [
      'count',
      'filters',
      'notices',
      'success',
      'supportedCategories'
    ]);
    assert.strictEqual(data.filters.search, `void-${token}`);
    assert.strictEqual(data.filters.category, 'All');
  });

  await test('Search input is treated as literal text (no query/regex injection)', async () => {
    const payloads = ["' OR 1=1 --", '.*', '$where: "1"', '<script>alert(1)</script>'];

    for (const payload of payloads) {
      const { response, data } = await getVerified(sessionCookie, { search: payload });
      assert.strictEqual(response.status, 200, `Payload must not break the endpoint: ${payload}`);
      assert.strictEqual(data.count, 0, `Payload must not widen the result set: ${payload}`);
    }
  });

  // -------------------------------------------------------------------------
  // Module 5 interaction + regressions
  // -------------------------------------------------------------------------
  await test('Module 5: duplicate verification is rejected (409) and notice stays verified once', async () => {
    const target = created[0];
    const { response, data } = await verifyNotice(sessionCookie, target.id, {
      title: target.title,
      date: '2026-12-15',
      time: '10:00 AM',
      venue: target.venue,
      category: target.category
    });
    assert.strictEqual(response.status, 409);
    assert.strictEqual(data.error, 'DUPLICATE');
  });

  await test('Modules 1–5 regression: health, auth, input, verification and organized list still work', async () => {
    const health = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(health.status, 200);

    const me = await fetch(`${BASE_URL}/api/auth/me`, { headers: { 'Cookie': sessionCookie } });
    assert.strictEqual(me.status, 200);
    const meData = await me.json();
    assert.strictEqual(meData.authenticated, true);

    const regressionNotice = await createNotice(sessionCookie, `Regression notice ${token}`, 'General');
    const verify = await verifyNotice(sessionCookie, regressionNotice.id, {
      title: `Regression Verified ${token}`,
      date: '2026-12-22',
      time: '11:00 AM',
      venue: 'Regression Hall',
      category: 'General'
    });
    assert.strictEqual(verify.response.status, 200);

    const { data } = await getVerified(sessionCookie, { search: `Regression Verified ${token}` });
    assert.ok(data.notices.some(n => n.id === regressionNotice.id));
  });

  await test('Module 4: extraction endpoint validation still rejects empty input (400)', async () => {
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

  // -------------------------------------------------------------------------
  // Frontend structure / responsiveness
  // -------------------------------------------------------------------------
  await test('Frontend includes search, category filter, clear, loading, error and empty states', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    assert.ok(html.includes('id="notice-search"'));
    assert.ok(html.includes('id="category-filter"'));
    assert.ok(html.includes('id="btn-clear-filters"'));
    assert.ok(html.includes('id="organized-loading"'));
    assert.ok(html.includes('id="organized-error"'));
    assert.ok(html.includes('id="organized-empty"'));
    assert.ok(html.includes('id="organized-notices-list"'));

    for (const category of CATEGORIES) {
      assert.ok(html.includes(`<option value="${category}">${category}</option>`), `Missing category option: ${category}`);
    }
  });

  await test('Responsive rules support 320px, 375px, 768px, 1024px and 1440px', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('.organized-view-section'));
    assert.ok(css.includes('.search-filter-bar'));
    assert.ok(css.includes('.organized-notices-list'));
    assert.ok(css.includes('min-width: 768px'));
    assert.ok(css.includes('min-width: 1024px'));
    assert.ok(css.includes('min-width: 1440px'));
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
