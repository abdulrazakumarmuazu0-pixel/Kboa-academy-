// KBOA Auth v2.1 — role-based redirect (admin/instructor/student)
// ============================================
// KBOA — Authentication (Production)
// Register: email/password + email verification + auto student ID
// Login: email/password + Google
// ============================================

// ---------- SECURITY SESSION ----------
async function registerSecuritySession(user) {
    try {
        var sessionId = localStorage.getItem('kboa_security_session_id');
        if (!sessionId) {
            sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('kboa-' + Date.now() + '-' + Math.random().toString(36).slice(2));
            localStorage.setItem('kboa_security_session_id', sessionId);
        }
        var fn = firebase.functions().httpsCallable('registerSecuritySession');
        await fn({ sessionId: sessionId, userAgent: navigator.userAgent || '' });
    } catch (e) { console.warn('Security session registration skipped:', e.message || e); }
}

// ---------- REGISTER ----------
var registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        clearErrors();

        var fullName = document.getElementById('fullName').value.trim();
        var email = document.getElementById('email').value.trim();
        var phone = document.getElementById('phone').value.trim();
        var country = document.getElementById('country').value;
        var password = document.getElementById('password').value;
        var confirmPassword = document.getElementById('confirmPassword').value;
        var terms = document.getElementById('terms').checked;

        // ---- Validation ----
        var valid = true;
        if (fullName.length < 3) { showError('fullName', 'Enter your full name (min 3 characters)'); valid = false; }
        if (!isValidEmail(email)) { showError('email', 'Enter a valid email address'); valid = false; }
        var digits = phone.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) { showError('phone', 'Enter a valid phone number (10-15 digits)'); valid = false; }
        if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) { showError('password', 'Use at least 12 characters with uppercase, lowercase, and a number'); valid = false; }
        if (password !== confirmPassword) { showError('confirmPassword', 'Passwords do not match'); valid = false; }
        if (!country) { showError('country', 'Select your country'); valid = false; }
        if (!terms) { showError('terms', 'You must agree to the Terms to continue'); valid = false; }
        if (!valid) {
            var card = document.getElementById('auth-card');
            card.classList.add('error-shake');
            setTimeout(function() { card.classList.remove('error-shake'); }, 450);
            return;
        }

        // ---- Loading state ----
        var btn = document.getElementById('register-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Creating your account…';
        var googleBtn = document.getElementById('google-btn');
        if (googleBtn) googleBtn.disabled = true;

        try {
            // 1. Create auth account
            var cred = await auth.createUserWithEmailAndPassword(email, password);
            var user = cred.user;
            await registerSecuritySession(user);

            // 2. Set display name
            await user.updateProfile({ displayName: fullName });

            // 3. Create the profile through the trusted backend.
            // Student IDs and privileged fields are never generated client-side.
            var createProfile = firebase.functions().httpsCallable('createStudentProfile');
            var profileResult = await createProfile({
                fullName: fullName,
                phone: phone,
                country: country
            });
            var studentId = profileResult.data && profileResult.data.studentId;

            // 4. Send verification email (non-blocking — don't fail registration if it errors)
            try {
                await user.sendEmailVerification();
            } catch (verifyErr) {
                console.warn('Verification email failed:', verifyErr.message);
            }

            // 6. Success — swap form for welcome panel
            document.getElementById('register-form').style.display = 'none';
            var footer = document.getElementById('form-footer');
            if (footer) footer.style.display = 'none';
            var successPanel = document.getElementById('success-panel');
            document.getElementById('success-email').textContent = email;
            successPanel.style.display = 'block';
            showAlert('✅ Account created successfully!', 'success');

        } catch (error) {
            console.error('Registration error:', error);
            // If Firebase Auth succeeded but the trusted student profile failed, remove the
            // just-created Auth account so a half-registered student cannot be stranded.
            try {
                if (auth.currentUser && auth.currentUser.uid) await auth.currentUser.delete();
            } catch (cleanupError) {
                console.warn('Registration cleanup requires retry/login:', cleanupError.message || cleanupError);
            }
            btn.disabled = false;
            btn.textContent = 'Create Account';
            if (googleBtn) googleBtn.disabled = false;

            switch (error.code) {
                case 'auth/email-already-in-use':
                    showError('email', 'This email is already registered. Try logging in instead.');
                    break;
                case 'auth/invalid-email':
                    showError('email', 'Invalid email address format');
                    break;
                case 'auth/weak-password':
                    showError('password', 'Password is too weak — use at least 6 characters');
                    break;
                case 'auth/operation-not-allowed':
                    showAlert('⚠️ Email/Password login is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.', 'error');
                    break;
                case 'auth/network-request-failed':
                    showAlert('Network error. Check your internet connection and try again.', 'error');
                    break;
                default:
                    showAlert('Registration failed: ' + error.message, 'error');
            }
        }
    });
}

// ---------- LOGIN ----------
var loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        clearErrors();

        var email = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;
        var remember = document.getElementById('remember').checked;

        if (!email) { showError('email', 'Enter your email address'); return; }
        if (!password) { showError('password', 'Enter your password'); return; }

        var btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Logging in…';

        try {
            await auth.setPersistence(remember
                ? firebase.auth.Auth.Persistence.LOCAL
                : firebase.auth.Auth.Persistence.SESSION);

            var cred = await auth.signInWithEmailAndPassword(email, password);
            await registerSecuritySession(cred.user);

            showAlert('✅ Login successful! Redirecting…', 'success');
            setTimeout(function() { redirectByRole(cred.user); }, 900);

        } catch (error) {
            console.error('Login error:', error);
            btn.disabled = false;
            btn.textContent = 'Login';

            switch (error.code) {
                case 'auth/user-not-found':
                    showError('email', 'No account found with this email. Click "Create Account" below to register.');
                    break;
                case 'auth/invalid-login-credentials':
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                    showError('password', 'Incorrect email or password. Check spelling, or reset via "Forgot Password" below.');
                    break;
                case 'auth/invalid-email':
                    showError('email', 'Invalid email format');
                    break;
                case 'auth/invalid-credential':
                    showError('password', 'Invalid email or password');
                    break;
                case 'auth/user-disabled':
                    showAlert('This account has been suspended. Contact support.', 'error');
                    break;
                case 'auth/too-many-requests':
                    showAlert('Too many failed attempts. Wait a few minutes and try again.', 'warning');
                    break;
                case 'auth/operation-not-allowed':
                    showAlert('⚠️ Email/Password login not enabled in Firebase Console.', 'error');
                    break;
                default:
                    showAlert('Login failed: ' + error.message, 'error');
            }
        }
    });
}

// ---------- GOOGLE SIGN-IN ----------
async function signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
        var result = await auth.signInWithPopup(provider);
        var user = result.user;
        await registerSecuritySession(user);

        // Create profile only if brand-new user
        var userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            var createProfile = firebase.functions().httpsCallable('createStudentProfile');
            await createProfile({
                fullName: user.displayName || 'Student',
                phone: user.phoneNumber || '',
                country: ''
            });
        }

        await redirectByRole(user);
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code === 'auth/popup-closed-by-user') return;
        if (error.code === 'auth/popup-blocked') {
            showAlert('Popup blocked. Allow popups for this site and try again.', 'warning');
            return;
        }
        if (error.code === 'auth/operation-not-allowed') {
            showAlert('⚠️ Google sign-in not enabled in Firebase Console.', 'error');
            return;
        }
        showAlert('Google sign-in failed: ' + error.message, 'error');
    }
}

// ---------- ROLE-BASED REDIRECT ----------
// After login, check the user's role in Firestore and send them
// to the correct dashboard: admin / instructor / student
async function redirectByRole(user) {
    try {
        // Prefer fresh Firebase custom claims, then confirm with the user profile.
        // This prevents a newly-created admin from being misrouted because a stale
        // ID token or a transient Firestore read was used during the redirect.
        var tokenResult = await user.getIdTokenResult(true);
        var claimRole = tokenResult.claims && tokenResult.claims.role;
        var userDoc = await db.collection('users').doc(user.uid).get();
        var profile = userDoc.exists ? userDoc.data() : {};
        var role = claimRole || profile.role || 'student';
        if (user.disabled || profile.status === 'disabled') {
            await auth.signOut();
            showAlert('This account has been disabled. Contact support.', 'error');
            return;
        }
        if (role === 'instructor' && profile.status !== 'active') {
            await auth.signOut();
            var msg = profile.status === 'pending' ? 'Your instructor account is awaiting admin approval.' : 'Your instructor account is not active. Contact KBOA support.';
            showAlert(msg, 'warning');
            return;
        }

        if (role === 'admin') {
            window.location.href = 'admin/dashboard.html';
        } else if (role === 'instructor') {
            window.location.href = 'instructor/dashboard.html';
        } else {
            try {
                var access = await firebase.functions().httpsCallable('getStudentPortalAccess')({});
                if (access.data && access.data.allowed) {
                    window.location.href = 'dashboard.html';
                } else {
                    showAlert('Your student account is ready. Complete a course payment to unlock the Student Dashboard Portal.', 'warning');
                    setTimeout(function() { window.location.href = 'courses.html'; }, 1400);
                }
            } catch (portalError) {
                console.error('Student portal access check failed:', portalError);
                await auth.signOut();
                showAlert('We could not verify your Student Portal access. Please try again.', 'error');
            }
        }
    } catch (e) {
        console.error('Role check failed:', e);
        showAlert('Login succeeded, but your account profile could not be loaded. Please refresh and try again.', 'error');
    }
}

// ---------- HELPERS ----------
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(fieldId, message) {
    var field = document.getElementById(fieldId);
    var err = document.getElementById(fieldId + '-error');
    if (field) field.classList.add('error');
    if (err) { err.textContent = message; err.classList.add('show'); }
}

function clearErrors() {
    document.querySelectorAll('.form-input.error').forEach(function(f) { f.classList.remove('error'); });
    document.querySelectorAll('.form-error').forEach(function(e) { e.classList.remove('show'); });
}

function showAlert(message, type) {
    var container = document.getElementById('alert-container');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.textContent = message;
    container.innerHTML = '';
    container.appendChild(div);
    setTimeout(function() { div.remove(); }, 6000);
}

// If already logged in, send to the correct dashboard by role
auth.onAuthStateChanged(function(user) {
    if (user && !document.getElementById('register-form') && !document.getElementById('success-panel')) {
        if (window.location.pathname.indexOf('login.html') !== -1) {
            redirectByRole(user);
        }
    }
});
