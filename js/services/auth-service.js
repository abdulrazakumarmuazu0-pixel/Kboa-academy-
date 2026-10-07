const KBOAAuthService = (() => {
  function ensureFirebase() {
    const firebaseInstance = window.firebase || globalThis.firebase;
    if (!firebaseInstance) {
      throw new Error('Firebase SDK is not loaded.');
    }

    const authInstance = window.auth || firebaseInstance.auth();
    const dbInstance = window.db || firebaseInstance.firestore();

    return { firebase: firebaseInstance, auth: authInstance, db: dbInstance };
  }

  async function registerSecuritySession(user) {
    try {
      const { firebase } = ensureFirebase();
      const sessionId = localStorage.getItem('kboa_security_session_id') || (
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : 'kboa-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      );

      if (!localStorage.getItem('kboa_security_session_id')) {
        localStorage.setItem('kboa_security_session_id', sessionId);
      }

      if (firebase.functions) {
        const fn = firebase.functions().httpsCallable('registerSecuritySession');
        await fn({ sessionId, userAgent: navigator.userAgent || '' });
      }
    } catch (error) {
      console.warn('Security session registration skipped:', error && error.message ? error.message : error);
    }
  }

  async function getUserProfile(uid) {
    const { db } = ensureFirebase();
    if (!uid) return null;

    const snapshot = await db.collection('users').doc(uid).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function getUserRole(uid) {
    const profile = await getUserProfile(uid);
    return profile && profile.role ? profile.role : 'student';
  }

  async function getUserRoleFromToken(user) {
    if (!user) return 'student';

    try {
      const tokenResult = await user.getIdTokenResult(true);
      return (tokenResult && tokenResult.claims && tokenResult.claims.role) || 'student';
    } catch (error) {
      console.warn('Could not read token claims:', error && error.message ? error.message : error);
      return 'student';
    }
  }

  async function createStudentProfile({ fullName, phone, country }) {
    const { firebase } = ensureFirebase();

    if (!firebase.functions) {
      throw new Error('Firebase Functions is not available.');
    }

    const createProfile = firebase.functions().httpsCallable('createStudentProfile');
    return createProfile({ fullName, phone, country });
  }

  async function loginWithEmailAndPassword(email, password, remember = false) {
    const { firebase, auth } = ensureFirebase();

    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;

    await auth.setPersistence(persistence);
    const credential = await auth.signInWithEmailAndPassword(email, password);
    await registerSecuritySession(credential.user);
    return credential;
  }

  async function registerWithEmailAndPassword({ fullName, email, phone, country, password }) {
    const { auth } = ensureFirebase();

    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: fullName });
    await registerSecuritySession(credential.user);

    const result = await createStudentProfile({ fullName, phone, country });
    return { user: credential.user, profileResult: result };
  }

  async function signInWithGoogle() {
    const { firebase, auth } = ensureFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    const result = await auth.signInWithPopup(provider);
    await registerSecuritySession(result.user);

    const profile = await getUserProfile(result.user.uid);
    if (!profile) {
      await createStudentProfile({
        fullName: result.user.displayName || 'Student',
        phone: result.user.phoneNumber || '',
        country: ''
      });
    }

    return result;
  }

  async function isStudentPortalAllowed() {
    const { firebase } = ensureFirebase();

    if (!firebase.functions) {
      return { allowed: false, reason: 'functions_unavailable' };
    }

    const fn = firebase.functions().httpsCallable('getStudentPortalAccess');
    const result = await fn({});
    return result && result.data ? result.data : { allowed: false };
  }

  function getRoleRedirectPath(role) {
    if (role === 'admin') return 'admin/dashboard.html';
    if (role === 'instructor') return 'instructor/dashboard.html';
    return 'dashboard.html';
  }

  return {
    ensureFirebase,
    registerSecuritySession,
    getUserProfile,
    getUserRole,
    getUserRoleFromToken,
    createStudentProfile,
    loginWithEmailAndPassword,
    registerWithEmailAndPassword,
    signInWithGoogle,
    isStudentPortalAllowed,
    getRoleRedirectPath
  };
})();

window.KBOAAuthService = KBOAAuthService;
