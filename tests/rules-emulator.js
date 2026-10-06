const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'kboa-academy-production-test';

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
    storage: { rules: fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8') }
  });
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await db.doc('users/admin-1').set({ role: 'admin', status: 'active' });
      await db.doc('users/student-1').set({ role: 'student', status: 'active' });
      await db.doc('users/instructor-1').set({ role: 'instructor', status: 'active' });
      await db.doc('users/instructor-2').set({ role: 'instructor', status: 'active' });
      await db.doc('courses/course-a').set({ status: 'published', instructorId: 'instructor-1' });
      await db.doc('courses/course-b').set({ status: 'published', instructorId: 'instructor-2' });
      await db.doc('courses/private-course').set({ status: 'draft', instructorId: 'instructor-1' });
      await db.doc('enrollments/student-1_course-a').set({ studentId: 'student-1', courseId: 'course-a', progress: 0 });
    });

    const student = env.authenticatedContext('student-1', { role: 'student' }).firestore();
    const instructor1 = env.authenticatedContext('instructor-1', { role: 'instructor' }).firestore();
    const instructor2 = env.authenticatedContext('instructor-2', { role: 'instructor' }).firestore();
    const anon = env.unauthenticatedContext().firestore();

    await assertSucceeds(student.doc('users/student-1').get());
    await assertFails(student.doc('users/instructor-1').get());
    await assertFails(student.doc('payments/p-1').set({ studentId: 'student-1', status: 'success' }));
    await assertSucceeds(student.doc('courses/course-a').get());
    await assertFails(student.doc('courses/private-course').get());
    await assertSucceeds(instructor1.doc('courses/course-a').update({ title: 'owned' }));
    await assertFails(instructor1.doc('courses/course-b').update({ title: 'not-owned' }));
    await assertSucceeds(instructor2.doc('courses/course-b').update({ title: 'owned' }));
    await assertFails(anon.doc('courses/course-a').get());

    console.log('Firebase Firestore rules emulator tests: PASS');
  } finally {
    await env.cleanup();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
