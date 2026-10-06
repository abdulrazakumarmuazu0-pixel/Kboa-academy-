# KBOA Academy — AI Coding Agent Rules

## Mission

Maintain KBOA Academy as a real production education platform. Never substitute mock UI, fake success messages, static demo data, or client-trusted business logic for real functionality.

## Mandatory rules

1. Inspect existing code before changing it.
2. Preserve working features unless a security or architecture issue requires change.
3. Never trust client-provided roles, prices, scores, payment status, enrollment status, certificate status or privileged fields.
4. Use Cloud Functions for privileged business operations.
5. Keep Firestore and Storage rules least-privilege and deny-by-default.
6. Never put secrets in frontend code or committed files.
7. Every security-sensitive action must be auditable.
8. Run syntax/tests after every major change.
9. Do not claim production readiness without evidence.
10. If a required external configuration is missing, document it instead of faking it.

## Production flow

Inspect → Design → Implement → Test → Security Review → Fix → Retest → Document.

## Critical server-side operations

- authentication/profile provisioning
- RBAC changes
- account status changes
- payment verification/webhooks/refunds
- enrollment entitlements
- exam scoring
- certificates
- admissions decisions
- XP awarding
- audit logs

## Forbidden shortcuts

- `allow read, write: if true`
- authenticated-user blanket access to private data
- client-created payment success records
- client-created certificates
- client-submitted exam scores
- client-controlled admin role
- hardcoded API secrets
- fake API responses
- fake dashboards
- TODO/coming-soon in a feature claimed as production-ready

## Before merging

Run:

- `node --check functions/index.js`
- `npm run check`
- Firebase Emulator security tests when available
- payment integration tests in test mode
- end-to-end student/instructor/admin workflows

Document all remaining external deployment requirements.
