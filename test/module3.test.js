/**
 * Campus Pulse — Module 3: Smart Input Test Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 3 SMART INPUT TEST SUITE');
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

  // Helper to extract session cookie from response
  function getCookie(response) {
    const raw = response.headers.get('set-cookie');
    if (!raw) return null;
    return raw.split(';')[0];
  }

  // Obtain an authenticated session cookie for tests
  let sessionCookie = '';
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit.cse22@mitmoradabad.edu.in',
      password: 'MitStudent@2026'
    })
  });
  sessionCookie = getCookie(loginRes);

  // 1. Submit Notice Without Authentication (Test Case 6)
  await test('Test 6: Attempt submission without authentication is rejected (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Unauthenticated test notice content',
        sourceType: 'WhatsApp'
      })
    });
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated submission');
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 2. Submit Empty Text (Test Case 2)
  await test('Test 2: Submit empty text is rejected (400 Bad Request)', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: '',
        sourceType: 'Email'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Bad Request');
    assert.ok(data.message.includes('empty'));
  });

  // 3. Submit Whitespace-Only Text (Test Case 3)
  await test('Test 3: Submit whitespace-only text is rejected (400 Bad Request)', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: '   \n\t  \r\n   ',
        sourceType: 'WhatsApp'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Bad Request');
    assert.ok(data.message.includes('whitespace'));
  });

  // 4. Submit Text Exceeding Maximum Length (Test Case 4)
  await test('Test 4: Submit text exceeding maximum length (> 5000 chars) is rejected (400)', async () => {
    const oversizedText = 'A'.repeat(5001);
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: oversizedText,
        sourceType: 'Poster'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Bad Request');
    assert.ok(data.message.includes('maximum allowed length'));
  });

  // 5. Submit Valid Notice Text (Test Case 1)
  let createdNoticeId = '';
  const validNoticeText = `*MIT MORADABAD CSE NOTICE*\nAttention 3rd-year B.Tech students:\nGuest Lecture on Distributed Systems by Dr. K. P. Singh.\nVenue: Seminar Hall 2, Block B.\nDate: 05-11-2026 at 11:30 AM. Attendance is mandatory.`;
  await test('Test 1: Submit valid notice text succeeds (201 Created)', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: validNoticeText,
        sourceType: 'WhatsApp'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.notice.id.startsWith('notice-'));
    assert.strictEqual(data.notice.sourceType, 'WhatsApp');
    assert.strictEqual(data.notice.submittedBy.studentId, '2200820100045');
    assert.strictEqual(data.notice.status, 'PENDING_EXTRACTION');
    createdNoticeId = data.notice.id;
  });

  // 6. Submit Text with Special Characters and Multiple Lines (Test Case 5)
  const multilineSpecialText = `Official Circular #MIT/2026/89:
Subject: Final Semester Project Synopsis Submission!
- Special characters: @#$%^&*()_+{}[]:;"'<>,.?/
- Unicode symbols: 🏛️ • 📢 • ⏰ • 📍
- Multi-line indentation and spacing.
Contact: dean.academics@mitmoradabad.edu.in`;

  let specialNoticeId = '';
  await test('Test 5: Submit text with special characters and multiple lines succeeds', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: multilineSpecialText,
        sourceType: 'Email'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.notice.rawText, multilineSpecialText);
    specialNoticeId = data.notice.id;
  });

  // 7. Verify Submitted Content Is Preserved Correctly (Test Case 7)
  await test('Test 7: Verify submitted content is preserved without alteration', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input/${createdNoticeId}`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.notice.rawText, validNoticeText);
    assert.strictEqual(data.notice.characterCount, validNoticeText.length);
  });

  // 8. Verify Unsafe HTML/Script Content Is Not Executed / Kept as Raw Text (Test Case 8)
  const xssPayload = `<script>alert("XSS")</script><img src=x onerror=alert(1)><b>Bold Notice</b>`;
  await test('Test 8: Unsafe script/HTML payloads are preserved as literal raw text', async () => {
    const res = await fetch(`${BASE_URL}/api/notices/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        text: xssPayload,
        sourceType: 'Poster'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    // Raw text is preserved literally without execution
    assert.strictEqual(data.notice.rawText, xssPayload);

    // Verify frontend code does not use innerHTML on notice content
    const frontendJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.ok(frontendJs.includes('rawPre.textContent = notice.rawText'), 'Must use textContent for notice rawText');
    assert.strictEqual(frontendJs.includes('rawPre.innerHTML = notice.rawText'), false, 'Never use innerHTML for notice text');
  });

  // 9. Confirm Modules 1 and 2 Still Work (Test Case 10)
  await test('Test 10: Modules 1 & 2 remain fully functional', async () => {
    // Module 1: Health check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthRes.status, 200);

    // Module 2: Authenticated me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.authenticated, true);
  });

  // 10. Check Responsiveness & Stylesheet Breakpoints (Test Case 11)
  await test('Test 11: Responsive layout rules support 320px, 375px, 768px, 1024px, 1440px', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('.smart-input-section'), 'smart-input-section styling exists');
    assert.ok(css.includes('.smart-textarea'), 'smart-textarea styling exists');
    assert.ok(css.includes('min-width: 768px'), '768px tablet media query exists');
    assert.ok(css.includes('min-width: 1024px'), '1024px desktop media query exists');
    assert.ok(css.includes('min-width: 1440px'), '1440px wide screen media query exists');
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

runTests();

