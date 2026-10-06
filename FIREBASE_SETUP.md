# 🔥 KBOA Firebase Setup — akboa-academy (Step-by-Step)
# Your config is ALREADY plugged in. Complete these 6 steps in the Firebase Console.

---

## ✅ STEP 1: Enable Authentication (2 mins)

1. Go to: https://console.firebase.google.com/project/akboa-academy/authentication
2. Click **Get Started**
3. **Sign-in method** tab → Enable:
   - ✅ **Email/Password**
   - ✅ **Google** (select your support email, save)
4. Done!

---

## ✅ STEP 2: Create Firestore Database (2 mins)

1. Go to: https://console.firebase.google.com/project/akboa-academy/firestore
2. Click **Create Database**
3. Choose **Production mode** (rules already prepared for you)
4. Location: **eur3 (europe-west)** — closest & cheapest for Nigeria
5. Click **Enable**

### Then deploy the security rules:
```bash
# From project folder (after installing Firebase CLI):
firebase login
firebase use akboa-academy
firebase deploy --only firestore:rules,firestore:indexes
```

Or manually: Firestore → Rules tab → paste contents of `firestore.rules` → **Publish**

---

## ✅ STEP 3: Enable Storage (1 min)

1. Go to: https://console.firebase.google.com/project/akboa-academy/storage
2. Click **Get Started** → Production mode
3. Location: same as Firestore (eur3)
4. Rules tab → paste `storage.rules` → **Publish**

---

## ✅ STEP 4: Create Your Admin Account (3 mins)

1. Open your live site → click **Register**
2. Create account with: **admin@kboa.edu.ng** (or any email)
3. Go to Firestore Console → **users** collection
4. Find your new user document → edit → add field:
   ```
   role (string) = "admin"
   ```
5. Refresh the site — you now have full admin access at `/admin/dashboard.html`

### To create an instructor:
Same process, but set `role = "instructor"`

---

## ✅ STEP 5: Deploy to Firebase Hosting (5 mins)

```bash
# Install Firebase CLI (one-time)
npm install -g firebase-tools

# Login & deploy
firebase login
cd kboa-academy
firebase init hosting   # select existing project "akboa-academy", public dir = "."
firebase deploy --only hosting
```

Your site goes live at: **https://akboa-academy.web.app** 🎉

### Custom domain (optional):
Hosting → Add custom domain → e.g. `kboa.edu.ng`
- Add the TXT record Firebase gives you to your DNS
- Then add the A records
- SSL auto-provisioned (free)

---

## ✅ STEP 6: Populate Starter Data (10 mins)

In Firestore, create these collections (or use admin panel after deploy):

**courses** (add 1 sample course):
```json
{
  "title": "AI & ChatGPT Mastery",
  "description": "Master AI tools and prompt engineering",
  "category": "tech",
  "instructor": "Ahmad Bello",
  "instructorId": "<your-instructor-uid>",
  "level": "Beginner",
  "duration": "4 weeks",
  "price": 5000,
  "status": "published",
  "createdAt": <serverTimestamp>
}
```

---

## 🔐 IMPORTANT: Secure Your API Key

Your web API key is safe in client code (protected by the security rules above),
BUT add a domain restriction for extra safety:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key (browser key for akboa-academy)
3. **HTTP referrers (websites)** → add:
   - `https://akboa-academy.web.app/*`
   - `https://akboa-academy.firebaseapp.com/*`
   - `https://yourdomain.com/*` (when you add one)
   - `http://localhost:*/ *` (for local testing)

---

## 🧪 Test Everything

| Test | Expected Result |
|------|----------------|
| Register new account | Redirects to dashboard, user doc created |
| Login | Works, name shows in topbar |
| Wrong password | Error message shows |
| Access /admin/ without role | Redirected away |
| Set role=admin → access /admin/ | Admin panel opens |
| Verify certificate page (public) | Opens without login ✅ |

---

## 📊 Project Dashboard Shortcuts

| Service | Link |
|---------|------|
| Auth users | https://console.firebase.google.com/project/akboa-academy/authentication/users |
| Firestore data | https://console.firebase.google.com/project/akboa-academy/firestore/data |
| Storage files | https://console.firebase.google.com/project/akboa-academy/storage |
| Hosting | https://console.firebase.google.com/project/akboa-academy/hosting |
| Usage/billing | https://console.firebase.google.com/project/akboa-academy/usage |

---

## 💰 Firebase Free Tier (Spark Plan) — More Than Enough to Start

| Resource | Free Limit | Your Usage |
|----------|-----------|------------|
| Firestore storage | 1 GiB | ~145 MB ✅ |
| Firestore reads/day | 50,000 | Plenty ✅ |
| Firestore writes/day | 20,000 | Plenty ✅ |
| Hosting storage | 1 GB | ~0.3 MB ✅ |
| Hosting bandwidth/month | 10 GB | Plenty ✅ |
| Auth users | Unlimited | ✅ |
| Storage | 5 GB | ✅ |

**Upgrade to Blaze (pay-as-you-go) only when you exceed these — probably after 500+ active students.**
