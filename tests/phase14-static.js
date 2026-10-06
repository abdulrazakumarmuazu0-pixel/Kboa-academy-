const fs = require('fs');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(__dirname,'..',file),'utf8'); }
function must(file, snippets){ const t=read(file); for(const s of snippets) if(!t.includes(s)) throw new Error(`${file} missing: ${s}`); }
must('functions/index.js', [
  'requireRecentAdmin',
  'PRIVILEGED_ACTION_REAUTH_REQUIRED',
  'registerSecuritySession',
  'getMySecurityStatus',
  'revokeMySessions',
  'revokeUserSessions',
  'SUSPICIOUS_SESSION_CHANGE',
  'multiFactor',
  'revokeRefreshTokens'
]);
must('js/auth.js', [
  'registerSecuritySession',
  'kboa_security_session_id',
  'at least 12 characters'
]);
must('firestore.rules', [
  'match /security_sessions/{id}',
  'allow read, write: if false;'
]);
console.log('Phase 14 static security gate: PASS');

const settings = read('admin/settings.html');
if (/sk_(test|live)_[A-Za-z0-9_-]+/.test(settings)) throw new Error('Admin settings must not contain Paystack secret-key literals.');
console.log('Paystack secret placeholder hygiene: PASS');
