// ============================================
// KBOA - Discussion Forum JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupCategories();
});

// Check authentication
function checkAuth() {
    auth.onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            loadTopics();
        }
    });
}

// Category filtering
function setupCategories() {
    const categories = document.querySelectorAll('.forum-category');

    categories.forEach(cat => {
        cat.addEventListener('click', function() {
            categories.forEach(c => c.classList.remove('active'));
            this.classList.add('active');

            const category = this.getAttribute('data-category');
            filterTopics(category);
        });
    });
}

// Load topics from Firestore
async function loadTopics() {
    try {
        const snapshot = await db.collection('forum_topics')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        if (snapshot.empty) {
            console.log('No topics yet');
            return;
        }

        // Render topics
        snapshot.forEach(function(doc) {
            const topic = doc.data();
            // renderTopic(doc.id, topic);
        });
    } catch (error) {
        console.error('Error loading topics:', error);
    }
}

// Filter topics by category
function filterTopics(category) {
    const topics = document.querySelectorAll('.topic-card');

    topics.forEach(function(topic) {
        if (category === 'all') {
            topic.style.display = 'flex';
        } else {
            const tag = topic.querySelector('.topic-tag').textContent.toLowerCase();
            if (tag.includes(category)) {
                topic.style.display = 'flex';
            } else {
                topic.style.display = 'none';
            }
        }
    });
}

// Vote on topic
function vote(topicId, direction) {
    const card = event.target.closest('.topic-card');
    const countEl = card.querySelector('.vote-count');
    const upBtn = card.querySelector('.vote-btn:not(.downvote)');
    const downBtn = card.querySelector('.vote-btn.downvote');

    let count = parseInt(countEl.textContent);

    if (direction === 1) {
        if (upBtn.classList.contains('active')) {
            upBtn.classList.remove('active');
            count--;
        } else {
            upBtn.classList.add('active');
            downBtn.classList.remove('active');
            count++;
        }
    } else {
        if (downBtn.classList.contains('active')) {
            downBtn.classList.remove('active');
            count++;
        } else {
            downBtn.classList.add('active');
            upBtn.classList.remove('active');
            count--;
        }
    }

    countEl.textContent = count;

    // Save vote to Firestore (in production)
    saveVote(topicId, direction);
}

async function saveVote(topicId, direction) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('forum_votes').doc(`${topicId}_${user.uid}`).set({
            topicId: topicId,
            userId: user.uid,
            vote: direction,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving vote:', error);
    }
}

// Open topic detail
function openTopic(topicId) {
    document.getElementById('forum-list-view').style.display = 'none';
    document.getElementById('topic-detail-view').style.display = 'block';

    // In production: load topic details and replies from Firestore
    loadTopicDetail(topicId);

    window.scrollTo(0, 0);
}

async function loadTopicDetail(topicId) {
    try {
        const doc = await db.collection('forum_topics').doc(topicId).get();
        if (doc.exists) {
            const topic = doc.data();
            // Render topic detail
            console.log('Loaded topic:', topic.title);
        }

        // Load replies
        const repliesSnapshot = await db.collection('forum_replies')
            .where('topicId', '==', topicId)
            .orderBy('createdAt', 'asc')
            .get();

        // Render replies
    } catch (error) {
        console.error('Error loading topic:', error);
    }
}

// Back to forum
function backToForum() {
    document.getElementById('forum-list-view').style.display = 'block';
    document.getElementById('topic-detail-view').style.display = 'none';
}

// New Topic Modal
function showNewTopicModal() {
    document.getElementById('new-topic-modal').classList.add('show');
}

function closeNewTopicModal() {
    document.getElementById('new-topic-modal').classList.remove('show');
    document.getElementById('new-topic-title').value = '';
    document.getElementById('new-topic-body').value = '';
}

// Create new topic
async function createTopic() {
    const title = document.getElementById('new-topic-title').value.trim();
    const body = document.getElementById('new-topic-body').value.trim();
    const category = document.getElementById('new-topic-category').value;

    if (!title || !body) {
        alert('Please fill in both title and details');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('Please login to create a topic');
        return;
    }

    try {
        // Get user data
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userName = userDoc.data()?.fullName || user.displayName || 'Anonymous';

        await db.collection('forum_topics').add({
            title: title,
            body: body,
            category: category,
            authorId: user.uid,
            authorName: userName,
            upvotes: 0,
            replyCount: 0,
            viewCount: 0,
            isAnswered: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });

        closeNewTopicModal();
        alert('Topic created successfully!');

        // Reload topics
        loadTopics();
    } catch (error) {
        console.error('Error creating topic:', error);
        alert('Error creating topic. Please try again.');
    }
}

// Submit reply
async function submitReply() {
    const text = document.getElementById('reply-text').value.trim();

    if (!text) {
        alert('Please write a reply first');
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userName = userDoc.data()?.fullName || user.displayName || 'Anonymous';

        await db.collection('forum_replies').add({
            topicId: 'current-topic-id', // Get from state
            authorId: user.uid,
            authorName: userName,
            content: text,
            upvotes: 0,
            isAccepted: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('reply-text').value = '';

        // Add reply to UI (optimistic update)
        appendReplyToUI(userName, text);

        // Update topic reply count
        // await db.collection('forum_topics').doc(topicId).update({
        //     replyCount: firebase.firestore.FieldValue.increment(1)
        // });

    } catch (error) {
        console.error('Error submitting reply:', error);
        alert('Error posting reply. Please try again.');
    }
}

function appendReplyToUI(authorName, text) {
    const postsContainer = document.querySelector('.topic-detail');
    const initials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const replyDiv = document.createElement('div');
    replyDiv.className = 'post';
    replyDiv.innerHTML = `
        <div class="post-avatar" style="background: #8b5cf6;">${initials}</div>
        <div class="post-body">
            <div class="post-header">
                <span class="post-author">${escapeHtml(authorName)}</span>
                <span class="post-time">Just now</span>
            </div>
            <div class="post-content">
                <p>${escapeHtml(text)}</p>
            </div>
            <div class="post-actions">
                <button class="post-action">👍 Helpful (0)</button>
            </div>
        </div>
    `;

    postsContainer.appendChild(replyDiv);
    replyDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Like post
function likePost(btn) {
    btn.classList.toggle('liked');

    const match = btn.textContent.match(/\((\d+)\)/);
    if (match) {
        let count = parseInt(match[1]);
        if (btn.classList.contains('liked')) {
            count++;
        } else {
            count--;
        }
        btn.textContent = `👍 Helpful (${count})`;
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on overlay click
document.getElementById('new-topic-modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeNewTopicModal();
    }
});

// Make functions global
window.vote = vote;
window.openTopic = openTopic;
window.backToForum = backToForum;
window.showNewTopicModal = showNewTopicModal;
window.closeNewTopicModal = closeNewTopicModal;
window.createTopic = createTopic;
window.submitReply = submitReply;
window.likePost = likePost;
