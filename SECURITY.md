# KBOA Academy Security Model

## Principles

- Client input is untrusted.
- Privileged fields are server-controlled.
- Payments, enrollment entitlements, exam scores and certificates are server-controlled.
- Firestore rules deny direct writes for privileged collections.
- Sensitive actions create immutable audit records.
- Payment references are idempotency keys for new payment records.

## Privileged operations

The following operations must use Cloud Functions:

- createStudentProfile
- setUserRole
- setUserStatus
- verifyPayment
- paystackWebhook
- setPaymentStatus
- refundPayment
- submitExamResult
- issueCertificate
- adminIssueCertificate
- setCertificateStatus
- createAdmissionApplication
- updateAdmissionApplication
- awardXp

## Roles

- `student`
- `instructor`
- `admin`

Roles are stored in the user profile and mirrored to Firebase Auth custom claims by trusted server operations.

## Never expose

- Paystack secret key
- AI provider API keys
- service-account private keys
- database credentials
- privileged server credentials

## Required verification before launch

- Firebase Emulator security tests
- Paystack webhook signature test
- duplicate payment test
- role escalation test
- cross-user data access test
- certificate forgery test
- exam score manipulation test
- Storage access test
