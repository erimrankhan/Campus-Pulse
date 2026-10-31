/**
 * Campus Pulse — Module 2: MIT Student Authentication Test Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 2 AUTHENTICATION TEST SUITE');
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

  // Helper to extract session cookie from headers
  function getCookie(response) {
    const raw = response.headers.get('set-cookie');
    if (!raw) return null;
    return raw.split(';')[0];
  }

  // 1. Module 1 Health Check Still Works
  await test('Requirement 7: Health-check endpoint still works (GET /api/health)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
  });

  // 2. Unauthorized Users Cannot Access Protected Routes
  await test('Requirement 1 & 5: Protected backend APIs reject unauthorized requests (401)', async () => {
    // 2a. GET /api/auth/me without cookie
    const meRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert.strictEqual(meRes.status, 401, 'Must reject unauthenticated request to /api/auth/me');
    const meData = await meRes.json();
    assert.strictEqual(meData.error, 'Unauthorized');

    // 2b. GET /api/protected-access without cookie
    const protRes = await fetch(`${BASE_URL}/api/protected-access`);
    assert.strictEqual(protRes.status, 401, 'Must reject unauthenticated request to /api/protected-access');
    const protData = await protRes.json();
    assert.strictEqual(protData.error, 'Unauthorized');
  });

  // 3. Reject Non-MIT Moradabad Domains
  await test('Requirement 2: Non-MIT email domains are rejected with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@gmail.com',
        password: 'SomePassword123'
      })
    });
    assert.strictEqual(res.status, 403, 'Must reject @gmail.com domain with 403');
    const data = await res.json();
    assert.strictEqual(data.error, 'Forbidden Domain');
    assert.ok(data.message.includes('@mitmoradabad.edu.in'));
  });

  // 4. Reject Invalid Password for Valid Email
  await test('Requirement 2: Invalid credentials for registered student are rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rohit.cse22@mitmoradabad.edu.in',
        password: 'WrongPassword'
      })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // 5. Authorized Student Can Sign In
  let sessionCookie = '';
  let studentData = null;
  await test('Requirement 3: Authorized student can sign in successfully (200 OK + HTTP-only Cookie)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rohit.cse22@mitmoradabad.edu.in',
        password: 'MitStudent@2026'
      })
    });
    assert.strictEqual(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set session cookie');
    assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must specify SameSite=Lax');

    sessionCookie = getCookie(res);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.student.email, 'rohit.cse22@mitmoradabad.edu.in');
    assert.strictEqual(data.student.studentId, '2200820100045');
    assert.strictEqual(data.student.name, 'Rohit Sharma');
    assert.strictEqual(data.student.passwordHash, undefined, 'Must NEVER return passwordHash');
    studentData = data.student;
  });

  // 6. Access Protected Routes with Authenticated Session
  await test('Requirement 5: Protected backend APIs accept authorized request with session cookie', async () => {
    // 6a. Access /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.authenticated, true);
    assert.strictEqual(meData.student.studentId, studentData.studentId);

    // 6b. Access /api/protected-access
    const protRes = await fetch(`${BASE_URL}/api/protected-access`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(protRes.status, 200);
    const protData = await protRes.json();
    assert.strictEqual(protData.success, true);
    assert.strictEqual(protData.student.name, 'Rohit Sharma');
  });

  // 7. Page Refresh Simulation (Check Auth Session)
  await test('Requirement 6: Authentication state is maintained on page refresh (/api/auth/me)', async () => {
    // Simulating page refresh by querying /api/auth/me with existing cookie
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.student.email, 'rohit.cse22@mitmoradabad.edu.in');
  });

  // 8. Sign-Out Ends Session
  await test('Requirement 4: Sign-out ends the authenticated session', async () => {
    // Execute logout
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(logoutRes.status, 200);

    // Try accessing protected route with the old session cookie
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(meRes.status, 401, 'Old session cookie must be rejected after logout');
  });

  // 9. No Credentials or Secrets Exposed in Frontend Code
  await test('Requirement 8: No credentials, tokens or secrets exposed in frontend code', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

    assert.strictEqual(html.includes('MitStudent@2026'), false, 'Password must not appear in HTML');
    assert.strictEqual(js.includes('MitStudent@2026'), false, 'Password must not appear in JS');
    assert.strictEqual(js.includes('passwordHash'), false, 'Password hashes must not appear in JS');
    assert.strictEqual(js.includes('SESSION_SECRET'), false, 'Session secret must not appear in JS');
  });

  // 10. Responsive CSS Breakpoint Rules Validation
  await test('Requirement 10: Responsive layout supports 320px, 375px, 768px, 1024px and 1440px', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('auth-card'), 'auth-card styles must exist');
    assert.ok(css.includes('min-width: 768px'), '768px breakpoint must exist');
    assert.ok(css.includes('min-width: 1024px'), '1024px breakpoint must exist');
    assert.ok(css.includes('min-width: 1440px'), '1440px breakpoint must exist');
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

