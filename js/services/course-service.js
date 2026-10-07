const KBOACourseService = (() => {
  function ensureFirebase() {
    const firebaseInstance = window.firebase || globalThis.firebase;
    if (!firebaseInstance) {
      throw new Error('Firebase SDK is not loaded.');
    }

    const dbInstance = window.db || firebaseInstance.firestore();
    return { db: dbInstance };
  }

  function mapCourseRecord(doc) {
    const data = doc && doc.data ? doc.data() : {};
    return {
      ...data,
      id: doc && doc.id ? doc.id : data.id || null
    };
  }

  async function getPublishedCourses() {
    const { db } = ensureFirebase();

    const snapshot = await db
      .collection('courses')
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(mapCourseRecord);
  }

  async function getCourseById(courseId) {
    const { db } = ensureFirebase();

    if (!courseId) {
      throw new Error('Course ID is required.');
    }

    const snapshot = await db.collection('courses').doc(courseId).get();
    return snapshot.exists ? mapCourseRecord(snapshot) : null;
  }

  async function getCoursesByCategory(category) {
    const { db } = ensureFirebase();

    const ref = db.collection('courses');
    const snapshot = await ref
      .where('status', '==', 'published')
      .where('category', '==', category)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(mapCourseRecord);
  }

  async function getStudentEnrollments(studentId) {
    const { db } = ensureFirebase();

    if (!studentId) {
      return [];
    }

    const snapshot = await db
      .collection('enrollments')
      .where('studentId', '==', studentId)
      .orderBy('enrolledAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  }

  function getCategoryName(category) {
    const map = {
      academic: 'Academic',
      digital: 'Digital Skills',
      business: 'Business',
      tech: 'AI & Tech'
    };

    return map[category] || (category || 'Course');
  }

  function formatPrice(value) {
    const numeric = Number(value || 0);
    return numeric > 0 ? '₦' + numeric.toLocaleString() : 'FREE';
  }

  return {
    ensureFirebase,
    getPublishedCourses,
    getCourseById,
    getCoursesByCategory,
    getStudentEnrollments,
    getCategoryName,
    formatPrice,
    mapCourseRecord
  };
})();

window.KBOACourseService = KBOACourseService;
