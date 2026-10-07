# KBOA Academy — Professional Software Architecture

## 1. Purpose

This document defines the professional software architecture for KBOA Academy, a digital learning platform that supports students, instructors, and administrators in a secure, scalable, and maintainable way.

The objective is to transition the project from a static demo-style website into a production-ready platform that follows software engineering best practices, clear role separation, secure data handling, and reliable deployment workflows.

## 2. Architectural Goals

- Build a secure education platform for online learning.
- Separate responsibilities between frontend, logic, data, and infrastructure.
- Enforce role-based access control (RBAC).
- Keep business logic off the client and server-side by default.
- Support future scaling without rewriting the entire platform.
- Make the system easy to test, maintain, and deploy.
- Support mobile/web experiences through a shared backend model.

## 3. Core Principles

- Single responsibility: every module does one job well.
- Least privilege: users and services only receive the minimum access required.
- Secure by default: security is not added later; it is designed in.
- Trust no client: all privileged actions are validated on the server.
- Modular architecture: clear boundaries between UI, app logic, data access, and backend services.
- Observable system: errors, requests, and actions must be traceable.
- Testable architecture: every major module should be verifiable.

## 4. High-Level System View

The system is composed of the following layers:

- Presentation Layer
  - Web app pages for public, student, instructor, and admin flows
- Application Layer
  - JavaScript logic for validation, UI interaction, and orchestration
- Service Layer
  - Firebase Functions, payment verification, certificate generation, notification handling
- Data Layer
  - Firebase Authentication, Firestore, Cloud Storage
- Integration Layer
  - Paystack, Flutterwave, Firebase Messaging, Android bridge
- Security & Governance Layer
  - RBAC, Firestore rules, audit logs, deployment gates
- Observability & Monitoring Layer
  - health checks, smoke tests, error reporting, analytics

## 5. Users and Roles

### 5.1 Student
Responsibilities:
- Register and log in
- Browse and enroll in courses
- Track progress
- Complete assignments and assessments
- Receive certificates
- View payments and profile information

Access rules:
- Can read own profile and own enrollment records
- Can update own account data
- Cannot manipulate payment status or certificate issuance
- Cannot assign roles or edit course structures

### 5.2 Instructor
Responsibilities:
- Create and update courses
- Manage lessons and modules
- Grade assignments and assessments
- Track student progress
- Publish content and course metadata

Access rules:
- Can manage only their own courses and their course records
- Can read student activity related to their courses
- Cannot elevate admin privileges
- Cannot modify payment records or security rules

### 5.3 Admin
Responsibilities:
- Manage users and roles
- Review payments and enrollment data
- Approve or manage advanced operations
- View system analytics and logs
- Trigger operational actions and notifications

Access rules:
- Can read elevated operational data when authorized
- Can manage platform-level settings and observability
- Cannot bypass security constraints
- Must be verified through trusted server-side checks

## 6. Functional Architecture

### 6.1 Public Frontend
Public-facing pages include:
- Home page
- Courses listing
- About page
- Instructor highlights
- Pricing
- Contact form
- Certificate verification page

Purpose:
- Attract learners
- Explain the platform
- Provide transparent access to content and verification

### 6.2 Student Portal
Student pages include:
- Login and registration
- Dashboard
- My courses
- Assignments
- Quizzes and exams
- Certificates
- Payments
- Profile and settings

Purpose:
- Manage learning lifecycle
- Present personalized progress and completion status
- Offer secure access to student-only records

### 6.3 Instructor Portal
Instructor pages include:
- Instructor dashboard
- Course creation and editing
- Student overview for class assignments
- Grade management
- Analytics for enrolled learners

Purpose:
- Manage educational content and assessment delivery
- Track learner progress and grading outcomes

### 6.4 Admin Portal
Admin pages include:
- Dashboard overview
- Users and roles
- Courses management
- Payments and revenue
- Analytics and reports
- Security and audit

Purpose:
- Platform governance and monitoring
- Operational oversight of platform health and activity

## 7. Technical Architecture

### 7.1 Frontend Layer
Technology:
- HTML5
- CSS3
- JavaScript
- Firebase client SDK
- Optional PWA and Capacitor integration for mobile experience

Responsibilities:
- Render views and user interactions
- Capture user data
- Call protected server-side operations
- Display feedback but never decide trust-sensitive outcomes

### 7.2 Application Layer
Representative modules:
- auth.js
- courses.js
- dashboard.js
- course-learning.js
- exam-system.js
- certificate-generator.js
- notifications.js
- language.js
- error-reporter.js

Responsibilities:
- Validate client-side input for usability
- Format requests and payloads
- Handle UI flow and state transitions
- Send operations to secure backend endpoints

Important rule:
- UI code can suggest actions and display states, but it cannot be trusted for authorization or final business validation.

### 7.3 Server & Business Layer
Hosted in Firebase Cloud Functions and trusted backend services.

Core service domains:
- Authentication and profile provisioning
- Enrollment validation and entitlement updates
- Payment verification and webhook processing
- Exam grading and result persistence
- Certificate generation
- Notification dispatch
- Role updates and audit logging

These are the trusted execution environments for all privileged workflows.

### 7.4 Data Layer
Primary storage systems:
- Firebase Authentication
- Firestore Database
- Firebase Storage
- Optional Firebase emulator for local validation

Core collections:
- users
- courses
- enrollments
- assignments
- exams
- exam_results
- certificates
- payments
- notifications
- audit_logs

Data access rules:
- Students can read only their own records or permitted course metadata
- Instructors can access data for their own courses only
- Admins can access only required admin-scoped datasets
- Any sensitive mutation must be enforced server-side

## 8. Security Architecture

### 8.1 Identity and Access
- Use Firebase Authentication as the identity provider.
- Bind user roles and metadata to their authenticated UID.
- Treat role claims as untrusted until validated server-side.

### 8.2 Authorization Model
- Use explicit role mapping: student, instructor, admin
- Enforce authorization in callable Cloud Functions and Firestore rules
- Deny-by-default access patterns
- Validate ownership before mutating protected resources

### 8.3 Payment Security
- Payment success is never trusted from the client browser
- Use gateway verification and server-side receipt checks
- Store payment status only after backend validation
- Prevent duplicate or replayed payment actions

### 8.4 Exam and Certificate Security
- Exams and scoring must be validated server-side
- Certificate issuance must be triggered by backend logic
- Prevent tampering, manual score injection, or fake completion records

### 8.5 Audit and Observability
- Log critical actions such as:
  - login
  - role changes
  - payment verification
  - enrollment actions
  - exam submissions
  - certificate generation
  - admin interventions
- Keep audit records for traceability and incident response

## 9. Workflow Architecture

### 9.1 Student Enrollment Flow
1. Student authenticates
2. Student views course details
3. Student clicks enroll
4. Client sends enrollment request
5. Server validates user identity and course availability
6. Server creates enrollment record and updates entitlement state
7. Student can access course content and related assets

### 9.2 Payment Flow
1. UI requests payment initiation
2. Payment provider opens checkout flow
3. Payment provider returns payment evidence
4. Server verifies status with provider and business rules
5. Server creates payment record and updates enrollment state
6. UI shows a trusted success status only after verification

### 9.3 Exam Flow
1. Student attempts exam
2. UI collects responses locally
3. Client submits attempts to server
4. Server validates the user, course, and time window
5. Server computes score and evaluation
6. Server persists result and triggers certificate eligibility if applicable
7. UI shows result from server-authenticated data

### 9.4 Certificate Flow
1. Server detects course completion requirement is met
2. Certificate service generates unique certificate metadata
3. Record is persisted securely
4. User can view/download certificate
5. Verification page checks against trusted data source

## 10. Functional Boundaries

### Frontend should handle:
- navigation
- form input
- UI state management
- user-friendly validation
- display of trusted server data

### Backend should handle:
- authentication and authorization
- payment verification
- enrollment logic
- assessment scoring
- certificate issuance
- audit records
- write access rules and policy enforcement

## 11. Non-Functional Requirements

### Performance
- API and page rendering should stay responsive
- Large datasets should be paginated or filtered
- Images and assets should be optimized

### Reliability
- Failures must be handled gracefully
- Critical paths should have fallback behavior
- Backend services should be idempotent where possible

### Scalability
- Architecture should support more users, courses, and records without major redesign
- Firestore collections and functions should be structured for growth

### Maintainability
- Code should be modular and consistent
- Shared logic should be centralized
- Documentation must remain current

### Security
- Deny-by-default rules
- Role enforcement
- No secrets in frontend code
- Verified server-side action handling

## 12. Deployment and Delivery Model

Recommended delivery flow:
- feature branch per work item
- local validation and unit/static checks
- targeted tests for changed modules
- security review for sensitive code paths
- staging validation
- production deployment gate
- post-deploy health verification

Suggested pipeline stages:
- lint/static checks
- frontend logic tests
- backend validation via Cloud Functions checks
- emulator security tests
- browser smoke tests
- deployment gate approval
- production health verification

## 13. Recommended Repository Structure

- root/
  - index.html
  - login.html
  - register.html
  - dashboard.html
  - course-learning.html
  - exam.html
  - payments.html
  - certificates.html
  - verify-certificate.html
  - firebase.json
  - firestore.rules
  - storage.rules
  - package.json

- js/
  - config/
  - services/
  - utils/
  - pages/

- admin/
- instructor/
- functions/
- tests/
- docs/
- scripts/

This structure keeps the platform modular, easier to reason about, and safer for future feature work.

## 14. Recommended Next Engineering Actions

1. Standardize the repository structure and naming conventions.
2. Separate UI code, business logic, and service logic.
3. Centralize Firebase configuration and service access.
4. Move privileged actions into Cloud Functions.
5. Strengthen Firestore and Storage security rules.
6. Add automated security and smoke tests.
7. Document API contracts and data models.
8. Add deployment and rollback safeguards.

## 15. Conclusion

KBOA Academy already has the foundation of a serious platform, but to be truly professional, it must be built as a secure, modular, role-aware software system. The project should be treated as a governed platform with explicit boundaries between users, services, backend logic, security rules, and delivery workflows.

This architecture provides the blueprint for moving from a functional prototype toward a scalable and production-ready learning platform.

## 16. Status

Architecture status: Defined and approved for implementation planning.
Next action: convert this architecture into repo-ready implementation tasks and modular refactor plan.

---

This document should be used as the architectural baseline for the ongoing implementation of KBOA Academy.
