#!/usr/bin/env node
/**
 * One-time / controlled first-admin bootstrap.
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase service-account JSON.
 * Never expose the service-account key or run this script in the browser.
 */
const admin = require('firebase-admin');
const readline = require('node:readline');

function ask(question, hidden = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

(async () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON file.');
  }
  admin.initializeApp();
  const db = admin.firestore();
  const auth = admin.auth();
  const existing = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  if (!existing.empty) throw new Error('An admin already exists. Use the Admin Settings → Add Admin flow instead.');

  const fullName = await ask('First admin full name: ');
  const email = await ask('First admin email: ');
  const password = await ask('First admin temporary password (12+ chars, upper/lowercase + number): ');
  if (fullName.length < 3) throw new Error('Full name must be at least 3 characters.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email.');
  if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Password policy failed.');

  const user = await auth.createUser({ email, password, displayName: fullName });
  await auth.setCustomUserClaims(user.uid, {
    role: 'admin',
    permissions: ['admin.read','admin.write','users.read','users.manage','roles.manage','admissions.manage','courses.manage','payments.manage','certificates.manage','notifications.send','observability.read','security.manage','reports.read']
  });
  await db.collection('users').doc(user.uid).set({
    fullName, email, role: 'admin', status: 'active', permissions: ['admin.read','admin.write','users.read','users.manage','roles.manage','admissions.manage','courses.manage','payments.manage','certificates.manage','notifications.send','observability.read','security.manage','reports.read'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), authorizationVersion: 1
  });
  console.log(`First admin created successfully: ${user.uid}`);
})().catch(err => { console.error(`Bootstrap failed: ${err.message}`); process.exitCode = 1; });
