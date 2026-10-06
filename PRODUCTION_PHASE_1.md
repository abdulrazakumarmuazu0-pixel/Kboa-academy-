# KBOA Academy — Production Phase 1: Security Hardening

## Completed in this patch
- Hardened Firestore authorization and ownership rules.
- Removed client-side creation of payment, certificate and exam-result records.
- Restricted user profile self-updates to safe fields.
- Restricted enrollment creation to trusted server/admin paths.
- Added deployable Firebase Functions project under `functions/`.
- Added server-side Paystack amount/course validation.
- Added server-side exam scoring and enrollment checks.
- Added server-side certificate issuance and public verification callable.
- Added admin-only user creation/deletion functions.
- Added production `firebase.json` Functions configuration.

## Required before deployment
1. Run `cd functions && npm install`.
2. Configure Paystack secret as a Firebase Functions secret/environment variable.
3. Deploy functions before publishing the new Firestore rules.
4. Update the student exam/certificate UI to call the new callable functions.
5. Test rules with Firebase Emulator Suite.
6. Test Paystack in test mode before switching to live mode.

## Important
This phase is a security foundation. It is not a claim that the entire academy is production-ready yet. Phases for admissions, gamification, AI assistant, observability, automated tests, CI/CD and full mobile release remain.
