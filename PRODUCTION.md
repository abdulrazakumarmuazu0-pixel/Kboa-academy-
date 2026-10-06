# 🚀 KBOA — Production Launch Checklist
# NO test mode. NO demo data. Real system only.
# Complete every item before going live.

---

## ✅ 1. Firebase Console (akboa-academy)

| # | Action | Link |
|---|--------|------|
| 1 | Enable **Email/Password** auth | console → Authentication → Sign-in method |
| 2 | Enable **Google** auth | same page |
| 3 | Create **Firestore** database (production mode) | console → Firestore |
| 4 | Paste **`firestore.rules`** → Publish | console → Firestore → Rules |
| 5 | Paste **`storage.rules`** → Publish | console → Storage → Rules |
| 6 | Add your domain to **Authorized domains** in Auth settings | console → Authentication → Settings |

## ✅ 2. Create Your Accounts

1. Register on your live site with **admin@kboa.edu.ng**
2. Firestore Console → `users` → your document → add field:
   - `role` (string) = `admin`
3. (Optional) Create instructor accounts the same way with `role = "instructor"`

## ✅ 3. Seed Real Content (ONE TIME)

1. Login as admin on your live site
2. Open: `https://YOUR-SITE/docs/seed.html`
3. Click **"🚀 Seed Production Data"**
   - Publishes 3 real courses (with modules/lessons)
   - Publishes Mathematics Final Exam (10 real questions)
4. **DELETE `docs/seed.html`** from your project & re-deploy

Then add your real content:
- Admin panel → Courses → add courses
- Instructor portal → create modules, upload videos to Firebase Storage
- Admin → Exams → create real exams with questions

## ✅ 4. Paystack LIVE Payments

1. Paystack dashboard → get **LIVE** keys (not test!)
2. Put public key in `js/payments/paystack.js`:
   ```js
   const PAYSTACK_PUBLIC_KEY = 'pk_live_xxxxxxxx';
   ```
3. Server-side verification (REQUIRED for production):
   ```bash
   firebase functions:secrets:set PAYSTACK_SECRET_KEY
   # paste your sk_live key
   firebase deploy --only functions
   ```
4. Set Paystack **webhook** URL:
   `https://us-central1-akboa-academy.cloudfunctions.net/paystackWebhook`

## ✅ 5. Upload Real Media

| What | Where |
|------|-------|
| Logo | `assets/images/logo.png` |
| Course thumbnails | Firebase Storage → `course-images/` |
| Lesson videos | Firebase Storage → `course-videos/` |
| PDFs | Firebase Storage → `course-materials/` |

## ✅ 6. Final Tests (Real Flow)

| Test | Must Pass |
|------|-----------|
| Register new student | ✅ account created, role=student |
| Seed → courses visible on site | ✅ real courses from Firestore |
| Enroll → Paystack popup with LIVE key | ✅ real ₦ charge |
| Pay ₦100 test amount | ✅ enrolled automatically after payment |
| Watch lesson → Mark complete | ✅ progress saves to Firestore |
| Take exam → submit | ✅ result saved, certificate issued if passed |
| Verify certificate ID on public page | ✅ shows real data |
| Admin panel stats | ✅ real numbers only |

## ✅ 7. Android App (after web is live)

Follow `PLAY_STORE_GUIDE.md` — remember:
- Register Android app in Firebase with package `ng.edu.kboa.app`
- Download new `google-services.json` → `android/app/`
- Paystack works in-app via the same web checkout

---

## ❌ REMOVED (was test/demo — now gone)

- ~~Hardcoded sample courses in JS~~ → loaded from Firestore
- ~~20 demo math questions in code~~ → real exams from Firestore
- ~~Fake course modules with example.com URLs~~ → real content from database
- ~~`alert('In production...')` stubs~~ → real actions or removed
- ~~Paystack test key~~ → live key + server verification
- ~~Demo dashboard numbers~~ → real counts from Firestore
