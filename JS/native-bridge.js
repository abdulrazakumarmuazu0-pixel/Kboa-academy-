// ============================================
// KBOA Android App — Native Bridge
// Connects the web app to native Android features
// via Capacitor plugins
// ============================================

// Check if running inside the native app
const isNativeApp = () => {
    return window.Capacitor !== undefined && window.Capacitor.isNativePlatform();
};

// ============================================
// PUSH NOTIFICATIONS (Firebase Cloud Messaging)
// ============================================
async function setupPushNotifications() {
    if (!isNativeApp()) {
        console.log('Push notifications: web browser — skipping');
        return;
    }

    const { PushNotifications } = window.Capacitor.Plugins;

    // Request permission
    let permResult = await PushNotifications.requestPermissions();
    if (permResult.receive === 'granted') {
        await PushNotifications.register();
    } else {
        console.log('Push permission denied');
        return;
    }

    // Registration success — save FCM token
    PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);

        // Register token through the trusted backend instead of writing token state directly.
        try {
            if (window.firebase?.functions) {
                await firebase.functions().httpsCallable('registerPushToken')({ token: token.value, platform: 'android' });
            }
        } catch (e) {
            console.error('Push token registration failed:', e);
        }

        // Store locally too
        localStorage.setItem('fcm_token', token.value);
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
    });

    // Notification received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
        // Show in-app toast
        showNativeToast(`🔔 ${notification.title}: ${notification.body}`);
    });

    // Notification tapped (app opened from notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action:', notification);
        const data = notification.notification.data;

        // Deep link based on notification data
        if (data?.type === 'new_lesson' && data?.courseId) {
            window.location.href = `course-learning.html?id=${data.courseId}`;
        } else if (data?.type === 'assignment_due') {
            window.location.href = 'assignments.html';
        } else if (data?.type === 'live_class') {
            window.location.href = 'live-classes.html';
        } else if (data?.type === 'certificate') {
            window.location.href = 'certificates.html';
        }
    });
}

// ============================================
// LOCAL NOTIFICATIONS (Reminders — no internet needed)
// ============================================
async function scheduleLocalNotification(title, body, scheduleDate, id) {
    if (!isNativeApp()) return;

    const { LocalNotifications } = window.Capacitor.Plugins;

    await LocalNotifications.schedule({
        notifications: [{
            id: id || Math.floor(Math.random() * 100000),
            title: title,
            body: body,
            schedule: { at: new Date(scheduleDate) },
            sound: 'beep.wav',
            attachments: null,
            actionTypeId: '',
            extra: null
        }]
    });
}

// ============================================
// OFFLINE VIDEO DOWNLOADS (Filesystem)
// ============================================
async function downloadVideoForOffline(videoUrl, filename) {
    if (!isNativeApp()) {
        alert('Offline downloads only work in the Android app');
        return null;
    }

    const { Filesystem, Directory } = window.Capacitor.Plugins;

    try {
        showNativeToast('⬇️ Downloading video for offline viewing...');

        // Download the file
        const response = await fetch(videoUrl);
        const blob = await response.blob();

        // Convert to base64
        const base64Data = await blobToBase64(blob);

        // Write to app storage
        const result = await Filesystem.writeFile({
            path: `videos/${filename}`,
            data: base64Data,
            directory: Directory.Data,
            recursive: true
        });

        // Save record to local storage
        const downloads = JSON.parse(localStorage.getItem('offline_videos') || '[]');
        downloads.push({
            filename: filename,
            uri: result.uri,
            downloadedAt: new Date().toISOString()
        });
        localStorage.setItem('offline_videos', JSON.stringify(downloads));

        showNativeToast('✅ Video saved for offline viewing!');
        return result.uri;
    } catch (error) {
        console.error('Download error:', error);
        showNativeToast('❌ Download failed');
        return null;
    }
}

async function getOfflineVideos() {
    if (!isNativeApp()) return [];

    const { Filesystem, Directory } = window.Capacitor.Plugins;
    try {
        const result = await Filesystem.readdir({
            path: 'videos',
            directory: Directory.Data
        });
        return result.files;
    } catch {
        return [];
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result
                .replace('data:', '')
                .replace(/^.+,/, '');
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ============================================
// NATIVE TOAST
// ============================================
function showNativeToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: white;
        padding: 14px 24px;
        border-radius: 30px;
        font-size: 0.95rem;
        z-index: 99999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        animation: toastIn 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Add toast animations to page
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    @keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(toastStyle);

// ============================================
// NETWORK STATUS (Show offline banner)
// ============================================
async function setupNetworkListener() {
    if (!isNativeApp()) return;

    const { Network } = window.Capacitor.Plugins;

    Network.addListener('networkStatusChange', (status) => {
        let banner = document.getElementById('offline-banner');

        if (!status.connected) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'offline-banner';
                banner.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #dc2626;
                    color: white;
                    text-align: center;
                    padding: 10px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    z-index: 99999;
                `;
                banner.textContent = '📡 You are offline — showing saved content';
                document.body.appendChild(banner);
            }
        } else if (banner) {
            banner.textContent = '✅ Back online!';
            banner.style.background = '#059669';
            setTimeout(() => banner.remove(), 2000);
        }
    });
}

// ============================================
// NATIVE SHARE
// ============================================
async function nativeShare(title, text, url) {
    if (isNativeApp()) {
        const { Share } = window.Capacitor.Plugins;
        await Share.share({
            title: title,
            text: text,
            url: url,
            dialogTitle: 'Share via'
        });
    } else if (navigator.share) {
        navigator.share({ title, text, url });
    } else {
        // Fallback: copy to clipboard
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNativeToast('🔗 Link copied to clipboard!');
    }
}

// ============================================
// APP STATE (Handle back button)
// ============================================
async function setupAppStateListener() {
    if (!isNativeApp()) return;

    const { App } = window.Capacitor.Plugins;

    App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
            App.exitApp();
        } else {
            window.history.back();
        }
    });

    App.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed. Is active?', isActive);
        // Refresh data when app becomes active again
        if (isActive && window.loadEnrolledCourses) {
            window.loadEnrolledCourses();
        }
    });
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    await setupPushNotifications();
    await setupNetworkListener();
    await setupAppStateListener();

    if (isNativeApp()) {
        console.log('🤖 KBOA running as native Android app');
        document.body.classList.add('native-app');

        // Hide browser-only UI elements in native app
        const browserOnly = document.querySelectorAll('.browser-only');
        browserOnly.forEach(el => el.style.display = 'none');
    }
});

// Make functions globally available
window.isNativeApp = isNativeApp;
window.setupPushNotifications = setupPushNotifications;
window.scheduleLocalNotification = scheduleLocalNotification;
window.downloadVideoForOffline = downloadVideoForOffline;
window.getOfflineVideos = getOfflineVideos;
window.showNativeToast = showNativeToast;
window.nativeShare = nativeShare;
