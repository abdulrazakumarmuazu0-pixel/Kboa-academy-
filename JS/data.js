// ============================================
// KBOA — Production Data Layer
// Every read/write goes to Firestore. No demo data.
// ============================================

const KBOA_FUNCTIONS_BASE = 'https://us-central1-akboa-academy.cloudfunctions.net';

async function kboaCallFunction(name, data) {
    const user = auth.currentUser;
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = 'Bearer ' + await user.getIdToken();
    const response = await fetch(KBOA_FUNCTIONS_BASE + '/' + name, {
        method: 'POST', headers: headers, body: JSON.stringify({ data: data || {} })
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
        const message = payload?.error?.message || ('Function ' + name + ' failed');
        throw new Error(message);
    }
    return payload.data;
}

window.kboaCallFunction = kboaCallFunction;

const KBOA = {

    // ---------- COURSES ----------
    async getPublishedCourses(category) {
        let query = db.collection('courses')
            .where('status', '==', 'published')
            .orderBy('createdAt', 'desc');
        const snap = await query.get();
        let courses = snap.docs.map(function(doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
        if (category && category !== 'all') {
            courses = courses.filter(function(c) { return c.category === category; });
        }
        return courses;
    },

    async getCourse(courseId) {
        const doc = await db.collection('courses').doc(courseId).get();
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    },

    // ---------- ENROLLMENTS ----------
    async getMyEnrollments(studentId) {
        const snap = await db.collection('enrollments')
            .where('studentId', '==', studentId)
            .get();
        const enrollments = [];
        for (const doc of snap.docs) {
            const data = doc.data();
            const course = await KBOA.getCourse(data.courseId);
            if (course) {
                enrollments.push({
                    enrollmentId: doc.id,
                    course: course,
                    progress: data.progress || 0,
                    completedLessons: data.completedLessons || [],
                    enrolledAt: data.enrolledAt,
                    completedAt: data.completedAt || null
                });
            }
        }
        return enrollments;
    },

    async getEnrollment(studentId, courseId) {
        const snap = await db.collection('enrollments')
            .where('studentId', '==', studentId)
            .where('courseId', '==', courseId)
            .limit(1)
            .get();
        if (snap.empty) return null;
        return { id: snap.docs[0].id, data: snap.docs[0].data() };
    },

    async updateLessonProgress(enrollmentId, completedLessons, progress) {
        await db.collection('enrollments').doc(enrollmentId).update({
            completedLessons: completedLessons,
            progress: progress,
            lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async markCourseCompleted(enrollmentId) {
        await db.collection('enrollments').doc(enrollmentId).update({
            progress: 100,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    // ---------- EXAMS ----------
    async getExam(examId) {
        const doc = await db.collection('exams').doc(examId).get();
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    },

    // Get the active exam for a course (or default first published exam)
    async getActiveExam(courseId) {
        let snap = await db.collection('exams')
            .where('status', '==', 'published')
            .orderBy('createdAt', 'desc')
            .get();
        if (snap.empty) return null;
        // Prefer exam matching the course
        let exam = snap.docs.find(function(d) { return d.data().courseId === courseId; });
        const chosen = exam || snap.docs[0];
        return Object.assign({ id: chosen.id }, chosen.data());
    },

    async saveExamResult(result) {
        return kboaCallFunction('submitExamResult', {
            examId: result.examId,
            answers: result.answers || {}
        });
    },

    // ---------- CERTIFICATES ----------
    async getMyCertificates(studentId) {
        const snap = await db.collection('certificates')
            .where('studentId', '==', studentId)
            .orderBy('createdAt', 'desc')
            .get();
        return snap.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
    },

    async verifyCertificate(certId) {
        const result = await kboaCallFunction('verifyCertificate', { certificateId: certId });
        if (!result || !result.valid) return null;
        return result;
    },

    // ---------- ASSIGNMENTS ----------
    async getPendingAssignments(studentId) {
        const snap = await db.collection('submissions')
            .where('studentId', '==', studentId)
            .where('status', '==', 'pending')
            .get();
        return snap.size;
    },

    // ---------- UI HELPERS ----------
    emptyState(icon, title, message, actionHtml) {
        return '<div style="text-align:center;padding:50px 20px;color:var(--gray-500);">'
            + '<div style="font-size:3rem;margin-bottom:12px;">' + icon + '</div>'
            + '<h3 style="color:var(--gray-700);margin-bottom:8px;">' + title + '</h3>'
            + '<p style="margin-bottom:18px;">' + message + '</p>'
            + (actionHtml || '') + '</div>';
    },

    errorState(message) {
        return '<div style="text-align:center;padding:40px 20px;color:#991b1b;">'
            + '<div style="font-size:2.5rem;margin-bottom:10px;">⚠️</div>'
            + '<p>' + message + '</p></div>';
    }
};

window.KBOA = KBOA;
