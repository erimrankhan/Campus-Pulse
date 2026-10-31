/**
 * Campus Pulse — Module 1 Automated Verification Suite
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MODULE 1 VERIFICATION TEST SUITE');
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

  // 1. Frontend Root Loading
  await test('Frontend loads successfully (GET / returns 200 HTML)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Campus Pulse'), 'HTML must include application name');
    assert.ok(html.includes('Moradabad Institute of Technology'), 'HTML must include institution');
    assert.ok(html.includes('Smart Campus Information Hub'), 'HTML must include purpose heading');
    assert.ok(html.includes('Verified Campus Notices'), 'HTML must include organized verified notice area');
  });

  // 2. No Fake Content Check
  await test('Zero fake data rule verified (No fake notices or fake events in HTML/JS)', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    assert.strictEqual(html.includes('fake-notice'), false);
    assert.strictEqual(html.includes('dummy-event'), false);
    assert.strictEqual(js.includes('sampleNotices'), false);
  });

  // 3. Health Endpoint
  await test('GET /api/health returns 200 OK with proper JSON schema', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('application/json'));
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.message, 'Campus Pulse API is operational');
    assert.ok(typeof data.timestamp === 'string');
    assert.ok(typeof data.uptime === 'number');
    assert.ok(typeof data.environment === 'string');
  });

  // 4. Unknown API Route 404
  await test('Unknown API routes return 404 JSON response', async () => {
    const res = await fetch(`${BASE_URL}/api/unknown-test-endpoint`);
    assert.strictEqual(res.status, 404);
    assert.ok(res.headers.get('content-type').includes('application/json'));
    const data = await res.json();
    assert.strictEqual(data.error, 'Not Found');
    assert.strictEqual(data.status, 404);
    assert.ok(data.message.includes('does not exist'));
  });

  // 5. Static Assets Delivery
  await test('Static CSS and JS files are served correctly', async () => {
    const cssRes = await fetch(`${BASE_URL}/css/style.css`);
    assert.strictEqual(cssRes.status, 200);
    assert.ok(cssRes.headers.get('content-type').includes('text/css'));

    const jsRes = await fetch(`${BASE_URL}/js/app.js`);
    assert.strictEqual(jsRes.status, 200);
    assert.ok(cssRes.headers.get('content-type').includes('text/css'));
  });

  // 6. Security Headers Enforced
  await test('Security headers are present in response', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.ok(res.headers.get('x-content-type-options'), 'X-Content-Type-Options should be set');
    assert.ok(res.headers.get('x-frame-options'), 'X-Frame-Options should be set');
    assert.ok(res.headers.get('content-security-policy'), 'CSP should be set');
  });

  // 7. Responsive CSS Breakpoint Validation
  await test('CSS contains mobile-first base styles and required breakpoints', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert.ok(css.includes('min-width: 768px'), 'Should contain 768px tablet breakpoint');
    assert.ok(css.includes('min-width: 1024px'), 'Should contain 1024px desktop breakpoint');
    assert.ok(css.includes('min-width: 1440px'), 'Should contain 1440px large screen breakpoint');
  });

  // 8. Environment & Git Ignore Verification
  await test('Security files exist (.env.example, .gitignore)', async () => {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('node_modules/'), '.gitignore must ignore node_modules');
    assert.ok(gitignore.includes('.env'), '.gitignore must ignore .env');

    const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
    assert.ok(envExample.includes('PORT='), '.env.example must specify PORT placeholder');
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

