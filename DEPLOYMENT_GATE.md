# KBOA Academy — Phase 9 Deployment Gate

Production deployment is blocked unless all applicable gates are green.

## Required gates

1. Node syntax and JSON validation.
2. Phase 3–9 static security gates.
3. Firestore Rules emulator tests (`npm run test:rules`).
4. Storage Rules emulator tests where storage fixtures are available.
5. Public browser smoke/E2E test (`npm run test:e2e:browser`).
6. E2E workflow contract tests for admission → payment → enrollment → exam → certificate.
7. Paystack test-mode transaction in staging; production requires live public key only in browser and secret key only in Functions environment.
8. Firebase deploy dry-run/preview followed by controlled production deployment.
9. Post-deploy `/health` verification and rollback readiness.

## Runtime requirements

- Node.js 20 for Cloud Functions.
- Firebase CLI 13.35.1+.
- Firebase project aliases configured in `.firebaserc`.
- Playwright installed for browser E2E.
- Paystack staging credentials supplied through environment/secrets, never committed.

## Explicit non-gates

Static checks are not a substitute for live Firebase/Paystack verification. A build may not be labelled production-ready until the live staging gates above have been executed successfully.
