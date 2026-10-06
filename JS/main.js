// ============================================
// KBOA — Main (Production)
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu
    var navToggle = document.getElementById('nav-toggle');
    var navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('show-menu');
            navToggle.classList.toggle('active');
        });
        navMenu.querySelectorAll('.nav__link').forEach(function(link) {
            link.addEventListener('click', function() {
                navMenu.classList.remove('show-menu');
                navToggle.classList.remove('active');
            });
        });
    }

    // Header scroll effect
    var header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', function() {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // Stats counter animation
    var statNumbers = document.querySelectorAll('.stat__number');
    if (statNumbers.length > 0) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var counter = entry.target;
                    animateCounter(counter, parseInt(counter.getAttribute('data-count'), 10));
                    observer.unobserve(counter);
                }
            });
        }, { threshold: 0.5 });
        statNumbers.forEach(function(c) { observer.observe(c); });
    }

    // Featured courses from Firestore
    loadFeaturedCourses();

    // Live stat numbers from Firestore
    loadLiveStats();
});

function animateCounter(element, target) {
    if (!target) return;
    var current = 0;
    var increment = target / 50;
    var timer = setInterval(function() {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString() + (target === 95 ? '%' : '+');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 30);
}

// Real stats: students, courses, instructors
async function loadLiveStats() {
    try {
        var studentsSnap = await db.collection('users').where('role', '==', 'student').get();
        var coursesSnap = await db.collection('courses').where('status', '==', 'published').get();
        var instructorsSnap = await db.collection('users').where('role', '==', 'instructor').get();

        setStat('students-stat', studentsSnap.size);
        setStat('courses-stat', coursesSnap.size);
        setStat('instructors-stat', instructorsSnap.size);
    } catch (e) { /* stats stay as configured */ }
}

function setStat(id, value) {
    var el = document.querySelector('[data-stat="' + id + '"]');
    if (el) el.textContent = value.toLocaleString() + '+';
}

// Featured courses — newest 3 published from Firestore
async function loadFeaturedCourses() {
    var container = document.getElementById('featured-courses');
    if (!container) return;

    try {
        var courses = await KBOA.getPublishedCourses();
        container.innerHTML = '';

        if (courses.length === 0) {
            container.innerHTML = KBOA.emptyState('📚', 'Courses Coming Soon',
                'Our instructors are preparing amazing content. Check back shortly.');
            return;
        }

        courses.slice(0, 3).forEach(function(course) {
            container.appendChild(createFeaturedCard(course));
        });
    } catch (error) {
        console.error('Featured courses error:', error);
        container.innerHTML = KBOA.errorState('Could not load courses right now.');
    }
}

function createFeaturedCard(course) {
    var card = document.createElement('div');
    card.className = 'course__card animate-fadeIn';

    var priceHtml = course.price > 0
        ? '₦' + Number(course.price).toLocaleString()
        : '<span style="color:#059669;font-weight:700;">FREE</span>';

    card.innerHTML =
        '<div class="course__img">'
        + '<img src="' + (course.image || 'assets/images/course-default.jpg') + '" alt="" loading="lazy">'
        + (course.badge ? '<span class="course__badge">' + course.badge + '</span>' : '')
        + '</div>'
        + '<div class="course__content">'
        + '<span class="course__category">' + (course.category || '') + '</span>'
        + '<h3 class="course__title">' + (course.title || '') + '</h3>'
        + '<div class="course__instructor"><span>👨‍🏫 ' + (course.instructor || 'KBOA') + '</span></div>'
        + '<div class="course__meta">'
        + '<span>📊 ' + (course.level || 'All Levels') + '</span>'
        + '<span>⏱️ ' + (course.duration || '') + '</span>'
        + '</div>'
        + '<div class="course__footer">'
        + '<div class="course__price">' + priceHtml + '</div>'
        + '<a href="course-details.html?id=' + course.id + '" class="btn btn-primary btn-sm">Enroll Now</a>'
        + '</div></div>';
    return card;
}

// Auth state → nav buttons
auth.onAuthStateChanged(function(user) {
    if (user) {
        var navAuth = document.querySelector('.nav__auth');
        if (navAuth) {
            navAuth.innerHTML =
                '<a href="dashboard.html" class="btn btn-outline">Dashboard</a>'
                + '<button onclick="logout()" class="btn btn-primary">Logout</button>';
        }
    }
});

function logout() {
    auth.signOut().then(function() { window.location.href = 'index.html'; });
}
