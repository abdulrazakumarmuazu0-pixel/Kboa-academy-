// ============================================
// KBOA - Firebase Configuration (PRODUCTION)
// Project: akboa-academy
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCAx2HJ6w4gkcWH5BDiFMsbGIyYJScXFeY",
    authDomain: "akboa-academy.firebaseapp.com",
    databaseURL: "https://akboa-academy-default-rtdb.firebaseio.com",
    projectId: "akboa-academy",
    storageBucket: "akboa-academy.firebasestorage.app",
    messagingSenderId: "708878238071",
    appId: "1:708878238071:web:a8f69d38d8e879dd9ea172",
    measurementId: "G-8NZFB7G98L"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open — persistence enabled in one tab only.');
        } else if (err.code == 'unimplemented') {
            console.log('Browser does not support persistence.');
        }
    });

// Export for use in other files
window.auth = auth;
window.db = db;

console.log('✅ Firebase connected: akboa-academy');
