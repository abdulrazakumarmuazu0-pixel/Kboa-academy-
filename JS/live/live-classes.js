// ============================================
// KBOA - Live Classes JavaScript
// ============================================

// State
let micOn = true;
let camOn = true;
let currentClass = null;

document.addEventListener('DOMContentLoaded', function() {
    setupTabs();
    setupChat();
    checkAuth();
});

// Check authentication
function checkAuth() {
    auth.onAuthStateChanged(function(user) {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            loadLiveClasses();
        }
    });
}

// Load live classes from Firestore
async function loadLiveClasses() {
    try {
        const now = new Date();
        const snapshot = await db.collection('live_classes')
            .where('startTime', '>=', now)
            .orderBy('startTime', 'asc')
            .limit(10)
            .get();

        if (!snapshot.empty) {
            // Render upcoming classes
            console.log('Loaded', snapshot.size, 'upcoming classes');
        }
    } catch (error) {
        console.error('Error loading live classes:', error);
    }
}

// Tab Switching
function setupTabs() {
    const tabs = document.querySelectorAll('.live-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active from all
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Hide all tab content
            document.querySelectorAll('.live-tab-content').forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab
            const tabName = this.getAttribute('data-tab');
            document.getElementById('tab-' + tabName).style.display = 'block';
        });
    });
}

// Classroom Controls
function toggleMic() {
    micOn = !micOn;
    const btn = document.getElementById('mic-btn');
    btn.classList.toggle('mic-off', !micOn);
    btn.textContent = micOn ? '🎤' : '🔇';

    // In production: toggle actual media track
    console.log('Microphone:', micOn ? 'on' : 'off');
}

function toggleCam() {
    camOn = !camOn;
    const btn = document.getElementById('cam-btn');
    btn.classList.toggle('cam-off', !camOn);
    btn.textContent = camOn ? '📹' : '🚫';

    console.log('Camera:', camOn ? 'on' : 'off');
}

function joinClass() {
    // In production: initialize WebRTC (Daily.co / Jitsi / Zoom SDK)
    alert('Joining class with video...\n\nIn production, this connects to: Jitsi Meet / Daily.co / Zoom SDK');

    const videoArea = document.querySelector('.classroom-video');
    videoArea.innerHTML = `
        <div style="font-size: 4rem;">🧑‍🎓</div>
        <p>You are in the class!</p>
        <p style="font-size: 0.9rem; opacity: 0.7;">Waiting for instructor to admit you...</p>
    `;
}

function shareScreen() {
    alert('Screen sharing would start here (getDisplayMedia API)');
}

function raiseHand() {
    const messages = document.getElementById('chat-messages');
    const handMsg = document.createElement('div');
    handMsg.className = 'chat-message';
    handMsg.innerHTML = `
        <div class="chat-message-header">
            <div class="chat-avatar" style="background: #8b5cf6;">YOU</div>
            <span class="chat-sender">You</span>
            <span class="chat-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="chat-text">✋ Raised hand</div>
    `;
    messages.appendChild(handMsg);
    messages.scrollTop = messages.scrollHeight;
}

function leaveClass() {
    if (confirm('Leave this class?')) {
        const videoArea = document.querySelector('.classroom-video');
        videoArea.innerHTML = `
            <div style="font-size: 4rem;">👋</div>
            <p>You left the class</p>
            <button class="btn btn-white" onclick="location.reload()">Rejoin</button>
        `;
    }
}

// Chat
function setupChat() {
    const input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text) return;

    const messages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.innerHTML = `
        <div class="chat-message-header">
            <div class="chat-avatar" style="background: #8b5cf6;">YOU</div>
            <span class="chat-sender">You</span>
            <span class="chat-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="chat-text">${escapeHtml(text)}</div>
    `;

    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
    input.value = '';

    // Save to Firestore (in production)
    saveChatMessage(text);
}

async function saveChatMessage(text) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await db.collection('live_chat').add({
            classId: 'current-class-id',
            userId: user.uid,
            message: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving message:', error);
    }
}

function switchToParticipants() {
    const panel = document.querySelector('.chat-panel');
    panel.innerHTML = `
        <div class="chat-header">
            <span>👥 Participants (45)</span>
            <button class="btn btn-sm btn-outline" onclick="switchToChat()">💬 Chat</button>
        </div>
        <div class="participants-list" style="flex: 1; overflow-y: auto;">
            <div class="participant-item">
                <div class="participant-avatar" style="background: var(--primary-color); color: white;">AB</div>
                <div class="participant-info">
                    <div class="participant-name">Ahmad Bello</div>
                    <div class="participant-role">Instructor</div>
                </div>
                <div class="participant-status">
                    <span class="status-icon">🎤</span>
                    <span class="status-icon">📹</span>
                </div>
            </div>
            <div class="participant-item">
                <div class="participant-avatar">FM</div>
                <div class="participant-info">
                    <div class="participant-name">Fatima Muhammad</div>
                    <div class="participant-role">Student</div>
                </div>
                <div class="participant-status">
                    <span class="status-icon">🎤</span>
                </div>
            </div>
            <div class="participant-item">
                <div class="participant-avatar">MS</div>
                <div class="participant-info">
                    <div class="participant-name">Musa Sani</div>
                    <div class="participant-role">Student</div>
                </div>
                <div class="participant-status">
                    <span style="font-size: 0.8rem; color: var(--gray-400);">muted</span>
                </div>
            </div>
        </div>
    `;
}

function switchToChat() {
    location.reload();
}

// Calendar navigation
function prevMonth() {
    alert('Previous month');
}

function nextMonth() {
    alert('Next month');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Live class creation (for instructors) — stored in Firestore
async function scheduleLiveClass(classData) {
    try {
        await db.collection('live_classes').add({
            title: classData.title,
            courseId: classData.courseId,
            instructorId: auth.currentUser.uid,
            startTime: new Date(classData.startTime),
            duration: classData.duration,
            meetingLink: classData.meetingLink || null,
            status: 'scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Notify enrolled students (Cloud Function in production)
        console.log('Live class scheduled');
        return true;
    } catch (error) {
        console.error('Error scheduling class:', error);
        return false;
    }
}

// Make functions global
window.toggleMic = toggleMic;
window.toggleCam = toggleCam;
window.joinClass = joinClass;
window.shareScreen = shareScreen;
window.raiseHand = raiseHand;
window.leaveClass = leaveClass;
window.sendMessage = sendMessage;
window.switchToParticipants = switchToParticipants;
window.switchToChat = switchToChat;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.scheduleLiveClass = scheduleLiveClass;
