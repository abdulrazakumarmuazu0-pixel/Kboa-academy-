# KBOA Academy Production Deployment Runbook — Phase 10

## Environments

- **local:** static checks and emulator tests; no production secrets.
- **staging:** protected GitHub Environment; test Paystack secret and staging Firebase project.
- **production:** protected GitHub Environment; live Paystack secret and production Firebase project.

## Required GitHub Environment secrets

`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`, `PAYSTACK_SECRET_KEY`.
Production also requires `HEALTHCHECK_URL`.

Never commit service-account JSON, Firebase private keys, Paystack secret keys, or user credentials.

## Staging release

1. Run the `KBOA Staging Deployment` workflow manually.
2. Confirm static checks, emulator checks, and deployment gate pass.
3. Verify `/health`, authentication, admissions, payments, enrollment, exams, certificates, and protected assets.
4. Promote only after staging smoke tests pass.

## Production release

1. Ensure the production GitHub Environment requires approval.
2. Run `KBOA Production Deployment` manually.
3. Type `DEPLOY-KBOA-PRODUCTION` in the confirmation input.
4. The deployment gate rejects missing credentials and rejects a test Paystack secret for production.
5. Firebase Hosting, Functions, Firestore rules/indexes, and Storage rules deploy together.
6. The health check must return JSON with `status: ok`.

## Rollback

- Do not roll back by editing live data manually.
- First stop further deployments.
- Identify the failing release in Firebase/GitHub logs.
- Re-deploy the last known-good Git commit through the same protected production workflow.
- Re-run the health check and critical workflow tests.
- For schema/rules changes, verify backward compatibility before rollback.
- For payment incidents, disable new payment initiation if necessary and reconcile Paystack references before retrying.

## Production gate principle

All deployment paths fail closed when required credentials or environment invariants are missing.
