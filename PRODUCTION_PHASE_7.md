# KBOA Academy — Production Phase 7

## Production Gate

Phase 7 hardens the final security boundaries around paid course assets and validates the critical student lifecycle.

### Implemented
- Instructor course ownership is enforced before signed course-asset URLs are issued.
- Instructor uploads under `course-assets/{courseId}/...` require ownership of that course.
- Legacy `course-videos/*` and `course-materials/*` client access is blocked; assets must be migrated to `course-assets/*`.
- Payment, exam, certificate and admission paths are included in the production static gate.
- Phase 7 rules/configuration checks are automated in CI.

## Critical E2E workflows to run in a real Firebase project
1. Student account creation/profile provisioning.
2. Admission submission and admin status change.
3. Published course purchase through Paystack test mode.
4. Enrollment creation and paid asset signed URL authorization.
5. Exam submission, server-side scoring and duplicate submission protection.
6. Certificate issuance and public verification callable.
7. Instructor denied access to another instructor's course assets.
8. Student denied direct payment/certificate writes.
9. Storage rules deny legacy course asset paths.

## Deployment gate
Run `npm run test:production` and `cd functions && npm run check`. Then run Firebase Emulator tests in an environment with Firebase CLI and Java/Firestore emulator dependencies available. Do not mark emulator/E2E tests as passed without actual execution.
