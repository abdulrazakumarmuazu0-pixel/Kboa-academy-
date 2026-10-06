# KBOA Academy — Production Phase 3

## Delivered
- Student admissions page with authenticated server-side application submission.
- Admin admissions queue with status transitions through trusted Cloud Functions.
- Admin security audit-log viewer using the admin-only `getAuditLogs` callable.
- New secure `course-assets/{courseId}/{assetType}/...` storage namespace.
- `getCourseAssetUrl` callable checks authentication and course enrollment/privilege, then returns a 10-minute signed URL.
- GitHub Actions static production checks on Node 20.
- Phase 3 static test harness and production documentation.

## Storage migration requirement
Existing `course-videos/*` and `course-materials/*` are legacy paths. New uploads must use `course-assets/{courseId}/{assetType}/...`. Before final production launch, migrate legacy media and remove the legacy read rules after client references have been migrated.

## Verification
Run `npm run test:phase3`. Firebase Emulator security tests still require Firebase CLI/Emulator tooling and a configured Firebase project.
