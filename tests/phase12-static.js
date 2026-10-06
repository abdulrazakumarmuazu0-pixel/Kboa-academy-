const fs = require('fs');
const path = require('path');
function read(file){ return fs.readFileSync(path.join(__dirname,'..',file),'utf8'); }
function must(file, snippets){ const t=read(file); for(const s of snippets) if(!t.includes(s)) throw new Error(`${file} missing: ${s}`); }
must('functions/index.js', [
  'commitSuccessfulPayment',
  'db.runTransaction(async tx =>',
  'tx.create(paymentRef',
  "source: 'webhook'",
  "source: 'verify'",
  'timingSafeEqual',
  'recordRestoreDrill',
  'restore_drills',
  'PAYSTACK_WEBHOOK_ERROR'
]);
must('firestore.rules', [
  'match /restore_drills/{id}',
  'allow read: if isAdmin();',
  'allow create, update, delete: if false;'
]);
const pkg=JSON.parse(read('package.json'));
if(!pkg.scripts['test:phase12']) throw new Error('Missing test:phase12');
if(!pkg.scripts['test:production'].includes('test:phase12')) throw new Error('Production suite missing Phase 12');
const env=read('.env.example');
for(const key of ['KBOA_BACKUP_LAST_VERIFIED_AT','KBOA_RESTORE_DRILL_LAST_PASSED_AT','KBOA_ALERT_WEBHOOK_URL']) if(!env.includes(key)) throw new Error(`.env.example missing ${key}`);
console.log('Phase 12 production static gate: PASS');
