# 🔧 KBOA Error Fix Guide — 3 Errors, 5 Minutes
# Your screenshot showed 3 errors. Fix them in this order:

---

## ❌ ERROR 1: "The requested action is invalid" (Login not working)

**Cause:** Email/Password sign-in is NOT enabled in your Firebase project.

### Fix (2 minutes):
1. Open: https://console.firebase.google.com/project/akboa-academy/authentication
2. Click **"Get started"** (if you see it)
3. Go to tab **"Sign-in method"**
4. Click **"Email/Password"** in the providers list
5. Toggle **"Enable"** → Save
6. ✅ Also enable **"Google"** while you're there

---

## ❌ ERROR 2: "permission-denied: Missing or insufficient permissions" (dashboard.js)

**Cause:** Firestore has DEFAULT rules (deny everything). My custom rules were never loaded.

### Fix (2 minutes):
1. Open: https://console.firebase.google.com/project/akboa-academy/firestore/rules
2. **DELETE everything** in the rules editor
3. Open the file `firestore.rules` from the project ZIP
4. **Copy all** → **Paste** into the rules editor
5. Click **"Publish"**
6. ✅ Done — dashboard will now load user data

---

## ❌ ERROR 3: "Analytics not available: firebase.analytics is not a function"

**Status:** ✅ **ALREADY FIXED** — I removed the buggy code.
Just re-upload the new `js/firebase-config.js` from the updated ZIP.

---

## 📤 How to Update Your Live Site

Your site files are in Firebase Hosting. Update them:

**Option A — Re-deploy from computer:**
```bash
firebase deploy --only hosting
```

**Option B — Update via Console (from phone is hard; use a computer):**
1. Download the new ZIP
2. Replace these 3 files:
   - `js/firebase-config.js`
   - `js/auth.js`
   - `firestore.rules` (paste into Console, not hosting)
3. Deploy again

---

## ✅ After Fixing — Test Checklist

| Test | Expected |
|------|----------|
| Register new account | ✅ Redirects to dashboard |
| Login | ✅ Works, name shows |
| Dashboard loads | ✅ No more red errors in console |
| Logout → Login again | ✅ Works |

---

## 🛡️ Optional Security Upgrade (later, when stable)

The current rules are "launch rules" — simple and working.
After your site is running well, you can tighten them
(the stricter version is documented in the README).
Don't do it today — **get it working first!**
