# KBOA Academy — Phase 15 Authorization Architecture

## Goal
Phase 15 makes authorization explicit, centralized, resource-aware, and deny-by-default.

## Policy layers
1. **Role permission matrix** — `ROLE_PERMISSIONS` defines the baseline capabilities for admin, instructor, and student.
2. **Custom claims** — `permissions` claims are normalized against the role's allow-list; clients cannot grant themselves permissions.
3. **Callable enforcement** — privileged Functions use `requirePermission` / `requireAdminPermission` rather than trusting UI state.
4. **Resource authorization** — course ownership is checked against the authoritative course document before instructor-scoped operations.
5. **Firestore deny-by-default boundaries** — privileged collections remain server-only and ownership fields are immutable during instructor updates.
6. **Authorization telemetry** — denied permission and resource checks generate security events and metrics.

## Capability matrix
| Role | Core capabilities |
|---|---|
| Admin | user/role management, admissions, payments, certificates, security, observability, reports, backups |
| Instructor | own courses/assets, own assignments/grades/exams, own student/payout views |
| Student | own profile, published courses, own enrollments/progress, own exams/certificates/notifications |

## Resource rules
- An instructor cannot transfer a course to another instructor through an update.
- Instructor-managed grades and assignments cannot be moved to another course during update.
- Instructor live-class ownership is immutable during update.
- Privileged collections such as payments, certificates, audit logs, security events, metrics, backups and authorization policies are not client-writable.

## Authorization introspection
Authenticated users may call `getMyAuthorization` to retrieve their effective role, capability list, status and policy version. This is informational only; it does not grant access.

## Production requirements
- Refresh ID tokens after role/permission changes so new custom claims are active.
- Keep Admin SDK credentials server-side only.
- Deploy Firestore rules together with Functions changes.
- Review `AUTHORIZATION_DENIED` and `RESOURCE_AUTHORIZATION_DENIED` metrics/events during launch monitoring.
- Run emulator authorization tests before production deployment.
