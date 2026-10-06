# Phase 2 Verification Checklist

## Static checks completed

- `node --check functions/index.js`
- `node --check js/auth.js`
- `node --check js/data.js`
- `node --check js/certificates/certificate-generator.js`
- `node --check admin/js/admin-data.js`
- `python3 -m json.tool firestore.indexes.json`

## Security scenarios that must be executed in Firebase Emulator

- Student cannot create `/users/{uid}` directly.
- Student cannot modify own role/status/studentId.
- Student cannot create/update/delete payments.
- Student cannot create/update/delete certificates.
- Student cannot create/update/delete exam results.
- Student cannot create/update/delete applications directly.
- Student cannot write audit logs or XP events.
- Student can read only own private data.
- Instructor cannot modify another instructor's course.
- Non-admin cannot call admin functions.
- Admin cannot demote/disable the current admin session through self-targeting operations.
- Duplicate Paystack references do not create duplicate payment records.
- Payment amount is compared against the server-side course price.
- Certificate issuance requires a passed exam result.
- Public certificate verification does not require direct Firestore certificate reads.
