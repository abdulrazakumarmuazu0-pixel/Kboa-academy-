# KBOA Student Registration, Login & Paid Portal Fix

## Problem
Student pages contained hard-coded demo data and the portal did not enforce a paid entitlement.

## Production behavior
- Every registration creates a unique Firebase Authentication UID.
- The server creates `/users/{uid}` with a unique `studentId`.
- Student profile fields are isolated by UID.
- Registration failures attempt to remove the newly-created Auth account to avoid orphan accounts.
- Student login refreshes claims and calls `getStudentPortalAccess`.
- Student Dashboard requires an active student account plus a successful payment/enrollment.
- A verified Paystack payment creates an enrollment for the signed-in UID.
- Enrollment and payment reads are scoped by `studentId == request.auth.uid`.
- Dashboard demo course/activity/deadline records were removed.

## Access flow
`Register -> Firebase UID -> Student Profile -> Login -> Paystack Payment -> Server Verification -> Enrollment -> Student Dashboard`

A newly registered unpaid student is redirected to the course catalog instead of being given access to the paid Student Portal.
