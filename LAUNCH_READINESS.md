# KBOA Launch Readiness Gate

## Required before public production
- Firebase project and billing configured.
- Firebase Auth, Firestore, Storage, Functions and Hosting deployed.
- Production Paystack secret configured; no `sk_test_*` key in production.
- `/health` returns HTTP 200 with `ok: true`.
- CI static/security checks pass.
- Rules emulator and browser E2E tests pass in a real CI environment.
- Scheduled reliability check deployed and observed.
- Alert webhook configured and tested, if alerting is required.
- Backup export and restore test completed.
- Admin observability page verified by an admin account.
- PWA/Android release smoke-tested on supported devices.

## Fail-closed behavior
`npm run test:launch` validates local production contracts. With `KBOA_DEPLOY_TARGET=production`, required production secrets and operational evidence are mandatory.

Passing this script does not itself deploy the application or certify external services.


## Phase 12 data-integrity gate

Production launch additionally requires evidence for a recently verified backup and a successful restore drill. Set `KBOA_BACKUP_LAST_VERIFIED_AT` and `KBOA_RESTORE_DRILL_LAST_PASSED_AT` only from real operational evidence. The gate intentionally fails closed when either value is absent.

Payment processing uses a transactional idempotency boundary keyed by the Paystack transaction reference, so webhook and client verification can safely converge on one payment/enrollment operation.
