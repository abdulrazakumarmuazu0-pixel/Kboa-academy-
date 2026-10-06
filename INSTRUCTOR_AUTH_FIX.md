# KBOA Instructor Authentication Fix

## Production contract
- Instructor accounts are created by an authorized admin through `adminCreateUser` or promoted by `setUserRole`.
- The account must have Firebase Auth enabled, a Firestore user profile with `role: instructor`, `status: active`, and matching custom claims.
- Instructor login uses the normal `login.html` and refreshes custom claims before role routing.
- Pending, suspended, rejected, disabled, or missing-profile instructor accounts cannot enter the instructor portal.
- Instructor portal also verifies active status server-side/client gate before loading instructor UI.
- Instructor temporary passwords must be 12+ characters and contain uppercase, lowercase, and a number.

## Troubleshooting
1. Deploy Functions after changing `adminCreateUser`/role claims.
2. Create or approve the instructor from Admin > Teachers.
3. Confirm Firebase Authentication has Email/Password enabled.
4. Ensure the instructor profile has `role: instructor` and `status: active`.
5. Have the instructor sign out and sign in again so the fresh claims are loaded.
