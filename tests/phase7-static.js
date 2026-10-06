const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function mustContain(file, snippets) {
  const text = read(file);
  for (const snippet of snippets) if (!text.includes(snippet)) throw new Error(`${file} missing: ${snippet}`);
}

mustContain('functions/index.js', [
  'exports.getCourseAssetUrl',
  "user.role === 'instructor'",
  'Instructor access to this course is required',
  'exports.paystackWebhook',
  'exports.verifyPayment',
  'exports.submitExamResult',
  'exports.issueCertificate',
  'exports.verifyCertificate'
]);

mustContain('firestore.rules', [
  'allow create: if false;',
  'match /payments/{id}',
  'match /certificates/{id}',
  'match /applications/{id}',
  'match /audit_logs/{id}',
  'match /push_tokens/{id}'
]);

mustContain('storage.rules', [
  'match /course-assets/{courseId}/{assetType}/{fileName=**}',
  'ownsCourse(courseId)',
  'match /course-videos/{videoId}',
  'allow read, write: if false',
  'match /course-materials/{docId}'
]);

const firebase = JSON.parse(read('firebase.json'));
if (firebase.functions?.runtime !== 'nodejs20') throw new Error('Functions runtime must be Node 20');
if (!firebase.firestore?.rules || !firebase.storage?.rules) throw new Error('Firebase rules configuration incomplete');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts['test:phase7']) throw new Error('Missing test:phase7 script');
console.log('Phase 7 production gate static checks: PASS');
