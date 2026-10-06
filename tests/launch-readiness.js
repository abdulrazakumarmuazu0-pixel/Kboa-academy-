const fs = require('fs');
const path = require('path');
function read(f){return fs.readFileSync(path.join(__dirname,'..',f),'utf8');}
const target=process.env.KBOA_DEPLOY_TARGET||'local';
const failures=[];
const checks=[
 ['Firebase rules configured', /"firestore"\s*:\s*\{[\s\S]*"rules"\s*:\s*"firestore\.rules"/.test(read('firebase.json'))],
 ['Storage rules configured', /"storage"\s*:\s*\{[\s\S]*"rules"\s*:\s*"storage\.rules"/.test(read('firebase.json'))],
 ['Node 20 functions', JSON.parse(read('functions/package.json')).engines?.node==='20'],
 ['Observability functions present', read('functions/index.js').includes('getObservabilitySnapshot') && read('functions/index.js').includes('scheduledReliabilityCheck')],
 ['Rate-limit collection protected', /match \/rate_limits\/\{id\}[\s\S]*allow read, write: if false/.test(read('firestore.rules'))],
 ['Production CI exists', fs.existsSync(path.join(__dirname,'..','.github/workflows/production-checks.yml'))],
 ['Backup/restore runbook exists', fs.existsSync(path.join(__dirname,'..','BACKUP_RESTORE.md'))],
 ['Security headers configured', /X-Content-Type-Options/.test(read('firebase.json')) && /Strict-Transport-Security/.test(read('firebase.json')) && /Content-Security-Policy-Report-Only/.test(read('firebase.json'))],
 ['Audit integrity configured', read('functions/index.js').includes('verifyAuditIntegrity') && /match \/audit_integrity\/{id}/.test(read('firestore.rules'))],
 ['Security events protected', /match \/security_events\/{id}[\s\S]*allow create, update, delete: if false/.test(read('firestore.rules'))],
 ['Security admin page exists', fs.existsSync(path.join(__dirname,'..','admin','security.html'))],
];
for(const [name,ok] of checks) if(!ok) failures.push(name);
if(target==='production'){
 if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) failures.push('FIREBASE_SERVICE_ACCOUNT_JSON');
 if(!process.env.FIREBASE_PROJECT_ID) failures.push('FIREBASE_PROJECT_ID');
 if(!process.env.PAYSTACK_SECRET_KEY || /^sk_test_/.test(process.env.PAYSTACK_SECRET_KEY)) failures.push('production PAYSTACK_SECRET_KEY');
 if(!process.env.HEALTHCHECK_URL) failures.push('HEALTHCHECK_URL');
 if(!process.env.KBOA_ALERT_WEBHOOK_URL) failures.push('KBOA_ALERT_WEBHOOK_URL');
 if(!process.env.KBOA_BACKUP_LAST_VERIFIED_AT) failures.push('KBOA_BACKUP_LAST_VERIFIED_AT');
 if(!process.env.KBOA_RESTORE_DRILL_LAST_PASSED_AT) failures.push('KBOA_RESTORE_DRILL_LAST_PASSED_AT');
}
if(failures.length){console.error('Launch readiness: FAIL'); failures.forEach(x=>console.error(`- ${x}`)); process.exit(1);}
console.log(`Launch readiness: PASS (${target})`);
