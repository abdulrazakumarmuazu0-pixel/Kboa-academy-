// ============================================
// KBOA — Course Learning (Production)
// Course, modules & lessons loaded from Firestore.
// Progress saved to the student's enrollment doc.
// ============================================

var courseData = null;      // course doc from Firestore
var enrollment = null;      // student's enrollment doc
var completedLessons = [];  // lesson ids
var currentModuleIndex = 0;
var currentLessonIndex = 0;

document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged(function(user) {
        if (!user) { window.location.href = 'login.html'; return; }

        var courseId = new URLSearchParams(window.location.search).get('id');
        if (!courseId) { window.location.href = 'my-courses.html'; return; }

        initializeCourse(user.uid, courseId);
    });

    setupEventListeners();
});

async function initializeCourse(studentId, courseId) {
    try {
        // Load course + enrollment in parallel
        var results = await Promise.all([
            KBOA.getCourse(courseId),
            KBOA.getEnrollment(studentId, courseId)
        ]);

        courseData = results[0];
        enrollment = results[1];

        if (!courseData) {
            document.querySelector('.content-area').innerHTML =
                KBOA.errorState('Course not found. <a href="my-courses.html" style="color:var(--primary);">Back to My Courses</a>');
            return;
        }

        if (!enrollment) {
            // Not enrolled — send to course details to pay/enroll first
            window.location.href = 'course-details.html?id=' + courseId;
            return;
        }

        completedLessons = enrollment.data.completedLessons || [];
        renderModulesList();
        loadLesson(0, 0);
        updateProgressUI();

    } catch (error) {
        console.error('Course load error:', error);
        document.querySelector('.content-area').innerHTML =
            KBOA.errorState('Could not load this course. Please try again.');
    }
}

function setupEventListeners() {
    var menuBtn = document.getElementById('menu-btn');
    var closeSidebar = document.getElementById('close-sidebar');
    var sidebar = document.getElementById('course-sidebar');
    var overlay = document.getElementById('sidebar-overlay');

    if (menuBtn) menuBtn.addEventListener('click', function() { sidebar.classList.add('open'); overlay.classList.add('show'); });
    if (closeSidebar) closeSidebar.addEventListener('click', function() { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
    if (overlay) overlay.addEventListener('click', function() { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

    var video = document.getElementById('lesson-video');
    if (video) video.addEventListener('ended', markAsComplete);
}

// ---------- Render sidebar ----------
function renderModulesList() {
    var container = document.getElementById('modules-list');
    var title = document.getElementById('course-title');
    if (title) title.textContent = courseData.title || 'Course';
    if (!container) return;

    container.innerHTML = '';
    var modules = courseData.modules || [];

    modules.forEach(function(module, mIdx) {
        var moduleDiv = document.createElement('div');
        moduleDiv.className = 'module-item' + (mIdx === 0 ? ' expanded' : '');

        var lessonsHtml = '';
        (module.lessons || []).forEach(function(lesson, lIdx) {
            var isDone = completedLessons.indexOf(lesson.id) !== -1;
            var isActive = (mIdx === currentModuleIndex && lIdx === currentLessonIndex);
            var icons = { video: '🎥', pdf: '📄', quiz: '📝', assignment: '📋' };

            lessonsHtml += '<div class="lesson-item ' + (isActive ? 'active ' : '') + (isDone ? 'completed' : '') + '"'
                + ' onclick="loadLesson(' + mIdx + ',' + lIdx + ')">'
                + '<span class="lesson-icon">' + (isDone ? '✅' : (icons[lesson.type] || '🎥')) + '</span>'
                + '<span class="lesson-title">' + (lesson.title || '') + '</span>'
                + '<span class="lesson-duration">' + (lesson.duration || '') + '</span></div>';
        });

        moduleDiv.innerHTML =
            '<div class="module-header" onclick="toggleModule(' + mIdx + ')">'
            + '<span class="module-title">' + (module.title || ('Module ' + (mIdx + 1))) + '</span>'
            + '<span class="module-toggle">▼</span></div>'
            + '<div class="lessons-list">' + lessonsHtml + '</div>';

        container.appendChild(moduleDiv);
    });
}

function toggleModule(mIdx) {
    var items = document.querySelectorAll('.module-item');
    if (items[mIdx]) items[mIdx].classList.toggle('expanded');
}

// ---------- Load lesson ----------
function loadLesson(mIdx, lIdx) {
    var modules = courseData.modules || [];
    if (!modules[mIdx] || !modules[mIdx].lessons[lIdx]) return;

    currentModuleIndex = mIdx;
    currentLessonIndex = lIdx;
    var module = modules[mIdx];
    var lesson = module.lessons[lIdx];

    setText('lesson-title', lesson.title || 'Lesson');
    var meta = document.querySelector('.lesson-meta');
    if (meta) {
        meta.innerHTML = '<span>📊 Module ' + (mIdx + 1) + ', Lesson ' + (lIdx + 1) + '</span>'
            + '<span>⏱️ ' + (lesson.duration || '') + '</span>'
            + (lesson.pdfUrl ? '<span>📄 PDF Available</span>' : '');
    }
    var body = document.getElementById('lesson-body');
    if (body) body.innerHTML = lesson.content || '<p>No content for this lesson yet.</p>';

    var videoC = document.getElementById('video-container');
    var pdfC = document.getElementById('pdf-viewer');
    var quizC = document.getElementById('quiz-container');
    if (videoC) videoC.style.display = 'none';
    if (pdfC) pdfC.style.display = 'none';
    if (quizC) quizC.style.display = 'none';

    if (lesson.type === 'video' && lesson.videoUrl) {
        if (videoC) {
            videoC.style.display = 'block';
            var v = document.getElementById('lesson-video');
            if (v) { v.src = lesson.videoUrl; v.poster = lesson.poster || ''; v.load(); }
        }
    } else if (lesson.type === 'pdf' && lesson.pdfUrl) {
        if (pdfC) { pdfC.style.display = 'block'; document.getElementById('pdf-iframe').src = lesson.pdfUrl; }
    } else if (lesson.type === 'quiz') {
        if (quizC) {
            quizC.style.display = 'block';
            document.getElementById('quiz-content').innerHTML =
                '<p style="margin-bottom:20px;color:var(--gray-600);">This quiz contains ' + (lesson.questions || 10) + ' questions. You need 70% to pass.</p>'
                + '<a href="exam.html?courseId=' + courseData.id + '" class="btn btn-primary btn-lg">Start Quiz</a>';
        }
    }

    updateNavButtons();
    renderModulesList();
    closeSidebarMobile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSidebarMobile() {
    if (window.innerWidth < 1024) {
        var s = document.getElementById('course-sidebar');
        var o = document.getElementById('sidebar-overlay');
        if (s) s.classList.remove('open');
        if (o) o.classList.remove('show');
    }
}

function updateNavButtons() {
    var modules = courseData.modules || [];
    var totalM = modules.length;
    var totalL = totalM ? modules[totalM - 1].lessons.length : 0;

    var prevBtn = document.getElementById('prev-lesson-btn');
    var nextBtn = document.getElementById('next-lesson-btn');
    var completeBtn = document.getElementById('complete-btn');
    if (prevBtn) prevBtn.disabled = (currentModuleIndex === 0 && currentLessonIndex === 0);
    if (nextBtn) nextBtn.textContent = (currentModuleIndex === totalM - 1 && currentLessonIndex === totalL - 1)
        ? 'Finish Course 🎓' : 'Next Lesson →';

    var lesson = modules[currentModuleIndex].lessons[currentLessonIndex];
    var isDone = completedLessons.indexOf(lesson.id) !== -1;
    if (completeBtn) {
        completeBtn.textContent = isDone ? '✓ Completed' : '✓ Mark as Complete';
        completeBtn.disabled = isDone;
    }
}

// ---------- Navigation ----------
function previousLesson() {
    if (currentLessonIndex > 0) loadLesson(currentModuleIndex, currentLessonIndex - 1);
    else if (currentModuleIndex > 0) {
        var prevModule = courseData.modules[currentModuleIndex - 1];
        loadLesson(currentModuleIndex - 1, prevModule.lessons.length - 1);
    }
}

function nextLesson() {
    var modules = courseData.modules;
    var curModule = modules[currentModuleIndex];
    if (currentLessonIndex < curModule.lessons.length - 1) loadLesson(currentModuleIndex, currentLessonIndex + 1);
    else if (currentModuleIndex < modules.length - 1) loadLesson(currentModuleIndex + 1, 0);
    else {
        if (confirm('You have completed all lessons! Take the final exam now?')) {
            window.location.href = 'exam.html?courseId=' + courseData.id;
        }
    }
}

// ---------- Progress ----------
function markAsComplete() {
    var lesson = courseData.modules[currentModuleIndex].lessons[currentLessonIndex];
    if (completedLessons.indexOf(lesson.id) !== -1) return;

    completedLessons.push(lesson.id);
    var progress = calculateProgress();

    // Save to Firestore
    KBOA.updateLessonProgress(enrollment.id, completedLessons, progress).catch(function(e) {
        console.error('Progress save failed:', e);
    });

    updateProgressUI();
    renderModulesList();
    updateNavButtons();
    showToast('✅ Lesson completed!');
}

function calculateProgress() {
    var total = 0;
    (courseData.modules || []).forEach(function(m) { total += (m.lessons || []).length; });
    if (total === 0) return 0;
    return Math.round((completedLessons.length / total) * 100);
}

function updateProgressUI() {
    var progress = calculateProgress();
    setText('progress-percentage', progress + '%');
    var bar = document.getElementById('course-progress');
    if (bar) bar.style.width = progress + '%';

    if (progress === 100 && enrollment && !enrollment.data.completedAt) {
        KBOA.markCourseCompleted(enrollment.id).catch(function() {});
        var badge = document.getElementById('completion-badge');
        if (badge) badge.style.display = 'inline-flex';
    }
}

function showToast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:14px 24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:9999;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 2800);
}

function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

// Globals for HTML onclick
window.loadLesson = loadLesson;
window.toggleModule = toggleModule;
window.previousLesson = previousLesson;
window.nextLesson = nextLesson;
window.markAsComplete = markAsComplete;
