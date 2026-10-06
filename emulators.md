# Firebase Emulator Security Test Runbook

Install Firebase CLI in CI/development, then run:

```bash
firebase emulators:start --only auth,firestore,storage --project demo-kboa
```

In a second terminal, execute the project's emulator test suite when added. The emulator must validate:
- unauthenticated access to protected collections is denied;
- students cannot write users, payments, certificates, applications, audit logs, XP, notifications, or push tokens;
- instructors can only mutate their own courses and assigned academic resources;
- students can only access their own private records;
- direct reads of `course-assets/*` are denied;
- admins retain required administrative access.
