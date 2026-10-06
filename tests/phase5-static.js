const fs = require('fs');
const path = require('path');

function mustContain(file, snippets) {
  const text = fs.readFileSync(file, 'utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${file} missing: ${snippet}`);
  }
}

mustContain(path.join(__dirname, '..', 'functions', 'index.js'), [
  'exports.getInstructorDashboard',
  'exports.health',
  'function logOperationalError',
  'requireStaff(context)',
]);
mustContain(path.join(__dirname, '..', 'firestore.rules'), [
  'match /audit_logs/{id}',
  'allow create, update, delete: if false',
  'match /push_tokens/{id}',
  'allow read, write: if false'
]);
mustContain(path.join(__dirname, '..', 'storage.rules'), [
  'match /course-assets/{courseId}/{assetType}/{fileName=**}',
  'allow read: if false'
]);

const firebase = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
if (!firebase.functions || firebase.functions.runtime !== 'nodejs20') throw new Error('Firebase Functions runtime is not Node 20');

console.log('Phase 5 static production checks: PASS');
