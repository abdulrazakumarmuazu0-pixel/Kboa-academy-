# KBOA - Knowledge Bridge Online Academy

## Overview
KBOA is a comprehensive online learning platform built with HTML/CSS/JS and Firebase. It provides practical skills training with courses in Academic subjects, Digital Skills, Business, and AI & Tech.

## Features

### 🌐 Public Website
- Home page with hero section, stats, categories, featured courses
- Courses page with search and filter functionality
- About, Instructors, Pricing sections
- Contact form
- Certificate verification page

### 👨‍🎓 Student Portal
- Registration & Login (Email/Phone + Google)
- Student Dashboard with:
  - My Courses with progress tracking
  - Assignments
  - Quizzes
  - Results
  - Certificates
  - Payments
  - Profile & Settings

### 👨‍🏫 Instructor Portal
- Create and manage courses
- Upload videos and PDFs
- Create quizzes and assignments
- View and grade students
- Track course analytics

### 👨‍💼 Admin Dashboard
- Manage students and teachers
- Add/remove courses
- View payments and revenue
- Generate reports
- Manage certificates
- Academy statistics

## Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Payment**: Paystack/Flutterwave (Phase 2)
- **Design**: Mobile-first, Responsive

## File Structure
```
kboa-academy/
├── index.html                 # Home page
├── courses.html               # Courses listing
├── login.html                 # Student login
├── register.html              # Student registration
├── dashboard.html             # Student dashboard
├── verify-certificate.html    # Certificate verification
├── course-details.html        # Course details (to be created)
├── course-learning.html       # Course learning page (to be created)
├── exam.html                  # Online examination (Phase 2)
├── css/
│   └── styles.css             # Main stylesheet
├── js/
│   ├── firebase-config.js     # Firebase configuration
│   ├── main.js                # Main JavaScript
│   ├── auth.js                # Authentication
│   ├── courses.js             # Courses functionality
│   ├── dashboard.js           # Dashboard functionality
│   └── exam.js                # Exam system (Phase 2)
├── instructor/
│   └── dashboard.html         # Instructor dashboard
├── admin/
│   └── dashboard.html         # Admin dashboard
└── assets/
    └── images/                # Images and logos
```

## Setup Instructions

### 1. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication (Email/Password + Google)
4. Enable Firestore Database
5. Copy your config to `js/firebase-config.js`

### 2. Firebase Configuration
Replace the placeholder values in `js/firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### 3. Firestore Collections
Create these collections in Firestore:

**users**
```
- fullName (string)
- email (string)
- phone (string)
- country (string)
- role (string: student/instructor/admin)
- enrolledCourses (array)
- completedCourses (array)
- createdAt (timestamp)
```

**courses**
```
- title (string)
- description (string)
- category (string)
- instructor (string)
- instructorId (string)
- level (string)
- duration (string)
- price (number)
- image (string)
- modules (array)
- createdAt (timestamp)
```

**enrollments**
```
- studentId (string)
- courseId (string)
- progress (number)
- enrolledAt (timestamp)
- completedAt (timestamp)
```

**certificates**
```
- certificateId (string)
- studentId (string)
- studentName (string)
- courseId (string)
- courseName (string)
- completionDate (string)
- qrCode (string)
```

### 4. Deploy
- Host on Firebase Hosting, Netlify, or Vercel
- Or use any web hosting service

## Phases

### Phase 1 ✅ (Current)
- Website + Student Portal + Admin Portal
- Basic course listing
- Authentication
- Dashboard

### Phase 2 (Next)
- Payment integration (Paystack/Flutterwave)
- Online examination system
- Certificate generation with QR code

### Phase 3
- Live classes
- Instructor portal enhancements
- Video streaming

### Phase 4
- Android App (Google Play Store)

### Phase 5
- International expansion
- Multi-language support (Hausa, Arabic)

## Payment Integration (Phase 2)

### Paystack
- Visit [Paystack](https://paystack.com)
- Create account and get API keys
- Integration fee: 1.5% + ₦100 (local transactions)
- Minimum: ₦50

### Flutterwave
- Visit [Flutterwave](https://flutterwave.com)
- Create account and get API keys
- Integration fee: 1.4% (local transactions)
- Supports multiple payment methods

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == userId;
    }

    // Courses are readable by all authenticated users
    match /courses/{courseId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Enrollments
    match /enrollments/{enrollmentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

## Support
For support, email: info@kboa.edu.ng

## License
© 2026 KBOA - Knowledge Bridge Online Academy. All rights reserved.


---

## Phase 2 Features ✅

### 💳 Payment Integration
- **Paystack Integration**: Secure card, bank, and USSD payments
- **Flutterwave Support**: Alternative payment gateway
- **Payment Flow**: Enroll → Checkout → Payment → Confirmation → Course unlocked
- **Transaction History**: View all payments with receipts

#### Paystack Setup
1. Sign up at [Paystack](https://paystack.com)
2. Get your Public Key (Test/Live)
3. Replace `PAYSTACK_PUBLIC_KEY` in `js/payments/paystack.js`
4. Test with Paystack test cards

#### Paystack Fees (Nigeria)
- Local transactions: 1.5% + ₦100
- International: 3.9% + ₦100
- Minimum charge: ₦50

### 📝 Online Examination System
- **Timer**: Countdown with visual warnings
- **Question Navigation**: Jump to any question
- **Auto-Submit**: Automatic submission when time expires
- **Auto-Marking**: Instant results after submission
- **Review Mode**: See correct/incorrect answers with explanations
- **Certificate Generation**: Auto-generate certificate on passing (70%+)

#### Exam Features
- Multiple choice questions
- Progress tracking
- Mark for review
- Unanswered question warnings
- Time tracking
- Score calculation
- Pass/Fail status

### 🏆 Certificate System
- **Auto-Generation**: Created automatically on course completion
- **Unique ID**: Format `KBOA-YYYY-XXXXXX`
- **QR Code**: Scan to verify online
- **Downloadable**: PDF download option
- **Shareable**: Social media sharing
- **Verifiable**: Online verification page

#### Certificate Features
- Student name
- Course name
- Completion date
- Score percentage
- Certificate ID
- QR Code for verification
- Digital signatures

### 📚 Course Learning Page
- **Video Player**: HTML5 video with controls
- **PDF Viewer**: Embedded PDF viewer
- **Progress Tracking**: Mark lessons as complete
- **Module Navigation**: Sidebar with modules and lessons
- **Auto-Progress**: Track completion percentage
- **Quiz Integration**: Link to lesson quizzes
- **Assignment Submission**: Upload assignments

---

## Updated File Structure

```
kboa-academy/
├── index.html
├── courses.html
├── login.html
├── register.html
├── dashboard.html
├── course-details.html          # NEW - Course details with payment
├── course-learning.html         # NEW - Course learning page
├── exam.html                    # NEW - Online examination
├── certificates.html            # NEW - Certificates page
├── payments.html                # NEW - Payment history
├── verify-certificate.html
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.js
│   ├── main.js
│   ├── auth.js
│   ├── courses.js
│   ├── dashboard.js
│   ├── course-learning.js       # NEW
│   ├── payments/
│   │   └── paystack.js          # NEW
│   ├── exams/
│   │   └── exam-system.js       # NEW
│   └── certificates/
│       └── certificate-generator.js  # NEW
├── instructor/
│   └── dashboard.html
├── admin/
│   └── dashboard.html
└── assets/
    ├── images/
    └── certificates/            # NEW
```

---

## Payment Integration Guide

### 1. Paystack Setup

```javascript
// In js/payments/paystack.js
const PAYSTACK_PUBLIC_KEY = 'pk_test_your_key_here'; // Test
const PAYSTACK_PUBLIC_KEY = 'pk_live_your_key_here'; // Live
```

### 2. Test Cards (Paystack)

| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4084084084084081 | 408 | 12/25 | Success |
| 4084084084084081 | 408 | 12/25 | Insufficient Funds |

### 3. Payment Flow

```javascript
// 1. User clicks Enroll
enrollNow() → Show payment modal

// 2. User selects payment method
processPayment() → Initialize Paystack

// 3. Paystack popup opens
PaystackPop.setup() → User enters card details

// 4. Payment callback
callback() → verifyPayment()

// 5. Verify and enroll
verifyPayment() → createEnrollment() → Redirect to course
```

---

## Exam System Guide

### Creating Questions

```javascript
const questions = [
    {
        id: 1,
        question: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: 1, // Index of correct option
        explanation: "2 + 2 = 4"
    }
];
```

### Exam Configuration

```javascript
examState = {
    timeRemaining: 3600, // 60 minutes
    passMark: 70, // 70%
    questions: [], // Array of questions
    answers: {}, // User answers
    currentQuestion: 0
};
```

---

## Certificate Verification

### Certificate ID Format
```
KBOA-2026-000001
│   │    │
│   │    └── Sequential number (6 digits)
│   └────── Year
└────────── Academy prefix
```

### Verification Process
1. User enters certificate ID
2. System queries Firestore
3. If found, display certificate details
4. Update verify count
5. Show verification status

---

## Next Steps (Phase 3)

- [ ] Live classes with Zoom/Google Meet integration
- [ ] Instructor portal enhancements
- [ ] Video streaming optimization
- [ ] Discussion forums
- [ ] Mobile app (React Native/Flutter)
- [ ] Multi-language support (Hausa, Arabic)
- [ ] Advanced analytics dashboard


---

## Phase 3 Features ✅

### 🎥 Live Classes System
- **Live Classroom**: Video interface with mic/camera controls
- **Live Chat**: Real-time messaging during classes
- **Participants Panel**: View who's in class
- **Raise Hand**: Students can ask questions
- **Upcoming Classes**: Schedule with countdown timers
- **Recorded Sessions**: Access past live classes
- **Calendar View**: Monthly class schedule
- **Reminders**: Set notifications for upcoming classes

#### Live Class Integrations (Production)
- **Jitsi Meet** (Free, self-hosted): `https://jitsi.org`
- **Daily.co** (Developer-friendly): `https://daily.co`
- **Zoom SDK**: For enterprise-grade video
- **Google Meet**: Via embed links

### 👨‍🏫 Enhanced Instructor Portal
- **Course Builder**: 4-step wizard (Info → Content → Pricing → Publish)
- **Drag & Drop Upload**: Videos, PDFs, images
- **Module Management**: Organize lessons into modules
- **Lesson Types**: Video, PDF, Quiz, Assignment
- **Rubric-Based Grading**: Structured scoring system
- **Assignment Review**: View and grade submissions
- **Quick Feedback**: Pre-written feedback snippets
- **Resubmission Requests**: Ask students to redo work
- **Progress Tracking**: Visual course completion meter
- **Draft Saving**: Save work in progress

### 💬 Discussion Forum
- **Topics**: Create discussion threads
- **Categories**: Organize by course/subject
- **Voting**: Upvote/downvote system
- **Replies**: Threaded conversations
- **Accepted Answers**: Mark best responses
- **Badges**: Instructor/OP identification
- **Search**: Find topics quickly
- **Activity Tracking**: Views, replies, timestamps

### 📊 Admin Analytics Dashboard
- **Revenue Tracking**: Daily/monthly trends
- **Enrollment Analytics**: Sources and growth
- **Top Courses**: Ranked by revenue
- **Live Activity Feed**: Real-time updates
- **Demographics**: Student locations
- **Device Usage**: Mobile vs desktop stats
- **Completion Rates**: Course success metrics

### 🌍 Multi-Language Support
- **English**: Default language
- **Hausa**: Complete translation
- **Arabic**: Full RTL (Right-to-Left) support
- **Language Switcher**: One-click switching
- **Persistent**: Saves preference

### 📱 PWA (Progressive Web App)
- **Installable**: Add to home screen
- **Offline Support**: Service worker caching
- **App Manifest**: Native app feel
- **Push Notifications**: Ready for implementation

---

## Updated Complete File Structure

```
kboa-academy/
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
├── live-classes.html              # NEW - Live classes
├── forum.html                     # NEW - Discussion forum
├── verify-certificate.html
├── manifest.json                  # NEW - PWA manifest
├── sw.js                          # NEW - Service worker
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.js
│   ├── main.js
│   ├── auth.js
│   ├── courses.js
│   ├── dashboard.js
│   ├── course-learning.js
│   ├── language.js                # NEW - Multi-language
│   ├── payments/
│   │   └── paystack.js
│   ├── exams/
│   │   └── exam-system.js
│   ├── certificates/
│   │   └── certificate-generator.js
│   ├── live/                      # NEW
│   │   └── live-classes.js
│   └── forum/                     # NEW
│       └── forum.js
├── instructor/
│   ├── dashboard.html
│   ├── create-course.html         # NEW - Course builder
│   └── grade-assignments.html     # NEW - Grading interface
├── admin/
│   ├── dashboard.html
│   └── analytics.html             # NEW - Analytics
└── assets/
    ├── images/
    ├── pdfs/
    └── certificates/
```

---

## Phase 4 & 5 Roadmap

### Phase 4: Android App
- **Option A**: React Native (JavaScript)
- **Option B**: Flutter (Dart)
- **Option C**: Capacitor (Wrap existing web app)
- **Features**: Offline downloads, push notifications, native payments

### Phase 5: International Expansion
- Payment gateways per region
- Localized content
- Regional instructors
- Currency conversion
- Multi-region hosting

---

## Deployment Checklist

### Pre-Launch
- [ ] Replace Firebase config with production keys
- [ ] Replace Paystack test key with live key
- [ ] Set up Firestore security rules
- [ ] Add real course content
- [ ] Create instructor accounts
- [ ] Test payment flow end-to-end
- [ ] Test exam system thoroughly
- [ ] Generate app icons (all sizes)
- [ ] Set up custom domain
- [ ] Enable SSL certificate

### Firebase Hosting Deploy
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Firestore Indexes (create these)
```
enrollments: studentId ASC, enrolledAt DESC
certificates: certificateId ASC
forum_topics: category ASC, createdAt DESC
exam_results: studentId ASC, submittedAt DESC
live_classes: startTime ASC
```


---

## Phase 4: Android App ✅

### 📱 Technology: Capacitor
The existing web app is wrapped into a native Android app — **no code rewrite needed**.

### What's Included

| File | Purpose |
|------|---------|
| `capacitor.config.json` | App ID, splash screen, plugin settings |
| `package.json` | Capacitor dependencies & build scripts |
| `js/native-bridge.js` | Web ↔ Android bridge (auto-injected into pages) |
| `PLAY_STORE_GUIDE.md` | **Complete step-by-step Play Store deployment** |
| `docs/cloud-functions.js` | Push notification triggers (4 automated) |
| `docs/play-store-description.txt` | Ready-made store listing text |
| `android-config/` | Gradle templates, FCM service, icon generator |

### 🤖 Native Features Enabled

- 🔔 **Push Notifications** — new lessons, assignment deadlines, live class reminders, certificates (via Firebase Cloud Messaging)
- ⬇️ **Offline Video Downloads** — download lessons on Wi-Fi, watch without internet
- 📡 **Offline Banner** — automatic "You are offline" indicator
- 📤 **Native Share** — share certificates & courses to WhatsApp etc.
- 🔙 **Back Button** — proper Android navigation
- 💾 **Local Notifications** — exam reminders (no internet needed)

### 🚀 Quick Start (Developer)

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android    # Opens Android Studio
```

Then follow **PLAY_STORE_GUIDE.md** (10 steps: keystore → Play Store).

### 💰 Costs

| Item | Cost |
|------|------|
| Google Play Developer | $25 one-time |
| Service fee | 15% (education rate) |

---

## Complete Project Structure (All Phases)

```
kboa-academy/                       # 60+ files
├── index.html                      # Public site
├── courses.html / course-details.html
├── login.html / register.html / forgot-password.html
├── dashboard.html                  # Student portal (10 pages)
├── my-courses.html / assignments.html / quizzes.html
├── results.html / certificates.html / payments.html
├── profile.html / settings.html
├── course-learning.html / exam.html
├── live-classes.html / forum.html / verify-certificate.html
├── instructor/                     # 9 pages (courses, students, grading...)
├── admin/                          # 9 pages (students, teachers, payments...)
├── js/                             # 15+ modules
│   ├── native-bridge.js            # ⭐ NEW — Android bridge
│   ├── language.js                 # EN/HA/AR
│   ├── payments/ exams/ certificates/ live/ forum/
├── css/styles.css
├── capacitor.config.json           # ⭐ NEW
├── package.json                    # ⭐ NEW
├── manifest.json / sw.js           # PWA
├── PLAY_STORE_GUIDE.md             # ⭐ NEW — deployment bible
├── android-config/                 # ⭐ NEW — Gradle/FCM/icons
├── docs/                           # ⭐ NEW — cloud functions, store text
└── assets/
```

### Blueprint Status: **100% COMPLETE** 🎉
Phases 1-4 done. Phase 5 (International Expansion) is ready whenever you are.

## Production Build Status

- Phase 1: Security hardening and trusted payment/exam/certificate functions
- Phase 2: Backend RBAC, admissions, audit logs, XP service, Paystack webhook and privileged admin actions
- Next: Phase 3 — production database integrity, admissions UI, full RBAC administration, observability and automated security tests

## Production Phase 3
Phase 3 adds the real admissions workflow, admin admissions queue, security audit-log UI, protected course-asset signed URLs, and CI static checks. See `PRODUCTION_PHASE_3.md`.

## Production Phase 4
See `PRODUCTION_PHASE_4.md`. Phase 4 adds trusted FCM token registration, notification delivery/read state, automatic admission notifications, admin notification sending, and XP read/level APIs.

## Production Phase 6

Phase 6 adds centralized client error reporting, trusted instructor dashboard KPI retrieval, Firebase emulator configuration, an automated emulator smoke test, and CI integration. See `PRODUCTION_PHASE_6.md`.

## Production Phase 9

Phase 9 adds the production deployment gate, Firebase Rules emulator test harness, browser smoke harness, seed/cleanup-ready security fixtures, and explicit staging/live deployment criteria. See `DEPLOYMENT_GATE.md` and `tests/rules-emulator.js`.

## Production Phase 10

Phase 10 adds protected staging/production GitHub deployment workflows, fail-closed deployment gates, production health verification, and a documented rollback runbook. Production deployment is manual and requires an explicit confirmation string plus protected GitHub Environment secrets.


## Production Phase 12

Phase 12 adds atomic payment idempotency, concurrent webhook/verification protection, restore-drill evidence, disaster-recovery procedures, and a fail-closed recovery readiness gate. See `DATA_INTEGRITY.md` and `DISASTER_RECOVERY.md`.

## Production Phase 15 — Authorization Architecture

Phase 15 adds centralized role permissions, deny-by-default callable authorization, resource-level ownership checks, authorization telemetry, and Firestore ownership immutability protections. See `AUTHORIZATION_PHASE_15.md` and `tests/phase15-static.js`.

## Production Phase 16 — API & Service Architecture

- Versioned API/service contract (`v1` / `phase-16-v1`)
- Correlation/request IDs
- Standard response metadata
- Central request validation
- Idempotency service for retryable mutations
- Server-only idempotency records
- Restored production exam-result scoring/write flow
- API architecture and migration documentation

See `API_ARCHITECTURE_PHASE_16.md` and `API_MIGRATION_PHASE_16.md`.

## Production Phase 17
Background job orchestration now provides durable jobs, transactional claiming, leases, retries/backoff, dead-letter handling, scheduled processing, and admin job controls. See `BACKGROUND_JOBS_PHASE_17.md`.

## Production Phase 18
Event-driven architecture is implemented with a transactional `event_outbox`, scheduled publisher, idempotent notification consumers, retry/backoff, dead-letter handling, admin inspection/retry, and event observability. See `EVENT_DRIVEN_PHASE_18.md`.
