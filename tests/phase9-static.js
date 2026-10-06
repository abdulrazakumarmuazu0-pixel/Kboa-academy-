const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function mustContain(file, snippets) { const t = read(file); for (const s of snippets) if (!t.includes(s)) throw new Error(`${file} missing: ${s}`); }

mustContain('tests/rules-emulator.js', ['initializeTestEnvironment', 'assertSucceeds', 'assertFails', 'payments/p-1', 'private-course']);
mustContain('tests/e2e/browser-smoke.js', ['playwright', 'page.goto', 'pageerror']);
mustContain('tests/run-emulator-rules.sh', ['firebase-tools@13.35.1', 'emulators:exec', 'firestore', 'auth']);
mustContain('tests/run-browser-e2e.sh', ['firebase-tools@13.35.1', 'hosting', 'browser-smoke.js']);
mustContain('DEPLOYMENT_GATE.md', ['Phase 9', 'Rules', 'E2E', 'Paystack']);
const pkg = JSON.parse(read('package.json'));
for (const key of ['test:phase9', 'test:rules', 'test:e2e:browser', 'test:deploy:gate']) if (!pkg.scripts[key]) throw new Error(`Missing ${key}`);
const fPkg = JSON.parse(read('functions/package.json'));
if (fPkg.engines?.node !== '20') throw new Error('Functions must remain Node 20');
console.log('Phase 9 production static gate: PASS');
