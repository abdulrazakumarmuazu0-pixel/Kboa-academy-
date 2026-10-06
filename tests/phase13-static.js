const fs = require('fs');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(__dirname,'..',file),'utf8'); }
function must(file, snippets){ const t=read(file); for(const s of snippets) if(!t.includes(s)) throw new Error(`${file} missing: ${s}`); }
must('functions/index.js', [
  'audit_integrity',
  'prevHash',
  'crypto.createHash',
  'recordSecurityEvent',
  'RATE_LIMIT_BLOCKED',
  'getSecurityEvents',
  'verifyAuditIntegrity'
]);
must('firestore.rules', [
  'match /audit_integrity/{id}',
  'match /security_events/{id}',
  'allow create, update, delete: if false;'
]);
const firebase=JSON.parse(read('firebase.json'));
const allHeaders=firebase.hosting.headers.flatMap(x=>x.headers||[]);
for(const key of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security','Content-Security-Policy-Report-Only']) {
  if(!allHeaders.some(h=>h.key===key)) throw new Error(`firebase.json missing security header: ${key}`);
}
if(!fs.existsSync(path.join(__dirname,'..','admin','security.html'))) throw new Error('admin/security.html missing');
const pkg=JSON.parse(read('package.json'));
if(!pkg.scripts['test:phase13']) throw new Error('Missing test:phase13');
if(!pkg.scripts['test:production'].includes('test:phase13')) throw new Error('Production suite missing Phase 13');
const env=read('.env.example');
if(!env.includes('KBOA_ALERT_WEBHOOK_URL')) throw new Error('.env.example missing alert webhook');
console.log('Phase 13 advanced security static gate: PASS');
