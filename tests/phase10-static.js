const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function mustContain(file, snippets) {
  const t = read(file);
  for (const s of snippets) if (!t.includes(s)) throw new Error(`${file} missing: ${s}`);
}

mustContain('.github/workflows/production-checks.yml', [
  'node-version: 20',
  'test:phase10',
  'test:deploy:gate'
]);
mustContain('.github/workflows/deploy-staging.yml', [
  'workflow_dispatch',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'firebase-tools@13.35.1',
  'firestore:rules',
  'firestore:indexes',
  'storage'
]);
mustContain('.github/workflows/deploy-production.yml', [
  'workflow_dispatch',
  'environment: production',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'firestore:rules',
  'firestore:indexes',
  'storage'
]);
mustContain('tests/deployment-gate.js', [
  'KBOA_DEPLOY_TARGET',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'PAYSTACK_SECRET_KEY',
  'fail-closed'
]);
mustContain('tests/health-check.js', [
  '/health',
  'HEALTHCHECK_URL',
  'timeout'
]);
mustContain('DEPLOYMENT_RUNBOOK.md', [
  'staging',
  'production',
  'rollback',
  'health check'
]);
const pkg = JSON.parse(read('package.json'));
for (const key of ['test:phase10', 'test:deploy:gate', 'test:health']) {
  if (!pkg.scripts[key]) throw new Error(`Missing ${key}`);
}
const fPkg = JSON.parse(read('functions/package.json'));
if (fPkg.engines?.node !== '20') throw new Error('Functions must remain Node 20');
console.log('Phase 10 production static gate: PASS');
