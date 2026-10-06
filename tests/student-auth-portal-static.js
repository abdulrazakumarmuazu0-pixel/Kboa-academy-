const fs = require('fs');
const assert = require('assert');
const auth = fs.readFileSync('js/auth.js','utf8');
const dash = fs.readFileSync('js/dashboard.js','utf8');
const fn = fs.readFileSync('functions/index.js','utf8');
const html = fs.readFileSync('dashboard.html','utf8');
const rules = fs.readFileSync('firestore.rules','utf8');

assert(fn.includes('exports.getStudentPortalAccess'), 'student portal access callable missing');
assert(fn.includes("where('studentId', '==', uid).limit(1)"), 'student access must be scoped by UID');
assert(fn.includes("where('status', '==', 'success').limit(1)"), 'paid access must require successful payment');
assert(auth.includes("httpsCallable('createStudentProfile')"), 'registration must create server-side student profile');
assert(auth.includes("httpsCallable('getStudentPortalAccess')"), 'student login must check portal entitlement');
assert(dash.includes("httpsCallable('getStudentPortalAccess')"), 'dashboard must enforce server-side portal entitlement');
assert(html.includes('id="my-courses"'), 'dashboard course container missing');
assert(!html.includes('AI & ChatGPT Mastery'), 'hard-coded demo course leaked into student dashboard');
assert(!html.includes('Completed Lesson 3: Introduction to Prompts'), 'hard-coded demo activity leaked into student dashboard');
assert(rules.includes('allow create: if false;'), 'client must not directly create user profiles');
console.log('Student Auth & Portal Isolation: PASS');
