# KBOA Academy — Production Phase 2: Backend, RBAC, Admissions & Audit

## Implemented

- Server-side student profile creation and unique Student ID allocation.
- Firebase custom claims for student/instructor/admin roles.
- Server-side role changes with self-demotion protection.
- Server-side account status changes with Firebase Auth disable/enable.
- Server-side admission application creation and admin review workflow.
- Immutable audit log service for security-sensitive actions.
- Server-side XP awarding and XP event ledger.
- Production Paystack webhook with HMAC-SHA512 signature validation.
- Payment idempotency using Paystack reference as the payment document ID for new payments.
- Server-side payment status management.
- Server-side certificate issuance for passed exam results.
- Server-side certificate status/revocation workflow.
- Client-side certificate creation/verification paths removed in favor of trusted functions.
- Admin role/status writes moved from direct Firestore writes to callable functions.
- Firestore rules tightened for payments, certificates, applications, audit logs, XP and notifications.
- Added Firestore indexes required by the new application/exam/certificate queries.
- Registration and Google sign-in now use trusted profile creation instead of client-generated privileged fields.

## Deployment

1. `cd functions && npm install`
2. Configure `PAYSTACK_SECRET_KEY` as a production secret/environment variable.
3. Configure the Paystack webhook URL:
   `https://us-central1-akboa-academy.cloudfunctions.net/paystackWebhook`
4. Deploy functions and rules:
   `firebase deploy --only functions,firestore:rules,firestore:indexes,storage`
5. Run the Firebase Emulator Suite security tests before production.
6. Test Paystack in test mode before enabling live transactions.

## Important

The code is now structurally ready for Phase 3 work, but production deployment still requires the real Firebase/Paystack project configuration and security/emulator verification. This patch does not claim that external provider configuration has been completed automatically.
