const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function mustContain(file, snippets) {
  const text = read(file);
  for (const snippet of snippets) if (!text.includes(snippet)) throw new Error(`${file} missing: ${snippet}`);
}
function mustNotContain(file, snippets) {
  const text = read(file);
  for (const snippet of snippets) if (text.includes(snippet)) throw new Error(`${file} contains forbidden production secret pattern: ${snippet}`);
}

mustContain('js/runtime-config.js', [
  'KBOA_RUNTIME_CONFIG',
  'paystackPublicKey',
  'pk_live_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY'
]);
mustContain('js/payments/paystack.js', [
  'PAYSTACK_ENVIRONMENT',
  'pk_test_',
  'pk_live_',
  'server'
]);
mustContain('functions/index.js', [
  'process.env.PAYSTACK_SECRET_KEY',
  'exports.paystackWebhook',
  'exports.verifyPayment',
  'exports.refundPayment'
]);
mustContain('tests/run-emulator-smoke.sh', ['firebase-tools@13.35.1', 'emulators:exec']);
mustContain('.env.example', ['PAYSTACK_SECRET_KEY=sk_test_REPLACE_WITH_PAYSTACK_SECRET']);

mustNotContain('js/payments/paystack.js', ['sk_live_', 'sk_test_']);
mustNotContain('js/runtime-config.js', ['sk_live_', 'sk_test_']);
mustNotContain('functions/index.js', ['sk_live_', 'sk_test_']);

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts['test:phase8']) throw new Error('Missing test:phase8 script');
if (!pkg.scripts['test:e2e:contract']) throw new Error('Missing test:e2e:contract script');
const firebase = JSON.parse(read('firebase.json'));
if (firebase.functions?.runtime !== 'nodejs20') throw new Error('Functions runtime must be Node 20');
console.log('Phase 8 deployment/payment security static checks: PASS');
