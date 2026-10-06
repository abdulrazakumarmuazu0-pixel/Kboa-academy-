// ============================================
// KBOA — Courses (Production)
// Loads published courses from Firestore.
// ============================================

let allCourses = [];

document.addEventListener('DOMContentLoaded', function() {
    loadCourses();

    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            renderCourses(allCourses, this.getAttribute('data-category'));
        });
    });

    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var q = this.value.toLowerCase();
            var filtered = allCourses.filter(function(c) {
                return (c.title || '').toLowerCase().includes(q) ||
                       (c.instructor || '').toLowerCase().includes(q);
            });
            renderCourses(filtered, 'all', true);
        });
    }
});

async function loadCourses() {
    var grid = document.getElementById('courses-grid');
    if (!grid) return;

    try {
        allCourses = await KBOA.getPublishedCourses();
        renderCourses(allCourses, 'all', true);
    } catch (error) {
        console.error('Course load error:', error);
        grid.innerHTML = KBOA.errorState('Could not load courses. Please check your connection and refresh.');
    }
}

function renderCourses(courses, category, skipFilter) {
    var grid = document.getElementById('courses-grid');
    if (!grid) return;

    var list = skipFilter ? courses : (category === 'all' ? allCourses : allCourses.filter(function(c) { return c.category === category; }));

    if (list.length === 0) {
        grid.innerHTML = KBOA.emptyState('📚', 'No Courses Found',
            category === 'all' ? 'New courses are coming soon. Please check back later.' : 'No courses in this category yet.');
        return;
    }

    grid.innerHTML = '';
    list.forEach(function(course) {
        grid.appendChild(createCourseCard(course));
    });
}

function createCourseCard(course) {
    var card = document.createElement('div');
    card.className = 'course__card animate-fadeIn';

    var priceHtml = course.price > 0
        ? '₦' + Number(course.price).toLocaleString()
        : '<span style="color:#059669;font-weight:700;">FREE</span>';
    var oldPriceHtml = (course.oldPrice && course.oldPrice > course.price)
        ? '<span class="old-price">₦' + Number(course.oldPrice).toLocaleString() + '</span>'
        : '';
    var badgeHtml = course.badge ? '<span class="course__badge">' + course.badge + '</span>' : '';

    card.innerHTML =
        '<div class="course__img">'
        + '<img src="' + (course.image || 'assets/images/course-default.jpg') + '" alt="' + escapeHtml(course.title) + '" loading="lazy">'
        + badgeHtml
        + '</div>'
        + '<div class="course__content">'
        + '<span class="course__category">' + getCategoryName(course.category) + '</span>'
        + '<h3 class="course__title">' + escapeHtml(course.title) + '</h3>'
        + '<div class="course__instructor"><span>👨‍🏫 ' + escapeHtml(course.instructor || 'KBOA Instructor') + '</span></div>'
        + '<div class="course__meta">'
        + '<span>📊 ' + escapeHtml(course.level || 'All Levels') + '</span>'
        + '<span>⏱️ ' + escapeHtml(course.duration || 'Self-paced') + '</span>'
        + '</div>'
        + '<div class="course__footer">'
        + '<div class="course__price">' + priceHtml + oldPriceHtml + '</div>'
        + '<a href="course-details.html?id=' + course.id + '" class="btn btn-primary btn-sm">' + (course.price > 0 ? 'Enroll Now' : 'Start Free') + '</a>'
        + '</div></div>';
    return card;
}

function getCategoryName(category) {
    var map = { academic: 'Academic', digital: 'Digital Skills', business: 'Business', tech: 'AI & Tech' };
    return map[category] || (category || 'Course');
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}
