# KBOA Phase 12 — Disaster Recovery

## Recovery objectives

- **RPO target:** define the maximum acceptable data-loss window for the deployed Firebase project.
- **RTO target:** define the maximum acceptable service restoration time before production launch.
- Keep backup evidence and restore-drill evidence outside the primary application database where practical.

## Required recovery drill

At least periodically, an authorized administrator should:
1. Select a known-good backup.
2. Restore it into an isolated recovery environment.
3. Validate users, courses, enrollments, payments, certificates, and security rules.
4. Run application smoke tests.
5. Record the result with `recordRestoreDrill`.

A successful application-level restore record does not itself create the backup. The underlying Firebase backup/export system must be configured separately.

## Incident sequence

1. Declare incident and freeze risky writes if required.
2. Preserve logs/audit evidence.
3. Identify the last known-good backup.
4. Restore into an isolated environment first when possible.
5. Validate integrity and payment/certificate consistency.
6. Promote recovered infrastructure only after checks pass.
7. Record the restore drill and incident outcome.
8. Re-run the launch-readiness gate before reopening production traffic.
