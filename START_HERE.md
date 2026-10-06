# 🎓 KBOA — Jagoran Cikakkiya Daga A Zuwa Z
# (Registration ɗalibin → Koyo → Jarabawar → Certificate)
# Rubutacciya don: Admin, Instructor, da ɗalibin kansa

---

# 🔧 MATAKI NA 0: Shirya Tsarin (Sau ɗaya kacal)

Ka riga ka gina mafi yawancin wannan. Sai ka tabbatar:

| # | Aiki | Yana ina |
|---|------|----------|
| 1 | Firebase config ya shiga | ✅ An yi — `js/firebase-config.js` |
| 2 | **Email/Password + Google** enabled | [Firebase Console → Authentication](https://console.firebase.google.com/project/akboa-academy/authentication) |
| 3 | Firestore database a cire | [Console → Firestore](https://console.firebase.google.com/project/akboa-academy/firestore) |
| 4 | **Rules** aka paste + Publish | [Console → Firestore → Rules](https://console.firebase.google.com/project/akboa-academy/firestore/rules) — daga `firestore.rules` |
| 5 | Storage enabled + **storage.rules** | [Console → Storage](https://console.firebase.google.com/project/akboa-academy/storage) |
| 6 | Site deployed | `firebase deploy --only hosting` → `https://akboa-academy.web.app` |
| 7 | **Seed data** (courses + exam) | Buɗe `https://akboa-academy.web.app/docs/seed.html` a matsayin **admin** → danna Seed → **Goge `docs/seed.html` daga hosting** |
| 8 | **Paystack LIVE key** | `js/payments/paystack.js` — sanya `pk_live_...` |

---

# 👨‍🏫 MATAKI NA 1: Instructor — Ƙirƙirar Content

### 1.1 Ƙirƙirar Account ɗin Instructor
**Hanya A (Admin ya ƙirƙira):**
1. Admin → [Teachers](https://akboa-academy.web.app/admin/teachers.html) → **+ Add Teacher** (yana buƙatar Cloud Functions)
2. Ko a **Firestore Console** → `users` → ɗora sabon document da hannu:

```json
{
  "fullName": "Ahmad Bello",
  "email": "ahmad@kboa.edu.ng",
  "role": "instructor",
  "status": "active",
  "createdAt": <server timestamp>
}
```
3. Sannan a **Firebase Console → Authentication → Users → Add user** (email + password)

**Hanya B (Kansa ya yi register):**
1. ɗalibi ya yi register a matsayin student
2. Admin ya shiga Firestore → `users` → document ɗinsa → ya canza `role` → `"instructor"`

### 1.2 Ƙirƙirar Course
1. Login a [instructor portal](https://akboa-academy.web.app/instructor/dashboard.html)
2. **+ Create Course** → cike:
   - Title, Description, Category, Level, Price
   - **Modules & Lessons**: Add Module → Add Lesson (video/pdf/quiz/assignment)
3. **💾 Save Draft** ko **🚀 Submit for Review**
4. Course yana zuwa **admin review queue**

### 1.3 Ƙirƙirar Assignment
1. [Assignments](https://akboa-academy.web.app/instructor/assignments.html) → **+ Create**
2. Title, Course, Instructions, **Due Date**, Points
3. **✅ Publish** → ɗalibai masu enroll za su ga shi nan take

### 1.4 Ƙirƙirar Quiz
1. [Quizzes](https://akboa-academy.web.app/instructor/quizzes.html) → **+ Create**
2. Title, duration, pass mark, course
3. **+ Add Question** → rubuta question + 4 options → **radio button** a gurin amsar da ba daidai ba
4. **✅ Publish** → ɗalibi zai iya ɗaukar sa

---

# 👨‍💼 MATAKI NA 2: Admin — Amincewa da Duk Abin

### 2.1 Amincewa da Course
1. [Admin → Courses](https://akboa-academy.web.app/admin/courses.html)
2. Ga course ɗin da yake **Pending Review** → **✅ Approve** → ya zama **Published** (ɗalibai za su ga shi)

### 2.2 Amincewa da Instructor
1. [Admin → Teachers](https://akboa-academy.web.app/admin/teachers.html)
2. Ga **Pending** → **✅ Approve** → zai iya ɗora content

---

# 🎓 MATAKI NA 3: ɗalibi — Daga Registration zuwa Certificate

### 3.1 Registration (5 dakika)
1. Buɗe `https://akboa-academy.web.app/register.html`
2. Cike form ɗin:
   - Full Name, Email, Phone (+234...), Country
   - Password (ga strength meter — yi strong password)
   - ✅ Terms
3. **Create Account** → 🎉 **Welcome panel**
4. 📧 **Check inbox** — verification email (danna link ɗin)

### 3.2 Zaɓar Course + Biya
1. [Courses](https://akboa-academy.web.app/courses.html) → ga courses na gaskiya daga database
2. Danna course → **🚀 Enroll Now**
3. **Checkout modal** → zaɓi **Paystack** → danna Pay
4. Paystack popup → shigar da ATM card ɗinka → **Pay ₦X,XXX**
5. Payment ya tabbata a **server** → automatically **enrolled** → redirect zuwa course

> 💡 **Gwajin farko:** Yi enrollment a ₦500 course ko ƙaramin farashi ka tabbatar flow ɗin yana aiki kafin ka fara marketing.

### 3.3 Koyo (Course Learning)
1. [My Courses](https://akboa-academy.web.app/my-courses.html) → **▶ Continue Learning**
2. Sidebar → danna lesson → video ya budewa
3. **✓ Mark as Complete** (ko video ya ƙare kansa)
4. Progress bar yana ƙaruwa — **yana adana a database** (idan ka sake shiga daga wani waya, progress ɗinka yana nan)
5. Ka gama duk lessons → **Finish Course** → redirect zuwa exam

### 3.4 Jarabawar (Exam)
1. Exam page yana nuna:
   - Adadin tambayoyi, lokaci, pass mark (70%)
2. **🚀 Start Exam** → **timer** ya fara
3. Amsa tambayoyi → ka na iya **navigation** (Previous/Next/question dots)
4. Lokaci ya ƙare ko ka danna Submit → **Auto-marking nan take**
5. Sakamako:
   - **PASSED 🎉** → certificate **ana ƙirƙirarta atomatik**
   - **FAILED** → ka na iya **Retake**

### 3.5 Certificate ɗinka
1. [Certificates](https://akboa-academy.web.app/certificates.html) → ga certificate ɗinka
2. Danna **📥 Download** → PDF file
3. Danna **🔗 Share** → share zuwa WhatsApp/LinkedIn
4. Certificate yana da:
   - Sunanka, Course, Score, Date
   - **ID: KBOA-2026-XXXXXX**
   - **QR Code** — scans zuwa verification page

---

# 🔍 MATAKI NA 4: Mai Aiki — Tabbatar Certificate

1. Buɗe `https://akboa-academy.web.app/verify-certificate.html`
2. Shigar da ID (ko scan QR code)
3. Za a ga:
   - ✅ **VALID** + sunanka, course, score, date
   - Ko ❌ NOT FOUND (idɗin ba a samu)

---

# 🏆 MATAKI NA 5: Admin — Sarrafa Certificates

1. [Admin → Certificates](https://akboa-academy.web.app/admin/certificates.html)
2. **🏆 Generate Certificate**:
   - **📝 Single**: zaɓi ɗalibi + course + score → generate
   - **📦 Bulk**: zaɓi exam → auto-issue ga **duk waɗanda suka pass** (skips existing)
3. **🔍 Quick Verify** a wannan shafin — shigar da ID
4. **🚫 Revoke** idan akwai matsala (tare da reason)
5. **📥 Export CSV** — cikakken list

---

# ✅ CHECKLIST: Gwajin Cikakken Flow (Kafin Launch)

```
□ 1. Register sabon ɗalibi account
□ 2. Verify email ya iso
□ 3. Seed/admin ya sanya course guda ɗaya (price ₦500)
□ 4. ɗalibi ya enroll → Paystack popup ya budewa
□ 5. Biya ta yi aiki → automatically enrolled
□ 6. Dashboard yana nuna course + progress bar
□ 7. Lesson ya budewa → Mark Complete → progress %
□ 8. Instructor ya ga ɗalibi a "My Students" tare da progress
□ 9. Instructor ya ƙirƙira quiz → ɗalibi ya ɗauka → score saved
□ 10. ɗalibi ya yi exam → PASS → certificate issued
□ 11. Certificate yana a [Certificates] page ɗalibin
□ 12. Verify page yana nuna VALID ga ID ɗin
□ 13. Admin ya ga transaction a Payments page
□ 14. Admin ya ga ɗalibi a Students page
```

---

# ❌ Matsalolin Da Sukeyi + Maganinsu

| Matsala | Magani |
|---------|--------|
| "The requested action is invalid" | Enable Email/Password a Authentication |
| "permission-denied" | Paste `firestore.rules` → Publish |
| Payment popup ba ya buɗewa | Sanya LIVE `pk_live_` key a paystack.js |
| "Analytics is not a function" | An gyara — sabunta `js/firebase-config.js` |
| Upload ba ya aiki | Publish `storage.rules` a Storage → Rules |
| `firebase functions` errors | `firebase deploy --only functions` + set `PAYSTACK_SECRET_KEY` secret |
| Certificate ba ta budewa a ɗalibin | Tabbatar `passed: true` a exam_results |
| Blank page after deploy | `npx cap sync` ba shi — web: duba browser console (F12) |

---

# 📞 Tattaunawa Tsakanin Portal ɗin

| Wane ya ga wane? |
|------------------|
| Instructor ya ƙirƙira course → **Admin yana ganin sa a Courses (pending)** |
| Admin ya approve → **ɗalibai suna ganin course a Courses page** |
| ɗalibi ya enroll → **Instructor yana ganin sa a My Students** |
| ɗalibi ya submit assignment → **Instructor yana ganin sa a Grade Submissions** |
| Instructor ya grade → **ɗalibi yana ganin score a Results** |
| ɗalibi ya pass exam → **Certificate auto → ɗalibi + Admin suna ganin sa** |

---

*Wannan shine tsarin gaba ɗaya. Kowane mataki yana aiki da database ɗinka na gaskie — babu abin da ke "demo".* 🚀
