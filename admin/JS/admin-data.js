// ============================================
// KBOA — Admin Data Layer (Production)
// Real Firestore reads/writes. Zero demo data.
// ============================================

// ---------- AUTH GUARD ----------
async function requireAdmin() {
    return new Promise(function(resolve, reject) {
        auth.onAuthStateChanged(async function(user) {
            if (!user) { window.location.href = '../login.html'; return reject(); }
            var doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists || doc.data().role !== 'admin') {
                alert('⛔ Access denied. Admins only.');
                window.location.href = '../dashboard.html';
                return reject();
            }
            resolve(user);
        });
    });
}

// ---------- USER NAME CACHE (avoids N reads) ----------
var _userCache = {};
async function userName(uid) {
    if (_userCache[uid]) return _userCache[uid];
    try {
        var d = await db.collection('users').doc(uid).get();
        var name = d.exists ? (d.data().fullName || d.data().email || uid) : uid;
        _userCache[uid] = name;
        return name;
    } catch (e) { return uid; }
}

// ---------- STUDENTS / TEACHERS ----------
async function getUsersByRole(role) {
    var snap = await db.collection('users').where('role', '==', role)
        .orderBy('createdAt', 'desc').get();
    return snap.docs.map(function(d) { return Object.assign({ uid: d.id }, d.data()); });
}

async function setUserStatus(uid, status) {
    return callFunction('setUserStatus', { uid: uid, status: status });
}

async function setUserRole(uid, role, status) {
    var result = await callFunction('setUserRole', { uid: uid, role: role });
    if (status && status !== 'active') await callFunction('setUserStatus', { uid: uid, status: status });
    return result;
}

async function getUserDetail(uid) {
    var userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;
    var u = Object.assign({ uid: uid }, userDoc.data());

    var enrollSnap = await db.collection('enrollments').where('studentId', '==', uid).get();
    u.enrolledCount = enrollSnap.size;
    u.completedCount = enrollSnap.docs.filter(function(d) { return d.data().completedAt; }).length;

    var certSnap = await db.collection('certificates').where('studentId', '==', uid).get();
    u.certCount = certSnap.size;

    var paySnap = await db.collection('payments').where('studentId', '==', uid)
        .where('status', '==', 'success').get();
    u.totalSpent = paySnap.docs.reduce(function(sum, d) { return sum + (d.data().amount || 0); }, 0);

    return u;
}

// ---------- ADMISSIONS ----------
async function updateAdmissionApplication(applicationId, status, note) {
    return callFunction('updateAdmissionApplication', { applicationId: applicationId, status: status, note: note || '' });
}

// ---------- COURSES ----------
async function getAllCourses() {
    var snap = await db.collection('courses').orderBy('createdAt', 'desc').get();
    var courses = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    // Real student counts
    for (var c of courses) {
        var en = await db.collection('enrollments').where('courseId', '==', c.id).get();
        c.studentCount = en.size;
    }
    return courses;
}

async function setCourseStatus(courseId, status, note) {
    var update = { status: status };
    if (note) update.reviewNote = note;
    await db.collection('courses').doc(courseId).update(update);
}

async function deleteCourseDoc(courseId) {
    await db.collection('courses').doc(courseId).delete();
}

async function createCourse(data) {
    return db.collection('courses').add(Object.assign({}, data, {
        status: 'draft',
        studentCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
}

// ---------- PAYMENTS ----------
async function getPayments(limit) {
    var snap = await db.collection('payments').orderBy('createdAt', 'desc')
        .limit(limit || 100).get();
    var payments = [];
    for (var d of snap.docs) {
        var p = Object.assign({ id: d.id }, d.data());
        p.studentName = await userName(p.studentId);
        payments.push(p);
    }
    return payments;
}

async function setPaymentStatus(paymentId, status) {
    return callFunction('setPaymentStatus', { paymentId: paymentId, status: status });
}

// ---------- CERTIFICATES ----------
async function getAllCertificates() {
    var snap = await db.collection('certificates').orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function setCertificateStatus(certDocId, status, reason) {
    return callFunction('setCertificateStatus', { certificateId: certDocId, status: status, reason: reason || '' });
}

// ---------- EXAMS ----------
async function getExamResults(limit) {
    var snap = await db.collection('exam_results').orderBy('submittedAt', 'desc')
        .limit(limit || 100).get();
    var results = [];
    for (var d of snap.docs) {
        var r = Object.assign({ id: d.id }, d.data());
        r.studentName = await userName(r.studentId);
        results.push(r);
    }
    return results;
}

async function getExams() {
    var snap = await db.collection('exams').orderBy('createdAt', 'desc').get();
    return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
}

async function createExam(data) {
    return db.collection('exams').add(Object.assign({}, data, {
        status: 'published',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
}

async function deleteExamDoc(examId) {
    await db.collection('exams').doc(examId).delete();
}

// ---------- DASHBOARD STATS ----------
async function getAdminStats() {
    var students = await db.collection('users').where('role', '==', 'student').get();
    var teachers = await db.collection('users').where('role', '==', 'instructor').get();
    var courses = await db.collection('courses').get();
    var payments = await db.collection('payments').where('status', '==', 'success').get();

    var revenue = payments.docs.reduce(function(s, d) { return s + (d.data().amount || 0); }, 0);
    return {
        students: students.size,
        teachers: teachers.size,
        courses: courses.size,
        revenue: revenue,
        recentStudents: students.docs
            .map(function(d) { return Object.assign({ uid: d.id }, d.data()); })
            .slice(0, 5)
    };
}

// ---------- CLOUD FUNCTION HELPERS (server-side actions) ----------
async function callFunction(name, payload) {
    var fn = firebase.functions().httpsCallable(name);
    return fn(payload);
}

window.Admin = {
    requireAdmin: requireAdmin, userName: userName,
    getUsersByRole: getUsersByRole, setUserStatus: setUserStatus, setUserRole: setUserRole,
    getUserDetail: getUserDetail, updateAdmissionApplication: updateAdmissionApplication,
    getAllCourses: getAllCourses, setCourseStatus: setCourseStatus,
    deleteCourseDoc: deleteCourseDoc, createCourse: createCourse,
    getPayments: getPayments, setPaymentStatus: setPaymentStatus,
    getAllCertificates: getAllCertificates, setCertificateStatus: setCertificateStatus, generateCertId: generateCertId, createCertificate: createCertificate,
    getExamResults: getExamResults, getExams: getExams, createExam: createExam,
    deleteExamDoc: deleteExamDoc, getAdminStats: getAdminStats, callFunction: callFunction
};

// ---------- CERTIFICATE GENERATION ----------
async function generateCertId(prefix) {
    for (var i = 0; i < 5; i++) {
        var year = new Date().getFullYear();
        var id = (prefix || 'KBOA') + '-' + year + '-' + String(Math.floor(100000 + Math.random() * 900000));
        var dup = await db.collection('certificates').where('certificateId', '==', id).limit(1).get();
        if (dup.empty) return id;
    }
    return (prefix || 'KBOA') + '-' + Date.now();
}

async function createCertificate(data) {
    return callFunction('adminIssueCertificate', {
        resultId: data.resultId || '',
        studentId: data.studentId || '',
        courseId: data.courseId || ''
    });
}

// Bulk: issue certificates to all passing students of an exam (skips existing)
async function bulkGenerateFromExam(examId, prefix, adminUid) {
    var examSnap = await db.collection('exams').doc(examId).get();
    if (!examSnap.exists) return { created: 0, skipped: 0, error: 'Exam not found' };
    var exam = examSnap.data();
    var courseKey = exam.courseId || exam.courseName || '';

    var results = await db.collection('exam_results')
        .where('examId', '==', examId)
        .where('passed', '==', true)
        .get();

    var created = 0, skipped = 0;
    for (var d of results.docs) {
        var r = d.data();
        // Skip if certificate already exists for this student + course
        var existingQuery = db.collection('certificates').where('studentId', '==', r.studentId);
        var existing = await existingQuery.get();
        var hasCert = existing.docs.some(function(c) {
            var cd = c.data();
            return (courseKey && (cd.courseId === courseKey || cd.courseName === courseKey));
        });
        if (hasCert) { skipped++; continue; }

        var userSnap = await db.collection('users').doc(r.studentId).get();
        var studentName = userSnap.exists ? (userSnap.data().fullName || 'Student') : 'Student';

        var certId = await generateCertId(prefix);
        await createCertificate({
            certificateId: certId,
            studentId: r.studentId,
            studentName: studentName,
            courseId: exam.courseId || '',
            courseName: exam.courseName || exam.title,
            score: r.percentage || 0,
            completionDate: (r.submittedAt && r.submittedAt.toDate) ? r.submittedAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            examId: examId,
            issueMethod: 'bulk-exam',
            issuedBy: adminUid
        });
        created++;
    }
    return { created: created, skipped: skipped, total: results.size };
}

Admin.generateCertId = generateCertId;
Admin.createCertificate = createCertificate;
Admin.bulkGenerateFromExam = bulkGenerateFromExam;
