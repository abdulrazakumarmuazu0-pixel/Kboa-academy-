const fs = require('fs');
const path = require('path');
function read(file){return fs.readFileSync(path.join(__dirname,'..',file),'utf8');}
function mustContain(file, snippets){const t=read(file); for(const s of snippets) if(!t.includes(s)) throw new Error(`${file} missing: ${s}`);}
mustContain('functions/index.js', [
  'onSchedule', 'recordOperationalEvent', 'incrementMetric', 'enforceRateLimit',
  'getObservabilitySnapshot', 'recordBackupVerification', 'scheduledReliabilityCheck',
  'KBOA_ALERT_WEBHOOK_URL', 'alert_dedup', 'resource-exhausted'
]);
mustContain('firestore.rules', ['operational_events','operational_metrics','rate_limits','backup_verifications','alert_dedup']);
mustContain('firestore.indexes.json', ['operational_metrics','operational_events','rate_limits']);
const pkg=JSON.parse(read('package.json')); for(const k of ['test:phase11','test:launch']) if(!pkg.scripts[k]) throw new Error(`Missing ${k}`);
console.log('Phase 11 production static gate: PASS');
