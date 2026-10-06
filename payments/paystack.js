// ============================================
// KBOA — Paystack Payment Integration
// PRODUCTION MODE: uses LIVE keys + server verification
// via Cloud Function (see docs/cloud-functions.js)
// ============================================

// ⚠️ REPLACE with your LIVE public key from https://dashboard.paystack.com
const PAYSTACK_PUBLIC_KEY = (window.KBOA_RUNTIME_CONFIG && window.KBOA_RUNTIME_CONFIG.paystackPublicKey) || '';
const PAYSTACK_ENVIRONMENT = (window.KBOA_RUNTIME_CONFIG && window.KBOA_RUNTIME_CONFIG.environment) || 'production';

function initializePaystackPayment(courseId, courseTitle, amount, studentEmail, studentName) {
    if (PAYSTACK_ENVIRONMENT === 'test' && PAYSTACK_PUBLIC_KEY.indexOf('pk_test_') !== 0) {
        throw new Error('Test environment requires a Paystack test public key.');
    }
    if (PAYSTACK_ENVIRONMENT === 'production' && PAYSTACK_PUBLIC_KEY.indexOf('pk_live_') !== 0) {
        throw new Error('Production environment requires a Paystack live public key.');
    }
    if (!/^pk_(test|live)_/.test(PAYSTACK_PUBLIC_KEY) || PAYSTACK_PUBLIC_KEY.indexOf('REPLACE') !== -1) {
        alert('⚠️ Payment is not configured. Set the Paystack public key in js/runtime-config.js before enabling checkout.');
        return;
    }

    var handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: studentEmail,
        amount: amount * 100, // kobo
        currency: 'NGN',
        ref: generateReference(),
        metadata: {
            course_id: courseId,
            course_title: courseTitle,
            student_name: studentName,
            custom_fields: [
                { display_name: 'Course', variable_name: 'course', value: courseTitle },
                { display_name: 'Student', variable_name: 'student_name', value: studentName }
            ]
        },
        callback: function(response) {
            verifyPaymentOnServer(response.reference, courseId);
        },
        onClose: function() {
            console.log('Payment window closed');
        }
    });
    handler.openIframe();
}

function generateReference() {
    return 'KBOA-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000000);
}

// Verify on SERVER (Cloud Function) — never trust client-side verification
async function verifyPaymentOnServer(reference, courseId) {
    showPayAlert('Verifying payment…', 'info');

    try {
        var verifyPayment = firebase.functions().httpsCallable('verifyPayment');
        var result = await verifyPayment({ reference: reference, courseId: courseId });

        if (result.data.success) {
            showPayAlert('✅ Payment confirmed! Enrolling you now…', 'success');
            setTimeout(function() {
                window.location.href = 'course-learning.html?id=' + courseId;
            }, 1500);
        } else {
            showPayAlert('❌ Payment could not be verified: ' + result.data.message, 'error');
        }
    } catch (error) {
        console.error('Verification error:', error);
        showPayAlert('❌ Verification failed. Contact support with reference: ' + reference, 'error');
    }
}

function showPayAlert(message, type) {
    var container = document.getElementById('alert-container');
    if (!container) { alert(message); return; }
    var div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.textContent = message;
    container.innerHTML = '';
    container.appendChild(div);
}

function loadPaystackScript() {
    if (window.PaystackPop) return Promise.resolve();
    return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function checkout(courseId, courseTitle, price) {
    var user = auth.currentUser;
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    var userDoc = await db.collection('users').doc(user.uid).get();
    var userName = userDoc.exists ? (userDoc.data().fullName || user.email) : user.email;

    await loadPaystackScript();
    initializePaystackPayment(courseId, courseTitle, price, user.email, userName);
}

window.checkout = checkout;
