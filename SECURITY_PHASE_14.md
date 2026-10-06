# KBOA Academy — Production Phase 14

## Identity, Authentication & Account Security

Phase 14 hardens privileged account operations without weakening Firebase Authentication.

### Controls
- Privileged admin mutations require recent authentication (15-minute step-up window).
- Refresh tokens can be revoked for the current account or by an authorized admin for a target account.
- Security sessions are server-recorded and client writes are blocked by Firestore rules.
- Session/provider changes can generate security events and operational metrics.
- MFA status is exposed through a trusted callable using Firebase Admin Authentication metadata. Actual factor enrollment remains an explicit Firebase Authentication configuration/user flow; the backend never stores MFA secrets.
- New password registration requires 12+ characters with uppercase, lowercase, and a number. Existing accounts are not forcibly reset.
- Password reset remains Firebase-managed; reset tokens are never stored by KBOA.

## Step-up authentication
Sensitive operations such as role/status changes, refunds, user deletion/creation, certificate/payment administration require a recently authenticated admin. If the `auth_time` claim is older than 15 minutes, the callable fails closed with `failed-precondition`.

## Session revocation
`revokeMySessions` and `revokeUserSessions` call Firebase Admin `revokeRefreshTokens`. Clients must authenticate again after revocation.

## MFA
The application is MFA-ready: the trusted security status endpoint reports enrolled Firebase Auth factors when available. Enrollment/challenge flows should use Firebase Authentication's supported MFA APIs; KBOA must not implement or persist OTP secrets itself. Production launch should require MFA for privileged administrators where the Firebase project policy supports it.

## Verification
Run `npm run test:phase14` and the complete `npm run test:production`. Emulator tests remain environment-dependent and must be executed in CI or a Firebase-enabled environment before production launch.

### Security session retention
Session records carry a 90-day `expiresAt` value. Configure a Firestore TTL policy for `security_sessions.expiresAt` in the Firebase/GCP environment; the application does not depend on TTL for authorization.
