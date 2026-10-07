# KBOA Academy — A4: Project Refactor and Module Breakdown

## 1. Purpose

This document defines the refactor plan for KBOA Academy to move from a feature-rich front-end prototype into a modular, professional, and maintainable software structure.

The purpose of A4 is to organize the platform into clear modules, separate responsibilities, and establish reusable patterns before expanding functionality or tightening security.

## 2. Refactor Goals

- Reduce duplicated logic across pages
- Separate page scripts from shared logic
- Centralize Firebase configuration and service access
- Introduce service-oriented modules for core functions
- Keep page files focused on rendering and interaction only
- Create a clear path for future Cloud Functions and backend logic
- Make tests easier and safer to implement

## 3. Current State Assessment

The repository already contains a strong set of page files and feature modules, including:
- public pages
- student dashboard flows
- instructor dashboard
- admin dashboard
- payment and certificate features
- exams, live classes, language support, and notifications

However, the current structure mixes:
- page-specific logic
- shared business rules
- configuration concerns
- data access logic
- UI rendering logic

This makes the project harder to secure, scale, and validate consistently.

## 4. Refactor Principles

- Page files should primarily handle DOM rendering and event binding
- Shared logic should live in reusable modules under js/services or js/utils
- No privileged action should be trusted from browser code
- Role checks must be performed in server-side logic, not in the page layer
- Use consistent naming and a single source of truth for config
- Keep module responsibilities strictly scoped

## 5. Target Module Structure

The target structure is as follows:

```text
root/
├── index.html
├── courses.html
├── login.html
├── register.html
├── dashboard.html
├── course-details.html
├── course-learning.html
├── exam.html
├── certificates.html
├── payments.html
├── verify-certificate.html
├── manifest.json
├── sw.js
├── capacitor.config.json
├── firebase.json
├── firestore.rules
├── storage.rules
├── package.json
├── README.md
├── ARCHITECTURE_PROFESSIONAL.md
├── IMPLEMENTATION_ROADMAP.md
├── docs/
│   ├── FIREBASE_SETUP.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT_RUNBOOK.md
│   ├── PRODUCTION.md
│   └── api-spec.md
├── js/
│   ├── config/
│   │   ├── firebase-config.js
│   │   └── runtime-config.js
│   ├── services/
│   │   ├── auth-service.js
│   │   ├── course-service.js
│   │   ├── enrollment-service.js
│   │   ├── payment-service.js
│   │   ├── exam-service.js
│   │   ├── certificate-service.js
│   │   ├── notification-service.js
│   │   └── user-service.js
│   ├── utils/
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   ├── storage.js
│   │   ├── error-reporter.js
│   │   └── route-guard.js
│   ├── pages/
│   │   ├── public/
│   │   │   ├── home-page.js
│   │   │   └── course-page.js
│   │   ├── student/
│   │   │   ├── dashboard-page.js
│   │   │   ├── my-courses-page.js
│   │   │   └── exams-page.js
│   │   ├── instructor/
│   │   │   ├── instructor-dashboard.js
│   │   │   ├── course-editor.js
│   │   │   └── grading-page.js
│   │   └── admin/
│   │       ├── admin-dashboard.js
│   │       ├── admin-users.js
│   │       └── admin-payments.js
│   └── app.js
├── admin/
│   ├── dashboard.html
│   ├── students.html
│   ├── courses.html
│   ├── payments.html
│   ├── analytics.html
│   ├── security.html
│   ├── settings.html
│   └── js/
│       ├── admin-data.js
│       ├── admin-analytics.js
│       └── admin-security.js
├── instructor/
│   ├── dashboard.html
│   ├── create-course.html
│   ├── courses.html
│   ├── students.html
│   ├── grades.html
│   ├── assignments.html
│   └── js/
│       ├── instructor-data.js
│       ├── instructor-course.js
│       └── instructor-grading.js
├── functions/
│   ├── index.js
│   ├── package.json
│   └── src/
│       ├── auth/
│       ├── payments/
│       ├── exams/
│       ├── courses/
│       ├── notifications/
│       └── admin/
├── tests/
│   ├── phase3-static.js
│   ├── phase4-static.js
│   ├── health-check.js
│   ├── e2e/
│   │   └── browser-smoke.js
│   └── smoke/
│       └── auth-flow.js
└── scripts/
    ├── bootstrap-admin.js
    └── seed-data.js
```

## 6. Module Responsibilities

### 6.1 js/config/
Purpose:
- Store environment-aware configuration
- Centralize Firebase setup
- Keep secrets and configuration outside committed public code

Examples:
- firebase-config.js
- runtime-config.js

### 6.2 js/services/
Purpose:
- Wrap data access and backend operations
- Expose reusable service functions
- Keep logic independent from DOM manipulation

Examples:
- auth-service.js: create user, login, logout, profile fetch
- course-service.js: list courses, fetch details, save course
- enrollment-service.js: enroll, check access, update progress
- payment-service.js: initiate payment, verify payment status
- exam-service.js: submit exam, fetch questions, compute results
- certificate-service.js: issue certificate, verify certificate
- notification-service.js: send notification payloads or fetch messages
- user-service.js: profile updates, role checks, user metadata

### 6.3 js/utils/
Purpose:
- Shared helper functions
- Validation and formatting
- Error handling and route guards

Examples:
- validators.js: validate email, phone, password, course ID, payment fields
- formatters.js: currency, date, progress, score formatting
- storage.js: local storage helpers and session management
- error-reporter.js: centralized error capture
- route-guard.js: enforce auth logic before rendering advanced screens

### 6.4 js/pages/
Purpose:
- Page-specific interaction and initialization logic
- Event handling for individual screens
- Bind UI actions to the service layer

Examples:
- student/dashboard-page.js
- instructor/instructor-dashboard.js
- admin/admin-users.js

These files should not contain all business rules directly; they should delegate to services.

## 7. Refactor Plan by Area

### 7.1 Authentication Refactor
Current issue:
- auth logic is likely spread across page scripts and config

Refactor target:
- create auth-service.js
- centralize login, register, logout, and role checks
- create route guards for protected pages
- ensure server-side validation remains the final authority

### 7.2 Course and Enrollment Refactor
Current issue:
- multiple pages may duplicate course loading logic

Refactor target:
- create course-service.js and enrollment-service.js
- unify course list, detail fetch, and enrollment state handling
- keep all access rules in backend logic

### 7.3 Payment and Exam Refactor
Current issue:
- payment and scoring logic can become security-sensitive if implemented on the client alone

Refactor target:
- create payment-service.js and exam-service.js
- offload verification and score calculation to Cloud Functions
- keep the browser layer focused on payment initiation and feedback display

### 7.4 Certificate and Notification Refactor
Current issue:
- certificate issuance and notifications are often tightly coupled with UI

Refactor target:
- create certificate-service.js and notification-service.js
- allow one backend event to trigger multiple outputs safely
- ensure audit logging is included in all generated actions

## 8. Implementation Sequence

### Step 1 — Create shared config layer
- Move Firebase config into js/config/firebase-config.js
- Ensure environment-specific values are loaded from secure config sources
- Avoid hardcoded secrets in repo files

### Step 2 — Create utility layer
- Add validators.js
- Add formatters.js
- Add storage.js
- Add error-reporter.js
- Add route-guard.js

### Step 3 — Build service layer
- Implement auth-service.js
- Implement course-service.js
- Implement enrollment-service.js
- Implement payment-service.js
- Implement exam-service.js
- Implement certificate-service.js
- Implement notification-service.js

### Step 4 — Refactor page scripts
- Keep page scripts slim
- Replace repeated logic with service calls
- Move event binding into page-specific files
- Ensure page script names match their screens

### Step 5 — Introduce server-side boundary checks
- Identify all privileged operations
- Move them into Cloud Functions or trusted backend services
- Add access control logic for instructors/admins

### Step 6 — Add tests around modules
- Unit tests for utilities and services
- Smoke tests for auth flows
- Browser smoke checks for key user journeys

## 9. File Migration Strategy

Refactor in waves rather than all at once.

### Wave 1: low-risk utilities and config
- validators.js
- formatters.js
- storage.js
- firebase-config.js

### Wave 2: authentication and user profile
- auth-service.js
- user-service.js
- route-guard.js

### Wave 3: course and enrollment data
- course-service.js
- enrollment-service.js

### Wave 4: payment and assessment flows
- payment-service.js
- exam-service.js

### Wave 5: certificate and notification flows
- certificate-service.js
- notification-service.js

### Wave 6: page-level cleanup
- remove duplicate logic from pages
- connect each page to shared services

## 10. Validation Rules During Refactor

At every stage:
- run syntax checks
- test the affected flow manually or with smoke scripts
- confirm no route or script breakage
- verify no unauthorized access path has been introduced
- confirm that privileged operations remain server-side only

## 11. Acceptance Criteria for A4

A4 is complete when:
- page scripts are slim and focused
- shared logic has been extracted into services and utilities
- config is centralized and safe
- duplicated logic is reduced significantly
- module boundaries are clear and consistent
- the project is ready for more secure backend integration

## 12. Risks to Avoid

- moving business logic to the browser without server-side validation
- creating service modules that still depend heavily on DOM state
- over-centralizing everything and losing page clarity
- making the refactor too broad without a tested milestone

## 13. Recommended Next Implementation Step

The next practical phase should be:
- create js/config/
- create js/utils/
- create js/services/auth-service.js
- create js/services/course-service.js
- create js/services/enrollment-service.js
- refactor one representative page to use these modules

This creates a “proof of pattern” before continuing the broader project refactor.

## 14. Conclusion

A4 is the structural foundation that makes the project professional. Without a clear module breakdown, the platform remains difficult to secure, extend, and validate.

The successful refactor will establish a clean separation between:
- page behavior
- shared business logic
- configuration
- data access
- server-authoritative security operations

This refactor is necessary before the project can reliably move into production-grade backend, authorization, and deployment work.

---

This document defines the refactor structure for KBOA Academy and is intended to guide the implementation of the next engineering stages.
