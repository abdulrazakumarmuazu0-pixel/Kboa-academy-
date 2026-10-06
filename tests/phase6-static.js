const fs = require('fs');
const path = require('path');

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
function mustContain(file, snippets) {
  const text = read(file);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${file} missing: ${snippet}`);
  }
}

mustContain('functions/index.js', [
  'exports.reportClientError',
  'exports.getInstructorDashboard',
  'exports.health',
  'requireStaff(context)',
]);
mustContain('js/error-reporter.js', [
  'window.KboaErrorReporter',
  'reportClientError',
  'unhandledrejection',
]);
mustContain('instructor/js/instructor-data.js', [
  'getDashboardSummary',
  "httpsCallable('getInstructorDashboard')",
]);
mustContain('instructor/dashboard.html', [
  'getDashboardSummary(user.uid)',
]);
mustContain('.github/workflows/production-checks.yml', [
  'test:phase6',
  'test:emulator',
]);

const firebase = JSON.parse(read('firebase.json'));
if (!firebase.emulators || !firebase.emulators.functions || !firebase.emulators.auth || !firebase.emulators.firestore) {
  throw new Error('Firebase emulator configuration is incomplete');
}
console.log('Phase 6 static production checks: PASS');
