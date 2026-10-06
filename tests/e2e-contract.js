const fs = require('fs');
const path = require('path');
function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }
const fn = read('functions/index.js');
const rules = read('firestore.rules');
const storage = read('storage.rules');
const pay = read('js/payments/paystack.js');
const contracts = [
  ['admission', fn, 'exports.createAdmissionApplication'],
  ['admission-review', fn, 'exports.updateAdmissionApplication'],
  ['payment-webhook', fn, 'exports.paystackWebhook'],
  ['payment-verify', fn, 'exports.verifyPayment'],
  ['enrollment', fn, "db.collection('enrollments')"],
  ['exam-submit', fn, 'exports.submitExamResult'],
  ['certificate-issue', fn, 'exports.issueCertificate'],
  ['certificate-verify', fn, 'exports.verifyCertificate'],
  ['course-assets', fn, 'exports.getCourseAssetUrl'],
  ['payment-client-server-boundary', pay, 'verifyPaymentOnServer'],
  ['payment-no-client-secret', pay, 'PAYSTACK_PUBLIC_KEY'],
  ['payments-client-write-denied', rules, 'match /payments/{id}'],
  ['certificates-client-write-denied', rules, 'match /certificates/{id}'],
  ['course-assets-client-read-denied', storage, 'allow read: if false;']
];
for (const [name, source, needle] of contracts) {
  if (!source.includes(needle)) throw new Error(`E2E contract missing: ${name}`);
}
if (pay.includes('sk_live_') || pay.includes('sk_test_')) throw new Error('Client bundle contains a Paystack secret-key pattern');
console.log('Phase 8 E2E workflow contracts: PASS');
