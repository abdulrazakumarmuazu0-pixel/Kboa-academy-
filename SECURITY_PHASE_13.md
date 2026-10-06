# KBOA Academy — Production Phase 13

## Advanced Application Security

Phase 13 adds defense-in-depth controls without weakening Firebase authorization:

- Security response headers in Firebase Hosting configuration.
- CSP is initially deployed as `Content-Security-Policy-Report-Only` because the existing app uses Firebase compat scripts and some inline code. This allows violations to be observed before enforcing a strict policy.
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
- Strict referrer policy and restrictive Permissions Policy.
- HSTS for HTTPS deployments.
- Tamper-evident audit chain using sequence numbers, previous hashes, and SHA-256 hashes.
- Admin-only audit-chain verification callable.
- Security event stream for rate-limit blocks and security checks.
- Admin security page for recent security events and audit-integrity verification.

## Important production notes

1. HSTS must only be used when the production domain is permanently HTTPS.
2. CSP remains report-only until all violation sources have been reviewed in a real browser deployment. Do not blindly switch to enforcement.
3. Audit-chain verification validates records created with the Phase 13 chain. Legacy audit records created before the chain are not retroactively hashed.
4. Security events are server-written only. They must not contain passwords, payment secrets, access tokens, or unnecessary personal data.
5. Firebase Auth, Firestore Rules, Storage Rules, and callable authorization remain the primary access-control boundaries.
