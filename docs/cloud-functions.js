// ============================================
// KBOA Cloud Functions — Push Notifications
// Deploy: firebase deploy --only functions
// Location: functions/index.js
// ============================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// ============================================
// 1. NEW LESSON → Notify enrolled students
// ============================================
exports.notifyNewLesson = functions.firestore
    .document('courses/{courseId}/lessons/{lessonId}')
    .onCreate(async (snap, context) => {
        const lesson = snap.data();
        const courseId = context.params.courseId;

        // Get all enrolled students with FCM tokens
        const enrollments = await admin.firestore()
            .collection('enrollments')
            .where('courseId', '==', courseId)
            .get();

        const tokens = [];
        for (const enrollment of enrollments.docs) {
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(enrollment.data().studentId)
                .get();

            const fcmTokens = userDoc.data()?.fcmTokens || [];
            tokens.push(...fcmTokens);
        }

        if (tokens.length === 0) return null;

        const courseDoc = await admin.firestore()
            .collection('courses').doc(courseId).get();

        const message = {
            notification: {
                title: '📚 New Lesson Available!',
                body: `${lesson.title} is now live in ${courseDoc.data()?.title || 'your course'}`
            },
            data: {
                type: 'new_lesson',
                courseId: courseId
            },
            tokens: tokens
        };

        return admin.messaging().sendMulticast(message);
    });

// ============================================
// 2. ASSIGNMENT DUE REMINDER (scheduled daily 6pm)
// ============================================
exports.assignmentDueReminder = functions.pubsub
    .schedule('0 18 * * *')  // Every day at 6:00 PM WAT
    .timeZone('Africa/Lagos')
    .onRun(async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find assignments due tomorrow
        const assignments = await admin.firestore()
            .collection('assignments')
            .where('dueDate', '>=', new Date())
            .where('dueDate', '<=', tomorrow)
            .get();

        for (const assignment of assignments.docs) {
            const data = assignment.data();

            const enrollments = await admin.firestore()
                .collection('enrollments')
                .where('courseId', '==', data.courseId)
                .get();

            const tokens = [];
            for (const enrollment of enrollments.docs) {
                const userDoc = await admin.firestore()
                    .collection('users')
                    .doc(enrollment.data().studentId)
                    .get();

                // Only notify students who haven't submitted
                const submission = await admin.firestore()
                    .collection('submissions')
                    .where('assignmentId', '==', assignment.id)
                    .where('studentId', '==', enrollment.data().studentId)
                    .get();

                if (submission.empty) {
                    tokens.push(...(userDoc.data()?.fcmTokens || []));
                }
            }

            if (tokens.length > 0) {
                await admin.messaging().sendMulticast({
                    notification: {
                        title: '⏰ Assignment Due Tomorrow!',
                        body: `"${data.title}" is due tomorrow. Don't miss it!`
                    },
                    data: { type: 'assignment_due' },
                    tokens: tokens
                });
            }
        }
        return null;
    });

// ============================================
// 3. LIVE CLASS STARTING (scheduled per class)
// ============================================
exports.notifyLiveClass = functions.firestore
    .document('live_classes/{classId}')
    .onCreate(async (snap) => {
        const liveClass = snap.data();

        // Schedule notification 30 min before start
        const notifyTime = new Date(liveClass.startTime.toDate().getTime() - 30 * 60000);

        // Get enrolled students
        const enrollments = await admin.firestore()
            .collection('enrollments')
            .where('courseId', '==', liveClass.courseId)
            .get();

        const tokens = [];
        for (const enrollment of enrollments.docs) {
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(enrollment.data().studentId)
                .get();
            tokens.push(...(userDoc.data()?.fcmTokens || []));
        }

        if (tokens.length === 0) return null;

        return admin.messaging().sendMulticast({
            notification: {
                title: '🎥 Live Class Starting Soon!',
                body: `"${liveClass.title}" starts in 30 minutes. Join now!`
            },
            data: {
                type: 'live_class',
                classId: snap.id
            },
            tokens: tokens
        });
    });

// ============================================
// 4. CERTIFICATE ISSUED
// ============================================
exports.notifyCertificate = functions.firestore
    .document('certificates/{certId}')
    .onCreate(async (snap) => {
        const cert = snap.data();

        const userDoc = await admin.firestore()
            .collection('users')
            .doc(cert.studentId)
            .get();

        const tokens = userDoc.data()?.fcmTokens || [];
        if (tokens.length === 0) return null;

        return admin.messaging().sendMulticast({
            notification: {
                title: '🏆 Congratulations!',
                body: `Your certificate for "${cert.courseName}" is ready! Share your achievement.`
            },
            data: { type: 'certificate' },
            tokens: tokens
        });
    });

// ============================================
// 5. VERIFY PAYSTACK PAYMENT (called from app)
// Deploy with: firebase deploy --only functions
// Set secret first: firebase functions:secrets:set PAYSTACK_SECRET_KEY
// ============================================
exports.verifyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required.');
  }

  const { reference, courseId } = data;
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

  // 1. Confirm with Paystack API
  const paystackRes = await fetch('https://api.paystack.co/transaction/verify/' + reference, {
    headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET }
  });
  const paystackData = await paystackRes.json();

  if (!paystackData.status || paystackData.data.status !== 'success') {
    return { success: false, message: 'Payment not confirmed by Paystack' };
  }

  const amountPaid = paystackData.data.amount / 100; // kobo → naira

  // 2. Idempotency: skip if this reference was already processed
  const existing = await admin.firestore().collection('payments')
    .where('reference', '==', reference).limit(1).get();
  if (!existing.empty) {
    return { success: true, message: 'Already processed' };
  }

  // 3. Save payment record
  await admin.firestore().collection('payments').add({
    reference: reference,
    courseId: courseId,
    studentId: context.auth.uid,
    amount: amountPaid,
    status: 'success',
    gateway: 'paystack',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 4. Create enrollment (idempotent per student+course)
  const existingEnroll = await admin.firestore().collection('enrollments')
    .where('studentId', '==', context.auth.uid)
    .where('courseId', '==', courseId).limit(1).get();

  if (existingEnroll.empty) {
    await admin.firestore().collection('enrollments').add({
      studentId: context.auth.uid,
      courseId: courseId,
      progress: 0,
      completedLessons: [],
      enrolledAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await admin.firestore().collection('users').doc(context.auth.uid).update({
      enrolledCourses: admin.firestore.FieldValue.arrayUnion(courseId)
    });
  }

  return { success: true, message: 'Enrolled successfully' };
});

// ============================================
// 6. ADMIN: create user account (auth + Firestore)
// ============================================
exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { email, password, fullName, role, phone, country } = data;
  const user = await admin.auth().createUser({ email, password, displayName: fullName });
  await admin.firestore().collection('users').doc(user.uid).set({
    fullName, email, phone: phone || '', country: country || '',
    role: role || 'student', status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { uid: user.uid };
});

// ============================================
// 7. ADMIN: delete user completely
// ============================================
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { uid } = data;
  await admin.firestore().collection('users').doc(uid).delete();
  try { await admin.auth().deleteUser(uid); } catch (e) {}
  return { success: true };
});

// ============================================
// 8. ADMIN: real Paystack refund
// ============================================
exports.refundPayment = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const { paymentId, reference, amount } = data;
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

  const res = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + PAYSTACK_SECRET,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transaction: reference, amount: amount * 100 })
  });
  const body = await res.json();

  if (!body.status) return { success: false, message: body.message };

  await admin.firestore().collection('payments').doc(paymentId).update({
    status: 'refunded',
    refundedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true };
});

async function assertAdmin(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required.');
  const doc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  if (!doc.exists || doc.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  }
}

// ============================================
// 9. WELCOME EMAIL on new student registration
// (Optional — requires SendGrid/Mailgun SMTP config)
// ============================================
exports.onNewUser = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const user = snap.data();
    if (user.role !== 'student') return null;

    // Log the registration (view in Firebase Console → Functions → Logs)
    console.log('New student registered:', user.fullName, user.email, 'ID:', user.studentId);

    // TODO: Send welcome email via your email provider (SMTP creds in functions config)
    // Example with nodemailer:
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   to: user.email,
    //   subject: 'Welcome to KBOA Academy! 🎉',
    //   html: `<h1>Assalamu alaikum ${user.fullName}!</h1><p>Your Student ID is <strong>${user.studentId}</strong>...</p>`
    // });

    return null;
  });
