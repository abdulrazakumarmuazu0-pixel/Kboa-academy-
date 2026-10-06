// ============================================
// KBOA — Student Dashboard (Production)
// All data from Firestore. No sample numbers.
// ============================================

var currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var toggle = document.getElementById('menu-toggle');
    var closeBtn = document.getElementById('sidebar-close');

    if (toggle) toggle.addEventListener('click', function() { sidebar.classList.add('show'); overlay.classList.add('show'); });
    if (closeBtn) closeBtn.addEventListener('click', function() { sidebar.classList.remove('show'); overlay.classList.remove('show'); });
    if (overlay) overlay.addEventListener('click', function() { sidebar.classList.remove('show'); overlay.classList.remove('show'); });

    // User dropdown
    var userBtn = document.getElementById('user-btn');
    var userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        document.addEventListener('click', function() { userDropdown.classList.remove('show'); });
    }

    // Auth gate
    auth.onAuthStateChanged(async function(user) {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        try {
            var access = await firebase.functions().httpsCallable('getStudentPortalAccess')({});
            if (!access.data || !access.data.allowed) {
                alert('Student Dashboard access requires a verified course payment.');
                window.location.href = 'courses.html';
                return;
            }
            currentUser = user;
            loadDashboard(user);
        } catch (e) {
            console.error('Portal access check failed:', e);
            await auth.signOut();
            window.location.href = 'login.html';
        }
    });
});

async function loadDashboard(user) {
    try {
        // User profile
        var userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            var u = userDoc.data();
            setText('student-name', u.fullName || 'Student');
            setText('user-name', u.fullName || 'Student');
            var avatar = document.getElementById('user-avatar');
            if (avatar) avatar.textContent = (u.fullName || 'S').charAt(0).toUpperCase();
        }

        // Enrollments + course data (parallel with certificates & assignments)
        var enrollments, certs, pendingCount;
        try {
            var results = await Promise.all([
                KBOA.getMyEnrollments(user.uid),
                KBOA.getMyCertificates(user.uid),
                KBOA.getPendingAssignments(user.uid)
            ]);
            enrollments = results[0];
            certs = results[1];
            pendingCount = results[2];
        } catch (e) {
            enrollments = await KBOA.getMyEnrollments(user.uid);
            certs = [];
            pendingCount = 0;
        }

        renderStats(enrollments, certs, pendingCount);
        renderMyCourses(enrollments);

    } catch (error) {
        console.error('Dashboard error:', error);
        var container = document.getElementById('my-courses');
        if (container) container.innerHTML = KBOA.errorState('Could not load your data. Please refresh.');
    }
}

function renderStats(enrollments, certs, pendingAssignments) {
    var completed = enrollments.filter(function(e) { return e.completedAt; }).length;
    setText('enrolled-count', enrollments.length);
    setText('completed-count', completed);
    setText('assignments-count', pendingAssignments);
    setText('certificates-count', certs.length);
}

function renderMyCourses(enrollments) {
    var container = document.getElementById('my-courses');
    if (!container) return;

    if (enrollments.length === 0) {
        container.innerHTML = KBOA.emptyState('📚', 'No Courses Yet',
            'Browse our catalog and enroll in your first course.',
            '<a href="courses.html" class="btn btn-primary">Browse Courses</a>');
        return;
    }

    container.innerHTML = '';
    enrollments.forEach(function(en) {
        var card = document.createElement('div');
        card.className = 'my-course-card';
        card.innerHTML =
            '<a href="course-learning.html?id=' + en.course.id + '" style="display:block;">'
            + '<div class="my-course-img"><img src="' + (en.course.image || 'assets/images/course-default.jpg') + '" alt="" loading="lazy"></div>'
            + '<div class="my-course-content">'
            + '<h4 class="my-course-title">' + (en.course.title || '') + '</h4>'
            + '<p class="my-course-instructor">' + (en.course.instructor || '') + '</p>'
            + '<div class="progress-bar"><div class="progress-fill" style="width:' + en.progress + '%"></div></div>'
            + '<div class="progress-text"><span>Progress</span><span>' + en.progress + '%</span></div>'
            + '</div></a>';
        container.appendChild(card);
    });
}

function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
}

function logout() {
    auth.signOut().then(function() {
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    });
}
