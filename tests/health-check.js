'use strict';
// Production health endpoint: /health (or a full HEALTHCHECK_URL).

const url = process.env.HEALTHCHECK_URL;
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 10000);
if (!url) {
  console.log('Health check skipped: HEALTHCHECK_URL is not set.');
  process.exit(0);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
fetch(url, { method: 'GET', headers: { accept: 'application/json' }, signal: controller.signal })
  .then(async (res) => {
    const body = await res.text();
    if (!res.ok) throw new Error(`Health endpoint returned HTTP ${res.status}: ${body.slice(0, 300)}`);
    let payload;
    try { payload = JSON.parse(body); } catch { throw new Error('Health endpoint did not return JSON'); }
    if (payload.status !== 'ok') throw new Error(`Health status is not ok: ${payload.status}`);
    console.log('Health check: PASS');
  })
  .catch((err) => {
    console.error(`Health check failed: ${err.name === 'AbortError' ? 'timeout' : err.message}`);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timer));
