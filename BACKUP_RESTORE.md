# KBOA Backup & Restore Runbook

Backups must be configured and tested in the actual Firebase/GCP project before production launch.

## Minimum production policy
1. Maintain scheduled Firestore exports using the project's approved GCP backup/export mechanism.
2. Keep backup storage separate from the primary application data path.
3. Verify backup freshness at least daily.
4. Perform a documented restore test at least monthly and after major schema/security changes.
5. Record the verification reference in the admin observability workflow.

## Recording a verification
The admin-only `recordBackupVerification` callable records an evidence/reference value and timestamp. It **does not create a backup** and must never be treated as proof that an export completed.

## Restore test
Restore into a non-production project, verify authentication/user references, Firestore indexes/rules, Storage assets, and application workflows, then document the test result.

## Launch requirement
Production launch is blocked until a recent backup verification exists and the real export/restore process has been tested in the target environment.
