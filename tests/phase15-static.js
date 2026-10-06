const fs = require('fs');
const assert = require('assert');
const functions = fs.readFileSync('functions/index.js', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function has(text, needle, label) { assert(text.includes(needle), `Missing ${label}: ${needle}`); }

has(functions, 'const ROLE_PERMISSIONS', 'central role permission matrix');
has(functions, 'async function requirePermission', 'deny-by-default permission guard');
has(functions, 'async function requireAdminPermission', 'admin capability guard');
has(functions, 'async function requireCourseInstructorOrAdmin', 'resource-level course authorization guard');
has(functions, "AUTHORIZATION_DENIED", 'authorization denial security event');
has(functions, "RESOURCE_AUTHORIZATION_DENIED", 'resource authorization denial event');
has(functions, 'exports.getMyAuthorization', 'authorization introspection callable');
has(functions, "policyVersion: 'phase-15-v1'", 'authorization policy version');
has(functions, 'authorizationVersion', 'persisted authorization version');

for (const permission of ['users.manage', 'payments.manage', 'certificates.manage', 'security.manage', 'observability.read']) {
  has(functions, permission, `permission ${permission}`);
}

has(rules, 'request.resource.data.instructorId == resource.data.instructorId', 'course ownership immutability');
has(rules, 'request.resource.data.courseId == resource.data.courseId', 'resource course ownership immutability');
has(rules, 'match /authorization_policies/{id}', 'authorization policy collection boundary');
assert(!rules.includes("request.method == 'delete'"), 'Firestore rules must not rely on unsupported request.method checks');

assert(pkg.scripts['test:phase15'] === 'node tests/phase15-static.js', 'Phase 15 npm script missing');
assert(pkg.scripts['test:production'].includes('npm run test:phase15'), 'Production suite does not include Phase 15');

console.log('Phase 15 static security gate: PASS');
