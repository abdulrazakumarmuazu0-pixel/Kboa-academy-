# KBOA Phase 12 — Data Integrity & Idempotency

## Payment idempotency

Paystack `reference` is the payment idempotency key. Both the webhook and callable verification path use the same server-side `commitSuccessfulPayment()` transaction.

The transaction:
1. Checks whether `payments/{reference}` already exists.
2. Creates the payment only when the reference is unused.
3. Checks the student/course enrollment inside the same transaction.
4. Creates the enrollment and updates the student's enrolled-course list atomically when needed.

This prevents concurrent webhook + verification requests from creating duplicate payment records or duplicate enrollments for the same reference.

## Webhook authenticity

Paystack's HMAC SHA-512 signature is verified using the server-only `PAYSTACK_SECRET_KEY`. Signature lengths are validated before `timingSafeEqual` to avoid comparison errors.

## Restore evidence

Administrators can record a restore drill using `recordRestoreDrill`. This is evidence that a backup was not only created but can be restored and validated. The latest restore-drill state is also attached to the backup verification record.

Actual backups and restores remain infrastructure responsibilities; this application records and gates on evidence rather than pretending an unconfigured backup provider is active.
