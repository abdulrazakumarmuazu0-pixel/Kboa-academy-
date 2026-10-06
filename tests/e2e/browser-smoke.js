const assert = require('assert');
const { chromium } = require('playwright');

const baseURL = process.env.KBOA_BASE_URL || 'http://127.0.0.1:5000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.goto(`${baseURL}/login.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.goto(`${baseURL}/courses.html`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    assert.strictEqual(new URL(page.url()).origin, new URL(baseURL).origin);
    assert.strictEqual(errors.length, 0, `Browser errors: ${errors.join(' | ')}`);
    console.log('Authenticated-browser smoke harness: PASS (public route baseline)');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
