// ============================================
// KBOA — Instructor Data Layer (Production)
// ============================================

async function requireInstructor() {
    return new Promise(function(resolve, reject) {
        auth.onAuthStateChanged(async function(user) {
            if (!user) { window.location.href = '../login.html'; return reject(); }
            var doc = await db.collection('users').doc(user.uid).get();
            var profile = doc.exists ? doc.data() : {};
            var role = profile.role || null;
            var status = profile.status || 'active';
            if (status !== 'active') {
                alert(status === 'pending' ? '⏳ Your instructor account is awaiting admin approval.' : '⛔ Your instructor account is not active. Contact KBOA support.');
                await auth.signOut();
                window.location.href = '../login.html';
                return reject();
            }
            if (role !== 'instructor' && role !== 'admin') {
                alert('⛔ Instructors only.');
                window.location.href = '../dashboard.html';
                return reject();
            }
            resolve(user);
        });
    });
}

var _cache = {};
async function studentInfo(uid) {
    if (_cache[uid]) return _cache[uid];
    var d = await db.collection('users').doc(uid).get();
    var u = d.exists ? d.data() : {};
    _cache[uid] = u;
    return u;
}

async function getDashboardSummary(uid) {
    if (!firebase.functions) throw new Error('Firebase Functions is not available.');
    var result = await firebase.functions().httpsCallable('getInstructorDashboard')({ instructorId: uid });
    return result.data || { courseCount: 0, enrollmentCount: 0, assignmentCount: 0 };
}

async function getMyCourses(uid) {
    var snap = await db.collection('courses').where('instructorId', '==', uid)
        .orderBy('createdAt', 'desc').get();
    var courses = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    for (var c of courses) {
        var en = await db.collection('enrollments').where('courseId', '==', c.id).get();
        c.studentCount = en.size;
    }
    return courses;
}

async function saveCourse(data, courseId) {
    if (courseId) {
        await db.collection('courses').doc(courseId).update(data);
        return courseId;
    }
    var ref = await db.collection('courses').add(Object.assign({}, data, {
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
    return ref.id;
}

async function removeCourse(id) {
    await db.collection('courses').doc(id).delete();
}

async function getMyStudents(courseIds) {
    var students = {};
    for (var cid of courseIds) {
        var en = await db.collection('enrollments').where('courseId', '==', cid).get();
        for (var d of en.docs) {
            var sid = d.data().studentId;
            if (!students[sid]) {
                var u = await studentInfo(sid);
                students[sid] = { uid: sid, name: u.fullName || 'Student', email: u.email, courses: [] };
            }
            students[sid].courses.push({ courseId: cid, progress: d.data().progress || 0 });
        }
    }
    return Object.values(students);
}

async function getAssignmentsForCourses(courseIds) {
    var out = [];
    for (var cid of courseIds) {
        var snap = await db.collection('assignments').where('courseId', '==', cid).get();
        for (var d of snap.docs) {
            var a = Object.assign({ id: d.id }, d.data());
            var subs = await db.collection('submissions').where('assignmentId', '==', a.id).get();
            a.submissionCount = subs.size;
            a.pendingGrading = subs.docs.filter(function(s){ return (s.data().status||'submitted') === 'submitted'; }).size;
            out.push(a);
        }
    }
    return out.sort(function(a,b){ return (b.createdAt&&b.createdAt.seconds||0) - (a.createdAt&&a.createdAt.seconds||0); });
}

async function createAssignment(data) {
    return db.collection('assignments').add(Object.assign({}, data, {
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
}

async function getSubmissions(assignmentId) {
    var snap = await db.collection('submissions').where('assignmentId', '==', assignmentId).get();
    var out = [];
    for (var d of snap.docs) {
        var s = Object.assign({ id: d.id }, d.data());
        var u = await studentInfo(s.studentId);
        s.studentName = u.fullName || 'Student';
        out.push(s);
    }
    return out;
}

async function saveGrade(data) {
    await db.collection('grades').add(Object.assign({}, data, {
        gradedAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
    await db.collection('submissions').doc(data.submissionId).update({ status: 'graded' });
}

async function getQuizzesForCourses(courseIds) {
    var snap = await db.collection('exams').where('type', '==', 'quiz').get();
    return snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); })
        .filter(function(q){ return courseIds.indexOf(q.courseId) !== -1 || !q.courseId; })
        .sort(function(a,b){ return (b.createdAt&&b.createdAt.seconds||0)-(a.createdAt&&a.createdAt.seconds||0); });
}

async function createQuiz(data) {
    return db.collection('exams').add(Object.assign({}, data, {
        type: 'quiz', status: 'published',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }));
}

async function getResultsForCourses(courseIds) {
    var snap = await db.collection('exam_results').orderBy('submittedAt', 'desc').limit(150).get();
    var out = [];
    for (var d of snap.docs) {
        var r = Object.assign({ id: d.id }, d.data());
        if (courseIds.indexOf(r.courseId) !== -1) {
            var u = await studentInfo(r.studentId);
            r.studentName = u.fullName || 'Student';
            out.push(r);
        }
    }
    return out;
}

async function getEarnings(courseIds) {
    var snap = await db.collection('payments').where('status', '==', 'success').get();
    var byCourse = {}, total = 0;
    snap.docs.forEach(function(d) {
        var p = d.data();
        if (courseIds.indexOf(p.courseId) !== -1) {
            total += (p.amount || 0);
            byCourse[p.courseId] = (byCourse[p.courseId] || 0) + (p.amount || 0);
        }
    });
    var payoutsSnap = await db.collection('payouts').get();
    var paidOut = payoutsSnap.docs.reduce(function(s, d){ return s + (d.data().amount||0); }, 0);
    return { gross: total, fees: Math.round(total*0.10), net: Math.round(total*0.90), byCourse: byCourse, paidOut: paidOut, available: Math.max(0, Math.round(total*0.90) - paidOut) };
}

async function getGradedSubmissions(courseIds) {
    var snap = await db.collection('grades').orderBy('gradedAt', 'desc').limit(100).get();
    var out = [];
    for (var d of snap.docs) {
        var g = Object.assign({ id: d.id }, d.data());
        if (courseIds.indexOf(g.courseId) !== -1) {
            var u = await studentInfo(g.studentId);
            g.studentName = u.fullName || 'Student';
            out.push(g);
        }
    }
    return out;
}

window.Instr = {
    requireInstructor: requireInstructor, studentInfo: studentInfo,
    getMyCourses: getMyCourses, getDashboardSummary: getDashboardSummary, saveCourse: saveCourse, removeCourse: removeCourse,
    getMyStudents: getMyStudents,
    getAssignmentsForCourses: getAssignmentsForCourses, createAssignment: createAssignment,
    getSubmissions: getSubmissions, saveGrade: saveGrade,
    getQuizzesForCourses: getQuizzesForCourses, createQuiz: createQuiz,
    getResultsForCourses: getResultsForCourses, getEarnings: getEarnings,
    getGradedSubmissions: getGradedSubmissions
};
