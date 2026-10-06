const fs = require('fs');
const assert = require('assert');
const functions = fs.readFileSync('functions/index.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const firebase = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const fpkg = JSON.parse(fs.readFileSync('functions/package.json', 'utf8'));

function has(text, needle, label) { assert(text.includes(needle), `Missing ${label}: ${needle}`); }

has(functions, "const API_VERSION = 'v1'", 'API version');
has(functions, "const API_CONTRACT_VERSION = 'phase-16-v1'", 'API contract version');
has(functions, 'function requestMeta', 'request metadata/correlation helper');
has(functions, 'function apiResponse', 'standard API response envelope');
has(functions, 'function validatePayload', 'central request validation');
has(functions, 'async function withIdempotency', 'idempotency service');
has(functions, "db.collection('idempotency_keys')", 'idempotency persistence');
has(functions, 'X-KBOA-API-Version', 'API version response header');
has(functions, 'X-Request-Id', 'correlation response header');
has(functions, 'exports.apiV1 = functions.https.onRequest', 'versioned HTTP API endpoint');
has(functions, 'requestId: meta.requestId', 'correlation propagation');
has(functions, "withIdempotency(uid, 'admission_submit'", 'admission idempotency');
has(functions, "withIdempotency(uid, 'exam_submit'", 'exam idempotency');
has(functions, "idempotencyKey", 'idempotency request field');

has(rules, 'match /idempotency_keys/{id}', 'idempotency collection boundary');
has(rules, 'match /authorization_policies/{id}', 'authorization policy boundary');
assert(!rules.includes("allow read, write: if signedIn()"), 'Client must not get broad signed-in write access.');
assert(firebase.functions && firebase.functions.runtime === 'nodejs20', 'Functions runtime must remain Node 20.');
assert(pkg.scripts['test:phase16'] === 'node tests/phase16-static.js', 'Phase 16 npm script missing.');
assert(pkg.scripts['test:production'].includes('npm run test:phase16'), 'Production suite does not include Phase 16.');
assert(fpkg.scripts['test:phase16'] === 'node --check index.js', 'Functions Phase 16 check missing.');

console.log('Phase 16 API/service architecture gate: PASS');
