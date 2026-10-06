'use strict';
// Deployment policy: fail-closed.

const target = process.env.KBOA_DEPLOY_TARGET || 'local';
const requiredByTarget = {
  local: [],
  staging: ['FIREBASE_SERVICE_ACCOUNT_JSON', 'PAYSTACK_SECRET_KEY'],
  production: ['FIREBASE_SERVICE_ACCOUNT_JSON', 'FIREBASE_PROJECT_ID', 'PAYSTACK_SECRET_KEY', 'HEALTHCHECK_URL', 'KBOA_ALERT_WEBHOOK_URL', 'KBOA_BACKUP_LAST_VERIFIED_AT']
};

if (!requiredByTarget[target]) throw new Error(`Unknown KBOA_DEPLOY_TARGET: ${target}`);
const missing = requiredByTarget[target].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Deployment gate failed closed for ${target}. Missing: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  let parsed;
  try { parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON'); }
  for (const key of ['project_id', 'client_email', 'private_key']) {
    if (!parsed[key]) throw new Error(`Firebase service account missing ${key}`);
  }
}
if (process.env.PAYSTACK_SECRET_KEY && !/^sk_(test|live)_/.test(process.env.PAYSTACK_SECRET_KEY)) {
  throw new Error('PAYSTACK_SECRET_KEY must start with sk_test_ or sk_live_');
}
if (target === 'production' && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) {
  throw new Error('Production deployment requires a live Paystack secret');
}
if (target === 'production') {
  const verifiedAt = Date.parse(process.env.KBOA_BACKUP_LAST_VERIFIED_AT);
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > 26 * 60 * 60 * 1000) {
    throw new Error('Production deployment requires backup verification within the last 26 hours');
  }
}
console.log(`Deployment gate: PASS (${target})`);
