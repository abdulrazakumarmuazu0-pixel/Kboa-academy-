const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { onSchedule } = require('firebase-functions/v2/scheduler');

admin.initializeApp();
const db = admin.firestore();

const API_VERSION = 'v1';
const API_CONTRACT_VERSION = 'phase-16-v1';
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function requestMeta(data = {}, context = {}) {
  const requestId = cleanString(data?.requestId || context.rawRequest?.get?.('x-request-id') || '', 120) || `req_${crypto.randomUUID()}`;
  const idempotencyKey = cleanString(data?.idempotencyKey || '', 160);
  if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,160}$/.test(idempotencyKey)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid idempotencyKey format.');
  }
  return { requestId, idempotencyKey, apiVersion: API_VERSION, contractVersion: API_CONTRACT_VERSION };
}

function apiResponse(data = {}, meta = {}) {
  return { ...data, _meta: { apiVersion: API_VERSION, contractVersion: API_CONTRACT_VERSION, requestId: meta.requestId || `req_${crypto.randomUUID()}` } };
}

function validatePayload(data, schema = {}) {
  const value = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const allowed = schema.allowed || null;
  if (allowed) {
    const unknown = Object.keys(value).filter(k => !allowed.includes(k));
    if (unknown.length) throw new functions.https.HttpsError('invalid-argument', `Unsupported request field: ${unknown[0]}`);
  }
  for (const [field, rule] of Object.entries(schema.fields || {})) {
    const present = value[field] !== undefined && value[field] !== null && value[field] !== '';
    if (rule.required && !present) throw new functions.https.HttpsError('invalid-argument', `${field} is required.`);
    if (present && rule.type && typeof value[field] !== rule.type) throw new functions.https.HttpsError('invalid-argument', `${field} must be ${rule.type}.`);
  }
  return value;
}

async function withIdempotency(uid, operation, key, handler) {
  if (!key) return handler({ replayed: false });
  const safeOperation = cleanString(operation, 100).replace(/[^A-Za-z0-9_-]/g, '_');
  const docId = crypto.createHash('sha256').update(`${uid}:${safeOperation}:${key}`).digest('hex');
  const ref = db.collection('idempotency_keys').doc(docId);
  const now = Date.now();
  let replay;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const existing = snap.data() || {};
      if (existing.status === 'completed' && existing.expiresAtMs > now) {
        replay = existing.response;
        return;
      }
      if (existing.status === 'processing' && existing.leaseUntilMs > now) {
        throw new functions.https.HttpsError('aborted', 'An identical request is already being processed. Retry with the same idempotency key.');
      }
    }
    tx.set(ref, { uid, operation: safeOperation, status: 'processing', leaseUntilMs: now + 2 * 60 * 1000, expiresAtMs: now + IDEMPOTENCY_TTL_MS, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  if (replay !== undefined) return { response: replay, replayed: true };
  try {
    const response = await handler({ replayed: false });
    await ref.set({ status: 'completed', response, leaseUntilMs: 0, expiresAtMs: Date.now() + IDEMPOTENCY_TTL_MS, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { response, replayed: false };
  } catch (error) {
    await ref.set({ status: 'failed', leaseUntilMs: 0, failureCode: error?.code || 'internal', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}


const JOB_STATUSES = Object.freeze(['queued','processing','completed','failed','dead_letter']);
const JOB_TYPES = Object.freeze(['send_notification','rebuild_metrics','health_check','cleanup_idempotency','publish_event']);
const EVENT_STATUSES = Object.freeze(['pending','processing','published','failed','dead_letter']);
const EVENT_TYPES = Object.freeze(['admission.status_changed','notification.requested','payment.verified','certificate.issued']);
const EVENT_MAX_ATTEMPTS = 5;
const EVENT_LEASE_MS = 5 * 60 * 1000;
const JOB_MAX_ATTEMPTS = 5;
const JOB_LEASE_MS = 5 * 60 * 1000;

function safeJobType(value) {
  const type = cleanString(value, 80);
  if (!JOB_TYPES.includes(type)) throw new functions.https.HttpsError('invalid-argument', 'Unsupported job type.');
  return type;
}

function jobBackoffMs(attempt) {
  return Math.min(15 * 60 * 1000, Math.max(1000, 1000 * (2 ** Math.max(0, attempt - 1))));
}


function safeEventType(value) {
  const type = cleanString(value, 100);
  if (!EVENT_TYPES.includes(type)) throw new functions.https.HttpsError('invalid-argument', 'Unsupported event type.');
  return type;
}

async function enqueueDomainEvent(type, aggregateType, aggregateId, payload = {}, options = {}) {
  const safeType = safeEventType(type);
  const eventId = cleanString(options.eventId || '', 160) || db.collection('event_outbox').doc().id;
  const ref = db.collection('event_outbox').doc(eventId);
  const safePayload = Object.fromEntries(Object.entries(payload || {}).slice(0, 30).map(([k,v]) => [cleanString(k,80), typeof v === 'string' ? cleanString(v,1000) : v]));
  await ref.set({ eventId, type: safeType, aggregateType: cleanString(aggregateType,80), aggregateId: cleanString(aggregateId,160), payload: safePayload, status: 'pending', attempts: 0, maxAttempts: EVENT_MAX_ATTEMPTS, runAtMs: Date.now(), leaseUntilMs: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await incrementMetric('events_outbox_enqueued');
  return eventId;
}

function eventBackoffMs(attempt) { return Math.min(30 * 60 * 1000, Math.max(1000, 2000 * (2 ** Math.max(0, attempt - 1)))); }

async function claimEvent(ref) {
  const now = Date.now(); let claimed = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) return;
    const data = snap.data() || {}; const leaseExpired = Number(data.leaseUntilMs || 0) <= now;
    if (!['pending','processing'].includes(data.status) || Number(data.runAtMs || 0) > now || !leaseExpired) return;
    const attempts = Number(data.attempts || 0) + 1;
    if (attempts > Number(data.maxAttempts || EVENT_MAX_ATTEMPTS)) { tx.update(ref, { status: 'dead_letter', updatedAt: admin.firestore.FieldValue.serverTimestamp() }); return; }
    tx.update(ref, { status: 'processing', attempts, leaseUntilMs: now + EVENT_LEASE_MS, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    claimed = { ...data, attempts, status: 'processing' };
  });
  return claimed;
}

async function consumeDomainEvent(event) {
  switch (event.type) {
    case 'admission.status_changed': {
      const uid = cleanString(event.payload?.applicantId, 128);
      const status = cleanString(event.payload?.status, 30);
      if (!uid || !status) throw new Error('Admission event requires applicantId and status');
      const notificationId = crypto.createHash('sha256').update(`event:${event.eventId}`).digest('hex');
      const ref = db.collection('notifications').doc(notificationId);
      await ref.set({ userId: uid, ...notificationPayload('Admission update', `Your KBOA admission application is now ${status.replace('_', ' ')}.`, 'admission', { applicationId: event.aggregateId, status, eventId: event.eventId }), eventId: event.eventId, createdBy: 'event-consumer', createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await incrementMetric('event_notifications_published');
      return;
    }
    case 'notification.requested': {
      const uid = cleanString(event.payload?.userId, 128); const title = cleanString(event.payload?.title, 160); const body = cleanString(event.payload?.body, 1000);
      if (!uid || !title) throw new Error('Notification event requires userId and title');
      const notificationId = crypto.createHash('sha256').update(`event:${event.eventId}`).digest('hex');
      await db.collection('notifications').doc(notificationId).set({ userId: uid, ...notificationPayload(title, body, cleanString(event.payload?.type || 'system',80), event.payload?.data || {}), eventId: event.eventId, createdBy: 'event-consumer', createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    case 'payment.verified':
      await recordOperationalEvent('PAYMENT_VERIFIED_EVENT_CONSUMED', 'info', { eventId: event.eventId, paymentId: event.aggregateId });
      return;
    case 'certificate.issued':
      await recordOperationalEvent('CERTIFICATE_ISSUED_EVENT_CONSUMED', 'info', { eventId: event.eventId, certificateId: event.aggregateId });
      return;
    default: throw new Error('Unknown domain event');
  }
}

async function runEventOutbox(limit = 20) {
  const now = Date.now();
  const snap = await db.collection('event_outbox').where('status','==','pending').where('runAtMs','<=',now).orderBy('runAtMs').limit(limit).get();
  let published = 0, failed = 0, dead = 0;
  for (const doc of snap.docs) {
    const event = await claimEvent(doc.ref); if (!event) continue;
    try {
      await consumeDomainEvent(event);
      await doc.ref.update({ status: 'published', leaseUntilMs: 0, publishedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await incrementMetric('events_outbox_published'); published++;
    } catch (error) {
      const terminal = Number(event.attempts || 1) >= Number(event.maxAttempts || EVENT_MAX_ATTEMPTS);
      await doc.ref.update({ status: terminal ? 'dead_letter' : 'pending', leaseUntilMs: 0, runAtMs: Date.now() + eventBackoffMs(event.attempts), lastError: cleanString(error?.message || String(error), 500), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await incrementMetric(terminal ? 'events_outbox_dead_letter' : 'events_outbox_failed');
      await recordOperationalEvent(terminal ? 'EVENT_DEAD_LETTER' : 'EVENT_RETRY_SCHEDULED', terminal ? 'critical' : 'warning', { eventId: event.eventId, type: event.type, attempts: String(event.attempts), error: error?.message || String(error) });
      failed++; if (terminal) dead++;
    }
  }
  return { published, failed, dead };
}

async function enqueueJob(type, payload = {}, options = {}) {
  const safeType = safeJobType(type);
  const idempotencyKey = cleanString(options.idempotencyKey || '', 160);
  const jobId = idempotencyKey
    ? crypto.createHash('sha256').update(`job:${safeType}:${idempotencyKey}`).digest('hex')
    : db.collection('jobs').doc().id;
  const ref = db.collection('jobs').doc(jobId);
  const now = Date.now();
  const safePayload = Object.fromEntries(Object.entries(payload || {}).slice(0, 30).map(([k,v]) => [cleanString(k,80), typeof v === 'string' ? cleanString(v,500) : v]));
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists && ['queued','processing','completed'].includes(snap.data()?.status)) return;
    tx.set(ref, { jobId, type: safeType, payload: safePayload, status: 'queued', attempts: 0, maxAttempts: JOB_MAX_ATTEMPTS, runAtMs: Number(options.runAtMs || now), leaseUntilMs: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastError: null }, { merge: true });
  });
  await incrementMetric('jobs_enqueued');
  return { jobId, type: safeType };
}

async function claimJob(ref) {
  const now = Date.now(); let claimed = null;
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const leaseExpired = Number(data.leaseUntilMs || 0) <= now;
    if (!['queued','processing'].includes(data.status) || Number(data.runAtMs || 0) > now || !leaseExpired) return;
    const attempts = Number(data.attempts || 0) + 1;
    if (attempts > Number(data.maxAttempts || JOB_MAX_ATTEMPTS)) {
      tx.update(ref, { status: 'dead_letter', attempts: attempts - 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    }
    tx.update(ref, { status: 'processing', attempts, leaseUntilMs: now + JOB_LEASE_MS, startedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    claimed = { ...data, attempts, status: 'processing' };
  });
  return claimed;
}

async function processJob(job) {
  switch (job.type) {
    case 'send_notification':
      if (!job.payload?.userId || !job.payload?.title) throw new Error('send_notification requires userId and title');
      await db.collection('notifications').add({ userId: cleanString(job.payload.userId,128), title: cleanString(job.payload.title,160), body: cleanString(job.payload.body || '',500), type: 'job', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      return;
    case 'rebuild_metrics':
      await recordOperationalEvent('JOB_METRICS_REBUILD', 'info', { requestedByJob: job.jobId });
      await incrementMetric('jobs_metrics_rebuild');
      return;
    case 'health_check':
      await db.collection('operational_metrics').limit(1).get();
      await recordOperationalEvent('JOB_HEALTH_CHECK', 'info', { requestedByJob: job.jobId });
      return;
    case 'cleanup_idempotency':
      await recordOperationalEvent('JOB_IDEMPOTENCY_CLEANUP_REQUESTED', 'info', { requestedByJob: job.jobId });
      return;
    case 'publish_event':
      await runEventOutbox(Number(job.payload?.limit || 20));
      return;
    default: throw new Error('Unknown job type');
  }
}

async function runQueuedJobs(limit = 10) {
  const now = Date.now();
  const snap = await db.collection('jobs').where('status','==','queued').where('runAtMs','<=',now).orderBy('runAtMs').limit(limit).get();
  let processed = 0, failed = 0, dead = 0;
  for (const doc of snap.docs) {
    const job = await claimJob(doc.ref);
    if (!job) continue;
    try {
      await processJob(job);
      await doc.ref.update({ status: 'completed', leaseUntilMs: 0, completedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await incrementMetric('jobs_completed'); processed++;
    } catch (error) {
      const terminal = Number(job.attempts || 1) >= Number(job.maxAttempts || JOB_MAX_ATTEMPTS);
      await doc.ref.update({ status: terminal ? 'dead_letter' : 'queued', leaseUntilMs: 0, runAtMs: Date.now() + jobBackoffMs(job.attempts), lastError: cleanString(error?.message || String(error), 500), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await incrementMetric(terminal ? 'jobs_dead_letter' : 'jobs_failed');
      await recordOperationalEvent(terminal ? 'JOB_DEAD_LETTER' : 'JOB_RETRY_SCHEDULED', terminal ? 'critical' : 'warning', { jobId: job.jobId, type: job.type, attempts: String(job.attempts), error: error?.message || String(error) });
      failed++; if (terminal) dead++;
    }
  }
  return { processed, failed, dead };
}

const ALLOWED_ROLES = ['student', 'instructor', 'admin'];
const APPLICATION_STATUSES = ['draft', 'submitted', 'under_review', 'assessment', 'approved', 'rejected', 'waitlisted', 'withdrawn'];

const ROLE_PERMISSIONS = Object.freeze({
  admin: [
    'users.read', 'users.manage', 'roles.manage', 'admissions.manage', 'courses.manage',
    'courses.assets.manage', 'payments.read', 'payments.manage', 'certificates.manage',
    'notifications.manage', 'audit.read', 'security.read', 'security.manage',
    'observability.read', 'backups.manage', 'xp.manage', 'reports.read'
  ],
  instructor: [
    'courses.read', 'courses.manage.own', 'courses.assets.manage.own', 'students.read.own',
    'assignments.manage.own', 'grades.manage.own', 'exams.manage.own', 'payouts.read.own'
  ],
  student: [
    'profile.read.own', 'profile.manage.own', 'courses.read.published', 'enrollments.read.own',
    'enrollments.progress.own', 'exams.submit.own', 'certificates.read.own', 'notifications.read.own'
  ]
});
function normalizePermissions(value, role) {
  const defaults = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.student;
  const requested = Array.isArray(value) ? value.map(v => cleanString(v, 80)).filter(Boolean) : [];
  const allowed = new Set(defaults);
  return [...new Set(requested.filter(p => allowed.has(p)))];
}
function effectivePermissions(context, user) {
  const role = safeRole(user?.role || context.auth?.token?.role);
  const claimPermissions = Array.isArray(context.auth?.token?.permissions) ? context.auth.token.permissions : [];
  const defaults = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.student;
  return [...new Set([...defaults, ...claimPermissions.filter(p => typeof p === 'string')])];
}
async function requirePermission(context, permission, options = {}) {
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!user || user.status === 'disabled') throw new functions.https.HttpsError('permission-denied', 'Account access is disabled.');
  const permissions = effectivePermissions(context, user);
  if (!permissions.includes(permission)) {
    await recordSecurityEvent('AUTHORIZATION_DENIED', { permission, role: user.role || 'unknown', resourceType: options.resourceType || '', resourceId: options.resourceId || '' }, uid);
    await incrementMetric('authorization_denied');
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to perform this action.');
  }
  return { uid, user, permissions };
}
async function requireAdminPermission(context, permission, options = {}) {
  const actor = await requirePermission(context, permission, options);
  if (actor.user.role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  return actor;
}
async function setRoleAndPermissions(uid, role, permissions = []) {
  const safe = safeRole(role);
  const normalized = normalizePermissions(permissions, safe);
  await admin.auth().setCustomUserClaims(uid, { role: safe, permissions: normalized });
  await db.collection('users').doc(uid).set({ role: safe, permissions: normalized, authorizationVersion: 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return normalized;
}

const CAPABILITIES = Object.freeze({
  ADMIN_READ: 'admin.read',
  ADMIN_WRITE: 'admin.write',
  USER_MANAGE: 'users.manage',
  ADMISSION_MANAGE: 'admissions.manage',
  PAYMENT_MANAGE: 'payments.manage',
  CERTIFICATE_MANAGE: 'certificates.manage',
  NOTIFICATION_SEND: 'notifications.send',
  OBSERVABILITY_READ: 'observability.read',
  SECURITY_MANAGE: 'security.manage',
  INSTRUCTOR_COURSE_WRITE: 'courses.write.own',
  INSTRUCTOR_LEARNING_WRITE: 'learning.write.own',
});

const ROLE_CAPABILITIES = Object.freeze({
  admin: new Set(Object.values(CAPABILITIES)),
  instructor: new Set([CAPABILITIES.INSTRUCTOR_COURSE_WRITE, CAPABILITIES.INSTRUCTOR_LEARNING_WRITE]),
  student: new Set(),
});

function hasCapability(user, capability) {
  return Boolean(user && user.status !== 'disabled' && ROLE_CAPABILITIES[user.role]?.has(capability));
}

async function requireCapability(context, capability) {
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!hasCapability(user, capability)) {
    await recordSecurityEvent('AUTHORIZATION_DENIED', { capability, role: user?.role || 'unknown' }, uid);
    throw new functions.https.HttpsError('permission-denied', 'You are not authorized for this action.');
  }
  return { uid, user };
}

async function requireAdminCapability(context, capability, recent = false) {
  const actorUid = recent ? await requireRecentAdmin(context) : (await requireCapability(context, capability)).uid;
  const user = await getUser(actorUid);
  if (!hasCapability(user, capability)) {
    throw new functions.https.HttpsError('permission-denied', 'Required administrative capability is missing.');
  }
  return actorUid;
}

async function requireCourseInstructorOrAdmin(context, courseId, capability = CAPABILITIES.INSTRUCTOR_COURSE_WRITE) {
  const { uid, user } = await requireCapability(context, capability);
  if (user.role === 'admin') return { uid, user };
  const course = await db.collection('courses').doc(cleanString(courseId, 128)).get();
  if (!course.exists || course.data().instructorId !== uid) {
    await recordSecurityEvent('RESOURCE_AUTHORIZATION_DENIED', { capability, resourceType: 'course', resourceId: courseId }, uid);
    throw new functions.https.HttpsError('permission-denied', 'You do not own this course.');
  }
  return { uid, user };
}

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required.');
  return context.auth.uid;
}

async function getUser(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function requireAdmin(context) {
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!user || user.role !== 'admin' || user.status === 'disabled') {
    throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  }
  return uid;
}

async function requireRecentAdmin(context, maxAgeSeconds = 15 * 60) {
  const uid = await requireAdmin(context);
  const authTime = Number(context.auth?.token?.auth_time || 0);
  if (!authTime || Math.floor(Date.now() / 1000) - authTime > maxAgeSeconds) {
    await recordSecurityEvent('PRIVILEGED_ACTION_REAUTH_REQUIRED', { maxAgeSeconds }, uid);
    throw new functions.https.HttpsError('failed-precondition', 'Recent authentication is required for this privileged action. Please sign in again and retry.');
  }
  return uid;
}

function authProvider(context) {
  return cleanString(context.auth?.token?.firebase?.sign_in_provider || 'unknown', 60);
}

async function requireStaff(context) {
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!user || !['admin', 'instructor'].includes(user.role) || user.status === 'disabled') {
    throw new functions.https.HttpsError('permission-denied', 'Staff access required.');
  }
  return { uid, user };
}

async function audit(actorUid, action, resourceType, resourceId, metadata = {}, result = 'success') {
  const metaRef = db.collection('audit_integrity').doc('chain');
  const auditRef = db.collection('audit_logs').doc();
  await db.runTransaction(async tx => {
    const chainSnap = await tx.get(metaRef);
    const previous = chainSnap.exists ? chainSnap.data() : {};
    const sequence = Number(previous.sequence || 0) + 1;
    const prevHash = previous.hash || 'GENESIS';
    const canonical = JSON.stringify({ sequence, prevHash, actorUid, action, resourceType, resourceId: resourceId || null, metadata, result });
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');
    tx.set(auditRef, { actorUid, action, resourceType, resourceId: resourceId || null, metadata, result, sequence, prevHash, hash, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(metaRef, { sequence, hash, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
}

async function recordSecurityEvent(type, metadata = {}, actorUid = null) {
  const safe = Object.fromEntries(Object.entries(metadata || {}).slice(0, 20).map(([k, v]) => [cleanString(k, 80), cleanString(v, 300)]));
  await db.collection('security_events').add({ type: cleanString(type, 100), metadata: safe, actorUid: actorUid || null, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}

function cleanString(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function safeRole(role) {
  return ALLOWED_ROLES.includes(role) ? role : 'student';
}

function logOperationalError(error, context = {}) {
  console.error(JSON.stringify({ severity: 'ERROR', service: 'kboa-functions', message: error?.message || String(error), code: error?.code || null, ...context, timestamp: new Date().toISOString() }));
}

async function recordOperationalEvent(type, severity = 'info', metadata = {}, actorUid = null) {
  const safeMetadata = Object.fromEntries(Object.entries(metadata || {}).slice(0, 30).map(([k, v]) => [cleanString(k, 80), cleanString(v, 500)]));
  await db.collection('operational_events').add({ type: cleanString(type, 100), severity: ['info','warning','error','critical'].includes(severity) ? severity : 'info', metadata: safeMetadata, actorUid: actorUid || null, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}
async function incrementMetric(name, amount = 1) {
  const id = cleanString(name, 120).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!id) return;
  await db.collection('operational_metrics').doc(id).set({ name: id, value: admin.firestore.FieldValue.increment(Number(amount) || 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}
async function enforceRateLimit(uid, action, maxRequests, windowSeconds) {
  const key = crypto.createHash('sha256').update(`${uid}:${action}`).digest('hex').slice(0, 40);
  const ref = db.collection('rate_limits').doc(key); const now = Date.now();
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const data = snap.exists ? snap.data() : {};
    const windowStart = Number(data.windowStart || 0); const count = now - windowStart >= windowSeconds * 1000 ? 0 : Number(data.count || 0);
    if (count >= maxRequests) return { allowed: false, retryAfterSeconds: Math.ceil((windowSeconds * 1000 - (now - windowStart)) / 1000) };
    tx.set(ref, { uid, action, windowStart: count === 0 ? now : windowStart || now, count: count + 1, expiresAtMs: (count === 0 ? now : windowStart) + windowSeconds * 1000, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { allowed: true };
  });
  if (!result.allowed) {
    await incrementMetric(`ratelimit_${action}_blocked`);
    await recordSecurityEvent('RATE_LIMIT_BLOCKED', { action, retryAfterSeconds: result.retryAfterSeconds }, uid);
    throw new functions.https.HttpsError('resource-exhausted', `Too many ${action} requests. Try again later.`, { retryAfterSeconds: result.retryAfterSeconds });
  }
}
async function safeOperationalError(error, context = {}) { logOperationalError(error, context); await recordOperationalEvent(context.event || 'FUNCTION_ERROR', 'error', { code: error?.code || '', message: error?.message || String(error) }); }

async function generateStudentId(tx) {
  const year = new Date().getFullYear();
  for (let i = 0; i < 8; i += 1) {
    const suffix = Math.floor(10000 + Math.random() * 90000);
    const studentId = `KBOA-STU-${year}-${suffix}`;
    const snap = await tx.get(db.collection('users').where('studentId', '==', studentId).limit(1));
    if (snap.empty) return studentId;
  }
  throw new functions.https.HttpsError('aborted', 'Could not allocate a unique student ID.');
}



const ANALYTICS_EVENT_TYPES = Object.freeze(['page_view','course_view','course_search','enrollment','lesson_completed','exam_completed','certificate_issued','payment_completed','admission_submitted']);
const REPORT_PERIODS = Object.freeze(['7d','30d','90d']);

function safeAnalyticsType(value) {
  const type = cleanString(value, 60);
  if (!ANALYTICS_EVENT_TYPES.includes(type)) throw new functions.https.HttpsError('invalid-argument', 'Unsupported analytics event type.');
  return type;
}
function periodStart(period) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}
function tokenizeSearch(value) {
  return [...new Set(cleanString(value, 1000).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\s-]/g, ' ').split(/[\\s-]+/).filter(Boolean).slice(0, 30))];
}
async function recordAnalyticsEvent(uid, type, properties = {}) {
  const safeType = safeAnalyticsType(type);
  const day = new Date().toISOString().slice(0, 10);
  const safeProps = Object.fromEntries(Object.entries(properties || {}).slice(0, 15).map(([k,v]) => [cleanString(k,60), typeof v === 'string' ? cleanString(v,300) : Number.isFinite(v) ? v : String(v).slice(0,300)]));
  const ref = db.collection('analytics_daily').doc(`${day}_${safeType}`);
  await db.runTransaction(async tx => {
    tx.set(ref, { date: day, type: safeType, count: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  await db.collection('analytics_events').add({ uid: uid || null, type: safeType, properties: safeProps, date: day, createdAt: admin.firestore.FieldValue.serverTimestamp() });
}
async function rebuildCourseSearchIndex(limit = 100) {
  const snap = await db.collection('courses').limit(limit).get();
  let indexed = 0;
  for (const doc of snap.docs) {
    const c = doc.data() || {};
    const tokens = tokenizeSearch([c.title, c.description, c.category, c.instructorName].filter(Boolean).join(' '));
    await db.collection('course_search').doc(doc.id).set({ courseId: doc.id, title: cleanString(c.title || c.name || '', 200), description: cleanString(c.description || '', 500), category: cleanString(c.category || '', 100), status: cleanString(c.status || '', 30), tokens, price: Number(c.price || 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    indexed++;
  }
  return { indexed };
}
async function aggregateReport(period) {
  const startMs = periodStart(period);
  const start = new Date(startMs).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const snap = await db.collection('analytics_daily').where('date', '>=', start).where('date', '<=', end).limit(500).get();
  const byType = {};
  let total = 0;
  snap.forEach(doc => { const d = doc.data() || {}; const n = Number(d.count || 0); byType[d.type] = (byType[d.type] || 0) + n; total += n; });
  return { period, start, end, totalEvents: total, byType, generatedAt: new Date().toISOString() };
}

exports.trackAnalyticsEvent = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const meta = requestMeta(data, context);
  validatePayload(data, { allowed: ['type','properties','requestId'], fields: { type: { required: true, type: 'string' } } });
  await enforceRateLimit(uid, 'analytics_event', 120, 3600);
  await recordAnalyticsEvent(uid, data.type, data.properties || {});
  await incrementMetric(`analytics_${safeAnalyticsType(data.type)}`);
  return apiResponse({ success: true }, meta);
});

exports.searchCourses = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const query = cleanString(data?.query, 100);
  if (query.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Search query must contain at least 2 characters.');
  await enforceRateLimit(uid, 'course_search', 60, 300);
  const tokens = tokenizeSearch(query);
  const primary = tokens[0];
  const snap = await db.collection('course_search').where('status', '==', 'published').where('tokens', 'array-contains', primary).limit(30).get();
  const results = snap.docs.map(d => d.data()).filter(c => tokens.every(t => (c.tokens || []).includes(t))).slice(0, 20).map(c => ({ courseId: c.courseId, title: c.title, description: c.description, category: c.category, price: c.price }));
  await recordAnalyticsEvent(uid, 'course_search', { queryLength: query.length, resultCount: results.length });
  return { query, results };
});

exports.getAnalyticsReport = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'reports.read');
  const period = REPORT_PERIODS.includes(data?.period) ? data.period : '30d';
  const report = await aggregateReport(period);
  await audit(actor.uid, 'VIEW_ANALYTICS_REPORT', 'analytics', period, { totalEvents: report.totalEvents });
  return report;
});

exports.getOperationalReport = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'reports.read');
  const period = REPORT_PERIODS.includes(data?.period) ? data.period : '30d';
  const since = periodStart(period);
  const events = await db.collection('operational_events').where('createdAt', '>=', new Date(since)).orderBy('createdAt', 'desc').limit(200).get();
  const bySeverity = { info: 0, warning: 0, error: 0, critical: 0 };
  events.forEach(d => { const s = d.data()?.severity; if (bySeverity[s] !== undefined) bySeverity[s]++; });
  await audit(actor.uid, 'VIEW_OPERATIONAL_REPORT', 'operational_events', period, { count: events.size });
  return { period, eventCount: events.size, bySeverity, generatedAt: new Date().toISOString() };
});

exports.rebuildSearchIndex = functions.https.onCall(async (data, context) => {
  const actor = await requireRecentAdmin(context);
  const result = await rebuildCourseSearchIndex(Math.min(500, Math.max(1, Number(data?.limit || 100))));
  await audit(actor, 'REBUILD_COURSE_SEARCH_INDEX', 'course_search', 'batch', result);
  await incrementMetric('course_search_index_rebuilds');
  return result;
});

exports.scheduledAnalyticsMaintenance = onSchedule({ schedule: 'every 24 hours', timeZone: 'Africa/Lagos', retryCount: 2 }, async () => {
  const result = await rebuildCourseSearchIndex(500);
  await recordOperationalEvent('ANALYTICS_SEARCH_MAINTENANCE', 'info', result);
});

exports.getMyAuthorization = functions.https.onCall(async (data, context) => {
  const meta = requestMeta(data, context);
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!user || user.status === 'disabled') throw new functions.https.HttpsError('permission-denied', 'Account access is disabled.');
  return apiResponse({ role: safeRole(user.role), permissions: effectivePermissions(context, user), authorizationVersion: Number(user.authorizationVersion || 1) }, meta);
});

exports.setUserPermissions = functions.https.onCall(async (data, context) => {
  const actor = await requireRecentAdmin(context);
  const uid = cleanString(data?.uid, 128);
  const role = safeRole(data?.role);
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'User uid is required.');
  if (uid === actor) throw new functions.https.HttpsError('failed-precondition', 'Use role changes and deployment policy for your own administrator access.');
  const target = await getUser(uid);
  if (!target) throw new functions.https.HttpsError('not-found', 'User profile not found.');
  const permissions = normalizePermissions(data?.permissions, role);
  await setRoleAndPermissions(uid, role, permissions);
  await audit(actor, 'SET_USER_PERMISSIONS', 'user', uid, { role, permissions }, 'success');
  await recordSecurityEvent('USER_PERMISSIONS_CHANGED', { targetUid: uid, role, permissionCount: permissions.length }, actor);
  return { success: true, role, permissions };
});

exports.getStudentPortalAccess = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new functions.https.HttpsError('failed-precondition', 'Student profile is not initialized.');
  const profile = userSnap.data() || {};
  const token = await admin.auth().getUser(uid);
  const role = profile.role || token.customClaims?.role;
  if (role !== 'student') throw new functions.https.HttpsError('permission-denied', 'Student portal access is required.');
  if (profile.status !== 'active' || token.disabled) throw new functions.https.HttpsError('permission-denied', 'Student account is not active.');

  const enrollmentSnap = await db.collection('enrollments').where('studentId', '==', uid).limit(1).get();
  const paymentSnap = await db.collection('payments').where('studentId', '==', uid).where('status', '==', 'success').limit(1).get();
  const paid = !enrollmentSnap.empty || !paymentSnap.empty;
  return { allowed: paid, reason: paid ? 'paid_student' : 'payment_required', studentId: profile.studentId || null };
});

exports.createStudentProfile = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const fullName = cleanString(data?.fullName, 120);
  const phone = cleanString(data?.phone, 30);
  const country = cleanString(data?.country, 80);
  if (fullName.length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'fullName is required.');
  }

  const authUser = await admin.auth().getUser(uid);
  const userRef = db.collection('users').doc(uid);
  const existing = await userRef.get();
  if (existing.exists) return { success: true, studentId: existing.data().studentId || null, existing: true };

  const result = await db.runTransaction(async tx => {
    const studentId = await generateStudentId(tx);
    tx.set(userRef, {
      fullName,
      email: authUser.email || '',
      phone,
      country,
      studentId,
      role: 'student',
      status: 'active',
      enrolledCourses: [],
      completedCourses: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return studentId;
  });

  await setRoleAndPermissions(uid, 'student', []);
  await audit(uid, 'USER_PROFILE_CREATED', 'user', uid, { role: 'student' });
  return { success: true, studentId: result, existing: false };
});

exports.setUserRole = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'roles.manage')).uid;
  await requireRecentAdmin(context);
  const uid = cleanString(data?.uid, 128);
  const role = safeRole(data?.role);
  if (!uid || !ALLOWED_ROLES.includes(data?.role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid uid and role are required.');
  }
  if (uid === actorUid && role !== 'admin') {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot remove your own admin access.');
  }

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found.');

  await ref.update({ role, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await setRoleAndPermissions(uid, role, []);
  await audit(actorUid, 'USER_ROLE_CHANGED', 'user', uid, { role });
  return { success: true, uid, role };
});

exports.setUserStatus = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'users.manage')).uid;
  await requireRecentAdmin(context);
  const uid = cleanString(data?.uid, 128);
  const status = cleanString(data?.status, 30);
  if (!uid || !['active', 'disabled', 'pending'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid uid and status are required.');
  }
  if (uid === actorUid && status === 'disabled') {
    throw new functions.https.HttpsError('failed-precondition', 'You cannot disable your own account.');
  }
  await db.collection('users').doc(uid).update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await admin.auth().updateUser(uid, { disabled: status === 'disabled' });
  await audit(actorUid, 'USER_STATUS_CHANGED', 'user', uid, { status });
  return { success: true };
});

exports.createAdmissionApplication = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const meta = requestMeta(data, context);
  validatePayload(data, { allowed: ['programId','fullName','phone','statement','requestId','idempotencyKey'], fields: { programId: { required: true, type: 'string' }, fullName: { required: true, type: 'string' } } });
  await enforceRateLimit(uid, 'admission_submit', 5, 3600);
  const programId = cleanString(data?.programId, 160);
  const fullName = cleanString(data?.fullName, 120);
  const phone = cleanString(data?.phone, 30);
  const statement = cleanString(data?.statement, 2000);
  if (!programId || fullName.length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'programId and fullName are required.');
  }

  const existing = await db.collection('applications').where('applicantId', '==', uid).where('programId', '==', programId).where('status', 'in', ['draft', 'submitted', 'under_review', 'assessment', 'waitlisted']).limit(1).get();
  if (!existing.empty) return { success: true, applicationId: existing.docs[0].id, existing: true };

  const idem = await withIdempotency(uid, 'admission_submit', meta.idempotencyKey, async () => {
    const ref = db.collection('applications').doc();
    await ref.set({
      applicantId: uid,
      programId,
      fullName,
      phone,
      statement,
      status: 'submitted',
      requestId: meta.requestId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await audit(uid, 'APPLICATION_SUBMITTED', 'application', ref.id, { programId, requestId: meta.requestId });
    await incrementMetric('admissions_submitted');
    await recordOperationalEvent('ADMISSION_SUBMITTED', 'info', { requestId: meta.requestId, applicationId: ref.id }, uid);
    return { success: true, applicationId: ref.id, existing: false };
  });
  return apiResponse({ ...idem.response, replayed: idem.replayed }, meta);
});

exports.updateAdmissionApplication = functions.https.onCall(async (data, context) => {
  const actorUid = await requireAdmin(context);
  const applicationId = cleanString(data?.applicationId, 160);
  const status = cleanString(data?.status, 30);
  const reviewNote = cleanString(data?.reviewNote, 2000);
  if (!applicationId || !APPLICATION_STATUSES.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid applicationId and status are required.');
  }

  const ref = db.collection('applications').doc(applicationId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Application not found.');

  const update = { status, reviewNote, reviewedBy: actorUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (status === 'approved') update.approvedAt = admin.firestore.FieldValue.serverTimestamp();
  if (status === 'rejected') update.rejectedAt = admin.firestore.FieldValue.serverTimestamp();
  const applicantId = snap.data().applicantId;
  const eventId = crypto.createHash('sha256').update(`admission:${applicationId}:${status}:${snap.data().updatedAt?.toMillis?.() || Date.now()}`).digest('hex');
  await db.runTransaction(async tx => {
    tx.update(ref, update);
    tx.set(db.collection('event_outbox').doc(eventId), { eventId, type: 'admission.status_changed', aggregateType: 'application', aggregateId: applicationId, payload: { applicantId, status }, status: 'pending', attempts: 0, maxAttempts: EVENT_MAX_ATTEMPTS, runAtMs: Date.now(), leaseUntilMs: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await audit(actorUid, 'APPLICATION_STATUS_CHANGED', 'application', applicationId, { status, eventId });
  await incrementMetric('events_outbox_enqueued');
  return { success: true, eventId };
});

exports.awardXp = functions.https.onCall(async (data, context) => {
  const actor = await requireStaff(context);
  const meta = requestMeta(data, context);
  validatePayload(data, { allowed: ['uid','amount','eventType','requestId','idempotencyKey'] });
  await enforceRateLimit(actor.uid, 'xp_award', 100, 3600);
  const uid = cleanString(data?.uid, 128);
  const amount = Number(data?.amount);
  const eventType = cleanString(data?.eventType, 80);
  if (!uid || !Number.isInteger(amount) || amount <= 0 || amount > 1000 || !eventType) {
    throw new functions.https.HttpsError('invalid-argument', 'uid, positive XP amount and eventType are required.');
  }

  const userRef = db.collection('users').doc(uid);
  const xpRef = db.collection('user_xp').doc(uid);
  const eventRef = db.collection('xp_events').doc();
  const result = await db.runTransaction(async tx => {
    const xpSnap = await tx.get(xpRef);
    const current = xpSnap.exists ? Number(xpSnap.data().xp || 0) : 0;
    const next = current + amount;
    tx.set(xpRef, { xp: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(eventRef, { uid, amount, eventType, awardedBy: actor.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return next;
  });
  await audit(actor.uid, 'XP_AWARDED', 'user', uid, { amount, eventType, requestId: meta.requestId });
  return apiResponse({ success: true, xp: result }, meta);
});

exports.getAuditLogs = functions.https.onCall(async (data, context) => {
  await requireAdminPermission(context, 'audit.read');
  const limit = Math.min(Math.max(Number(data?.limit || 50), 1), 100);
  const snap = await db.collection('audit_logs').orderBy('createdAt', 'desc').limit(limit).get();
  return { logs: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});



function notificationPayload(title, body, type = 'system', data = {}) {
  return {
    title: cleanString(title, 120),
    body: cleanString(body, 1000),
    type: cleanString(type, 80) || 'system',
    data: Object.fromEntries(Object.entries(data || {}).slice(0, 20).map(([k,v]) => [cleanString(k,80), cleanString(v,500)])),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false
  };
}

exports.registerPushToken = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await enforceRateLimit(uid, 'push_token', 20, 3600);
  const token = cleanString(data?.token, 4096);
  const platform = cleanString(data?.platform, 40) || 'unknown';
  if (token.length < 20) throw new functions.https.HttpsError('invalid-argument', 'A valid push token is required.');
  const ref = db.collection('push_tokens').doc(crypto.createHash('sha256').update(token).digest('hex'));
  await ref.set({ uid, token, platform, active: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

exports.removePushToken = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const token = cleanString(data?.token, 4096);
  if (!token) throw new functions.https.HttpsError('invalid-argument', 'token is required.');
  const id = crypto.createHash('sha256').update(token).digest('hex');
  const ref = db.collection('push_tokens').doc(id);
  const snap = await ref.get();
  if (snap.exists && snap.data().uid === uid) await ref.update({ active: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

exports.getMyNotifications = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const limit = Math.min(Math.max(Number(data?.limit || 30), 1), 100);
  const snap = await db.collection('notifications').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(limit).get();
  return { notifications: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

exports.markNotificationRead = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const id = cleanString(data?.notificationId, 160);
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'notificationId is required.');
  const ref = db.collection('notifications').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().userId !== uid) throw new functions.https.HttpsError('not-found', 'Notification not found.');
  await ref.update({ read: true, readAt: admin.firestore.FieldValue.serverTimestamp() });
  return { success: true };
});

exports.sendNotification = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'notifications.manage')).uid;
  await enforceRateLimit(actorUid, 'notification_send', 100, 3600);
  const uid = cleanString(data?.uid, 128);
  const title = cleanString(data?.title, 120);
  const body = cleanString(data?.body, 1000);
  const type = cleanString(data?.type, 80) || 'system';
  if (!uid || title.length < 2 || body.length < 2) throw new functions.https.HttpsError('invalid-argument', 'uid, title and body are required.');
  const notificationRef = db.collection('notifications').doc();
  await notificationRef.set({ userId: uid, ...notificationPayload(title, body, type, data?.data || {}), createdBy: actorUid });
  const tokenSnap = await db.collection('push_tokens').where('uid', '==', uid).where('active', '==', true).limit(500).get();
  const tokens = tokenSnap.docs.map(d => d.data().token).filter(Boolean);
  let sent = 0;
  if (tokens.length) {
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.assign({ type }, Object.fromEntries(Object.entries(data?.data || {}).map(([k,v]) => [String(k), String(v)]))),
      android: { priority: 'high', notification: { channelId: 'kboa_default' } }
    });
    sent = response.successCount;
    const invalidCodes = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
    const batch = db.batch();
    response.responses.forEach((r, i) => { if (!r.success && invalidCodes.has(r.error?.code)) batch.update(tokenSnap.docs[i].ref, { active: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() }); });
    await batch.commit();
  }
  await audit(actorUid, 'NOTIFICATION_SENT', 'notification', notificationRef.id, { uid, type, sent });
  await incrementMetric('notifications_sent', sent || 0);
  return { success: true, notificationId: notificationRef.id, sent };
});

exports.reportClientError = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid || null;
  if (uid) await enforceRateLimit(uid, 'client_error', 30, 300);
  const message = cleanString(data?.message, 1000);
  const stack = cleanString(data?.stack, 5000);
  const page = cleanString(data?.page, 300);
  const severity = ['error', 'warning', 'fatal'].includes(data?.severity) ? data.severity : 'error';
  if (!message) throw new functions.https.HttpsError('invalid-argument', 'message is required.');
  console.error(JSON.stringify({
    severity: severity.toUpperCase(),
    service: 'kboa-web',
    event: 'CLIENT_ERROR',
    uid, message, stack, page, timestamp: new Date().toISOString()
  }));
  return { success: true };
});

exports.getMyXp = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const snap = await db.collection('user_xp').doc(uid).get();
  const events = await db.collection('xp_events').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(50).get();
  const xp = snap.exists ? Number(snap.data().xp || 0) : 0;
  return { xp, level: Math.floor(xp / 100) + 1, nextLevelXp: (Math.floor(xp / 100) + 1) * 100, events: events.docs.map(d => ({ id: d.id, ...d.data() })) };
});

// Existing production functions.

exports.getCourseAssetUrl = functions.https.onCall(async (data, context) => {
  const uid = await requireAuth(context);
  const courseId = cleanString(data?.courseId, 160);
  const assetPath = cleanString(data?.assetPath, 500);
  if (!courseId || !assetPath || assetPath.includes('..') || !assetPath.startsWith(`course-assets/${courseId}/`)) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid course asset path is required.');
  }
  const user = await getUser(uid);
  if (!user || user.status === 'disabled') throw new functions.https.HttpsError('permission-denied', 'Active account required.');
  const privileged = user.role === 'admin';
  if (user.role === 'instructor') {
    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists || courseSnap.data().instructorId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Instructor access to this course is required.');
    }
  } else if (!privileged) {
    const enrollment = await db.collection('enrollments')
      .where('studentId', '==', uid)
      .where('courseId', '==', courseId)
      .limit(1).get();
    if (enrollment.empty) throw new functions.https.HttpsError('permission-denied', 'Course enrollment is required.');
  }
  const bucket = admin.storage().bucket();
  const file = bucket.file(assetPath);
  const [exists] = await file.exists();
  if (!exists) throw new functions.https.HttpsError('not-found', 'Course asset not found.');
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000 });
  return { success: true, url, expiresInSeconds: 600 };
});

exports.getInstructorDashboard = functions.https.onCall(async (data, context) => {
  const { uid, user } = await requireStaff(context);
  const requestedInstructorId = cleanString(data?.instructorId, 128);
  const instructorId = user.role === 'admin' && requestedInstructorId ? requestedInstructorId : uid;
  const coursesSnap = await db.collection('courses').where('instructorId', '==', instructorId).limit(100).get();
  let enrollmentCount = 0;
  let assignmentCount = 0;
  for (const course of coursesSnap.docs.slice(0, 50)) {
    const [enrollments, assignments] = await Promise.all([
      db.collection('enrollments').where('courseId', '==', course.id).limit(500).get(),
      db.collection('assignments').where('courseId', '==', course.id).limit(200).get()
    ]);
    enrollmentCount += enrollments.size;
    assignmentCount += assignments.size;
  }
  return { instructorId, courseCount: coursesSnap.size, enrollmentCount, assignmentCount, generatedAt: new Date().toISOString() };
});

exports.apiV1 = functions.https.onRequest(async (req, res) => {
  const requestId = cleanString(req.get('x-request-id') || '', 120) || `req_${crypto.randomUUID()}`;
  res.set('X-KBOA-API-Version', API_VERSION);
  res.set('X-KBOA-Contract-Version', API_CONTRACT_VERSION);
  res.set('X-Request-Id', requestId);
  if (req.method !== 'GET') return res.status(405).json({ error: { code: 'method-not-allowed', message: 'GET required.' }, _meta: { apiVersion: API_VERSION, contractVersion: API_CONTRACT_VERSION, requestId } });
  return res.status(200).json(apiResponse({ service: 'kboa-api', status: 'ok', endpoints: ['GET /v1/health'] }, { requestId }));
});

exports.health = functions.https.onRequest((req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  return res.status(200).json({ ok: true, service: 'kboa-functions', timestamp: new Date().toISOString() });
});

async function commitSuccessfulPayment({ reference, courseId, studentId, paidAmount, currency = 'NGN', source = 'verify' }) {
  const paymentRef = db.collection('payments').doc(reference);
  let alreadyProcessed = false;
  let enrollmentCreated = false;
  await db.runTransaction(async tx => {
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists) { alreadyProcessed = true; return; }
    const enrollmentQuery = db.collection('enrollments').where('studentId', '==', studentId).where('courseId', '==', courseId).limit(1);
    const enrollmentSnap = await tx.get(enrollmentQuery);
    tx.create(paymentRef, { reference, courseId, studentId, amount: paidAmount, status: 'success', gateway: 'paystack', currency, source, paidAt: admin.firestore.FieldValue.serverTimestamp(), createdAt: admin.firestore.FieldValue.serverTimestamp() });
    if (enrollmentSnap.empty) {
      const enrollmentRef = db.collection('enrollments').doc();
      tx.create(enrollmentRef, { studentId, courseId, progress: 0, completedLessons: [], enrolledAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.update(db.collection('users').doc(studentId), { enrolledCourses: admin.firestore.FieldValue.arrayUnion(courseId), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      enrollmentCreated = true;
    }
  });
  return { alreadyProcessed, enrollmentCreated, paymentId: reference };
}

exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(503).send('Payment gateway is not configured');
  const signature = req.get('x-paystack-signature') || '';
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send('Invalid signature');
  try {
    const event = req.body || {};
    if (event.event !== 'charge.success') return res.status(200).send('Ignored');
    const transaction = event.data || {};
    const reference = cleanString(transaction.reference, 160);
    const email = cleanString(transaction.customer?.email, 200).toLowerCase();
    const metadata = transaction.metadata || {};
    const courseId = cleanString(metadata.course_id || metadata.courseId, 160);
    if (!reference || !email || !courseId) return res.status(400).send('Missing payment metadata');
    const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (userSnap.empty) return res.status(422).send('Student account not found');
    const studentId = userSnap.docs[0].id;
    const courseSnap = await db.collection('courses').doc(courseId).get();
    if (!courseSnap.exists || courseSnap.data().status !== 'published') return res.status(422).send('Course unavailable');
    const expectedAmount = Number(courseSnap.data().price || 0);
    const paidAmount = Number(transaction.amount || 0) / 100;
    if (transaction.currency && transaction.currency !== 'NGN') return res.status(422).send('Unsupported currency');
    if (Math.round(expectedAmount * 100) !== Math.round(paidAmount * 100)) return res.status(422).send('Amount mismatch');
    const result = await commitSuccessfulPayment({ reference, courseId, studentId, paidAmount, currency: transaction.currency || 'NGN', source: 'webhook' });
    if (result.alreadyProcessed) return res.status(200).send('Already processed');
    await audit(studentId, 'PAYMENT_WEBHOOK_PROCESSED', 'payment', reference, { reference, courseId, amount: paidAmount, idempotent: true });
    await incrementMetric('payments_webhook_processed');
    return res.status(200).send('OK');
  } catch (error) {
    await safeOperationalError(error, { event: 'PAYSTACK_WEBHOOK_ERROR' });
    return res.status(500).send('Webhook processing failed');
  }
});

exports.verifyPayment = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await enforceRateLimit(uid, 'payment_verify', 10, 600);
  const reference = cleanString(data?.reference, 160);
  const courseId = cleanString(data?.courseId, 160);
  if (!reference || !courseId) throw new functions.https.HttpsError('invalid-argument', 'reference and courseId are required.');
  const courseSnap = await db.collection('courses').doc(courseId).get();
  if (!courseSnap.exists || courseSnap.data().status !== 'published') throw new functions.https.HttpsError('not-found', 'Course not available.');
  const expectedAmount = Number(courseSnap.data().price || 0);
  if (!Number.isFinite(expectedAmount) || expectedAmount < 0) throw new functions.https.HttpsError('failed-precondition', 'Invalid course price.');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new functions.https.HttpsError('failed-precondition', 'Payment gateway is not configured.');
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const payload = await response.json();
  if (!response.ok || !payload.status || payload.data?.status !== 'success') return { success: false, message: 'Payment not confirmed by Paystack.' };
  if (payload.data?.customer?.email && context.auth.token.email && payload.data.customer.email.toLowerCase() !== context.auth.token.email.toLowerCase()) throw new functions.https.HttpsError('permission-denied', 'Payment customer does not match the signed-in account.');
  const paid = Number(payload.data.amount) / 100;
  if (Math.round(paid * 100) !== Math.round(expectedAmount * 100)) throw new functions.https.HttpsError('failed-precondition', 'Payment amount does not match the course price.');
  if ((payload.data.currency || 'NGN') !== 'NGN') throw new functions.https.HttpsError('failed-precondition', 'Unsupported payment currency.');
  const result = await commitSuccessfulPayment({ reference, courseId, studentId: uid, paidAmount: paid, currency: payload.data.currency || 'NGN', source: 'verify' });
  if (result.alreadyProcessed) return { success: true, message: 'Already processed.', idempotent: true };
  await audit(uid, 'PAYMENT_VERIFIED', 'payment', reference, { reference, courseId, amount: paid, idempotent: true });
  await incrementMetric('payments_verified');
  return { success: true, message: 'Payment verified and enrollment created.', idempotent: true };
});

exports.submitExamResult = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const meta = requestMeta(data, context);
  validatePayload(data, { allowed: ['examId','answers','requestId','idempotencyKey'], fields: { examId: { required: true, type: 'string' }, answers: { required: true, type: 'object' } } });
  await enforceRateLimit(uid, 'exam_submit', 10, 3600);
  const examId = cleanString(data?.examId, 160);
  const answers = data?.answers;
  if (!examId || !answers || typeof answers !== 'object' || Array.isArray(answers)) throw new functions.https.HttpsError('invalid-argument', 'examId and answers are required.');
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists || examSnap.data().status !== 'published') throw new functions.https.HttpsError('not-found', 'Exam is not available.');
  const exam = examSnap.data();
  if (exam.courseId) {
    const enrolled = await db.collection('enrollments').where('studentId', '==', uid).where('courseId', '==', exam.courseId).limit(1).get();
    if (enrolled.empty) throw new functions.https.HttpsError('permission-denied', 'You are not enrolled in this course.');
  }
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  if (!questions.length) throw new functions.https.HttpsError('failed-precondition', 'Exam has no questions.');
  const previous = await db.collection('exam_results').where('examId', '==', examId).where('studentId', '==', uid).limit(1).get();
  if (!previous.empty && exam.allowRetake !== true) return apiResponse({ resultId: previous.docs[0].id, existing: true, ...previous.docs[0].data() }, meta);
  const idem = await withIdempotency(uid, 'exam_submit', meta.idempotencyKey, async () => {
    let correct = 0;
    questions.forEach((q, index) => { if (answers[index] !== undefined && String(answers[index]) === String(q.correctAnswer)) correct += 1; });
    const percentage = Math.round((correct / questions.length) * 100);
    const passMark = Number(exam.passMark || 70);
    const passed = percentage >= passMark;
    const resultRef = db.collection('exam_results').doc();
    await resultRef.set({ examId, courseId: exam.courseId || '', studentId: uid, total: questions.length, correct, wrong: questions.length - correct, percentage, passed, passMark, requestId: meta.requestId, submittedAt: admin.firestore.FieldValue.serverTimestamp() });
    await audit(uid, 'EXAM_SUBMITTED', 'exam_result', resultRef.id, { examId, percentage, passed, requestId: meta.requestId });
    await incrementMetric(passed ? 'exams_passed' : 'exams_failed');
    return { resultId: resultRef.id, total: questions.length, correct, percentage, passed, passMark, idempotent: Boolean(meta.idempotencyKey) };
  });
  return apiResponse({ ...idem.response, replayed: idem.replayed }, meta);
});

exports.issueCertificate = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await enforceRateLimit(uid, 'certificate_issue', 5, 3600);
  const resultId = cleanString(data?.resultId, 160);
  if (!resultId) throw new functions.https.HttpsError('invalid-argument', 'resultId is required.');
  const resultSnap = await db.collection('exam_results').doc(resultId).get();
  if (!resultSnap.exists || resultSnap.data().studentId !== uid || resultSnap.data().passed !== true) throw new functions.https.HttpsError('permission-denied', 'A passed exam result is required.');
  const result = resultSnap.data();
  const existing = await db.collection('certificates').where('studentId', '==', uid).where('courseId', '==', result.courseId).limit(1).get();
  if (!existing.empty) return { certificateId: existing.docs[0].data().certificateId, existing: true };
  const user = await getUser(uid);
  const examSnap = await db.collection('exams').doc(result.examId).get();
  const exam = examSnap.exists ? examSnap.data() : {};
  const certificateId = `KBOA-${new Date().getFullYear()}-${resultRefToken()}`;
  await db.collection('certificates').doc(certificateId).set({ certificateId, studentId: uid, studentName: user?.fullName || 'Student', courseId: result.courseId || '', courseName: exam.courseName || exam.title || 'KBOA Course', score: result.percentage, completionDate: new Date().toISOString().slice(0, 10), issueDate: new Date().toISOString().slice(0, 10), status: 'valid', examResultId: resultId, verifyCount: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await audit(uid, 'CERTIFICATE_ISSUED', 'certificate', certificateId, { resultId, courseId: result.courseId });
  await incrementMetric('certificates_issued');
  return { certificateId, existing: false };
});

exports.verifyCertificate = functions.https.onCall(async (data) => {
  const certificateId = cleanString(data?.certificateId, 160);
  if (!certificateId) throw new functions.https.HttpsError('invalid-argument', 'certificateId is required.');
  const ref = db.collection('certificates').doc(certificateId);
  const snap = await ref.get();
  if (!snap.exists) return { valid: false };
  await ref.update({ verifyCount: admin.firestore.FieldValue.increment(1), lastVerified: admin.firestore.FieldValue.serverTimestamp() });
  const c = snap.data();
  return { valid: c.status === 'valid', certificateId: c.certificateId, studentName: c.studentName, courseName: c.courseName, score: c.score, issueDate: c.issueDate, completionDate: c.completionDate, status: c.status };
});


exports.setPaymentStatus = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'payments.manage')).uid;
  await requireRecentAdmin(context);
  const paymentId = cleanString(data?.paymentId, 160);
  const status = cleanString(data?.status, 30);
  if (!paymentId || !['success', 'pending', 'failed', 'refunded'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid paymentId and status are required.');
  }
  const ref = db.collection('payments').doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Payment not found.');
  if (status === 'refunded') throw new functions.https.HttpsError('failed-precondition', 'Use the refund workflow for refunds.');
  await ref.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await audit(actorUid, 'PAYMENT_STATUS_CHANGED', 'payment', paymentId, { status });
  return { success: true };
});


exports.adminIssueCertificate = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'certificates.manage')).uid;
  await requireRecentAdmin(context);
  let resultId = cleanString(data?.resultId, 160);
  const studentId = cleanString(data?.studentId, 128);
  const courseId = cleanString(data?.courseId, 160);

  if (!resultId && (!studentId || !courseId)) {
    throw new functions.https.HttpsError('invalid-argument', 'resultId or studentId/courseId is required.');
  }

  if (!resultId) {
    const results = await db.collection('exam_results')
      .where('studentId', '==', studentId)
      .where('courseId', '==', courseId)
      .where('passed', '==', true)
      .orderBy('submittedAt', 'desc')
      .limit(1).get();
    if (results.empty) throw new functions.https.HttpsError('failed-precondition', 'No passed exam result exists for this student and course.');
    resultId = results.docs[0].id;
  }

  const resultSnap = await db.collection('exam_results').doc(resultId).get();
  if (!resultSnap.exists || resultSnap.data().passed !== true) throw new functions.https.HttpsError('failed-precondition', 'A passed exam result is required.');
  const result = resultSnap.data();
  const existing = await db.collection('certificates').where('studentId', '==', result.studentId).where('courseId', '==', result.courseId).limit(1).get();
  if (!existing.empty) return { success: true, existing: true, certificateId: existing.docs[0].id };

  const user = await getUser(result.studentId);
  const examSnap = await db.collection('exams').doc(result.examId).get();
  const exam = examSnap.exists ? examSnap.data() : {};
  const certificateId = `KBOA-${new Date().getFullYear()}-${resultRefToken()}`;
  await db.collection('certificates').doc(certificateId).create({
    certificateId,
    studentId: result.studentId,
    studentName: user?.fullName || 'Student',
    courseId: result.courseId || '',
    courseName: exam.courseName || exam.title || 'KBOA Course',
    score: result.percentage,
    completionDate: new Date().toISOString().slice(0, 10),
    issueDate: new Date().toISOString().slice(0, 10),
    status: 'valid',
    examResultId: resultId,
    issuedBy: actorUid,
    issueMethod: 'admin',
    verifyCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await audit(actorUid, 'CERTIFICATE_ISSUED_BY_ADMIN', 'certificate', certificateId, { resultId, studentId: result.studentId, courseId: result.courseId });
  return { success: true, existing: false, certificateId };
});

exports.setCertificateStatus = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'certificates.manage')).uid;
  await requireRecentAdmin(context);
  const certificateId = cleanString(data?.certificateId, 160);
  const status = cleanString(data?.status, 30);
  const reason = cleanString(data?.reason, 1000);
  if (!certificateId || !['valid', 'revoked'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid certificateId and status are required.');
  }
  const ref = db.collection('certificates').doc(certificateId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Certificate not found.');
  await ref.update({ status, revokedReason: status === 'revoked' ? reason : admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await audit(actorUid, 'CERTIFICATE_STATUS_CHANGED', 'certificate', certificateId, { status, reason });
  return { success: true };
});

exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'users.manage')).uid;
  await requireRecentAdmin(context);
  const email = cleanString(data?.email, 200);
  const password = String(data?.password || '');
  const fullName = cleanString(data?.fullName, 120);
  const role = safeRole(data?.role);
  if (!email || password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !fullName) throw new functions.https.HttpsError('invalid-argument', 'email, fullName and a strong password (12+ chars with upper/lowercase and a number) are required.');
  const user = await admin.auth().createUser({ email, password, displayName: fullName });
  await db.collection('users').doc(user.uid).set({ fullName, email, phone: cleanString(data?.phone, 30), country: cleanString(data?.country, 80), role, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await setRoleAndPermissions(user.uid, role, []);
  await audit(actorUid, 'USER_CREATED', 'user', user.uid, { role, email });
  return { uid: user.uid };
});

exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  const actorUid = (await requireAdminPermission(context, 'users.manage')).uid;
  await requireRecentAdmin(context);
  const uid = cleanString(data?.uid, 128);
  if (!uid || uid === actorUid) throw new functions.https.HttpsError('invalid-argument', 'A valid non-self uid is required.');
  await admin.auth().deleteUser(uid);
  await db.collection('users').doc(uid).delete();
  await audit(actorUid, 'USER_DELETED', 'user', uid);
  return { success: true };
});

exports.refundPayment = functions.https.onCall(async (data, context) => {
  const meta = requestMeta(data, context);
  validatePayload(data, { allowed: ['paymentId','reference','requestId','idempotencyKey'] });
  const actorUid = (await requireAdminPermission(context, 'payments.manage')).uid;
  await requireRecentAdmin(context);
  const paymentId = cleanString(data?.paymentId, 160);
  const reference = cleanString(data?.reference, 160);
  if (!paymentId || !reference) throw new functions.https.HttpsError('invalid-argument', 'paymentId and reference are required.');
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new functions.https.HttpsError('failed-precondition', 'Payment gateway is not configured.');
  const paymentSnap = await db.collection('payments').doc(paymentId).get();
  if (!paymentSnap.exists || paymentSnap.data().reference !== reference) throw new functions.https.HttpsError('not-found', 'Payment record not found.');
  if (paymentSnap.data().status === 'refunded') return { success: true, alreadyRefunded: true };
  const res = await fetch('https://api.paystack.co/refund', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction: reference }) });
  const body = await res.json();
  if (!res.ok || !body.status) return { success: false, message: body.message || 'Refund failed.' };
  await db.collection('payments').doc(paymentId).update({ status: 'refunded', refundedAt: admin.firestore.FieldValue.serverTimestamp() });
  await audit(actorUid, 'PAYMENT_REFUNDED', 'payment', paymentId, { reference, requestId: meta.requestId });
  return apiResponse({ success: true }, meta);
});


exports.getMyAuthorization = functions.https.onCall(async (data, context) => {
  const { uid, user } = await requireAuthUser(context);
  return {
    uid,
    role: user.role,
    status: user.status,
    capabilities: [...(ROLE_CAPABILITIES[user.role] || [])],
    policyVersion: 'phase-15-v1',
  };
});

async function requireAuthUser(context) {
  const uid = requireAuth(context);
  const user = await getUser(uid);
  if (!user || user.status === 'disabled') {
    throw new functions.https.HttpsError('permission-denied', 'Active account required.');
  }
  return { uid, user };
}

function resultRefToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}


exports.getObservabilitySnapshot = functions.https.onCall(async (data, context) => {
  await requireAdminPermission(context, 'observability.read');
  const [metricsSnap, eventsSnap, rateSnap, backupSnap] = await Promise.all([
    db.collection('operational_metrics').orderBy('updatedAt', 'desc').limit(100).get(),
    db.collection('operational_events').orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('rate_limits').where('expiresAtMs', '>', Date.now()).limit(100).get(),
    db.collection('backup_verifications').doc('latest').get()
  ]);
  return { generatedAt: new Date().toISOString(), metrics: metricsSnap.docs.map(d => ({ id: d.id, ...d.data() })), recentEvents: eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })), activeRateLimits: rateSnap.size, backup: backupSnap.exists ? backupSnap.data() : { status: 'not_verified' } };
});

exports.recordBackupVerification = functions.https.onCall(async (data, context) => {
  const actorUid = await requireAdmin(context);
  const status = cleanString(data?.status, 30); const reference = cleanString(data?.reference, 300); const notes = cleanString(data?.notes, 1000);
  if (!['verified','failed'].includes(status) || !reference) throw new functions.https.HttpsError('invalid-argument', 'status and backup reference are required.');
  await db.collection('backup_verifications').doc('latest').set({ status, reference, notes, verifiedBy: actorUid, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });
  await recordOperationalEvent('BACKUP_VERIFICATION', status === 'verified' ? 'info' : 'critical', { reference, notes }, actorUid);
  return { success: true };
});

exports.recordRestoreDrill = functions.https.onCall(async (data, context) => {
  const actorUid = await requireAdmin(context);
  const status = cleanString(data?.status, 30);
  const reference = cleanString(data?.reference, 300);
  const notes = cleanString(data?.notes, 1000);
  const durationSeconds = Number(data?.durationSeconds || 0);
  if (!['passed', 'failed'].includes(status) || !reference || !Number.isFinite(durationSeconds) || durationSeconds < 0) throw new functions.https.HttpsError('invalid-argument', 'status, reference and valid durationSeconds are required.');
  const drillRef = db.collection('restore_drills').doc();
  await drillRef.set({ status, reference, notes, durationSeconds, verifiedBy: actorUid, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });
  await db.collection('backup_verifications').doc('latest').set({ restoreDrillStatus: status, restoreDrillReference: reference, restoreDrillAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await recordOperationalEvent('RESTORE_DRILL', status === 'passed' ? 'info' : 'critical', { reference, notes, durationSeconds }, actorUid);
  await incrementMetric(status === 'passed' ? 'restore_drills_passed' : 'restore_drills_failed');
  return { success: true, drillId: drillRef.id };
});

exports.getSecurityEvents = functions.https.onCall(async (data, context) => {
  await requireAdminPermission(context, 'security.read');
  const limit = Math.min(Math.max(Number(data?.limit || 50), 1), 100);
  const snap = await db.collection('security_events').orderBy('createdAt', 'desc').limit(limit).get();
  return { events: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

exports.verifyAuditIntegrity = functions.https.onCall(async (data, context) => {
  await requireAdminPermission(context, 'security.read');
  const limit = Math.min(Math.max(Number(data?.limit || 1000), 1), 5000);
  const snap = await db.collection('audit_logs').where('sequence', '>', 0).orderBy('sequence', 'asc').limit(limit).get();
  let expectedSequence = 1;
  let previousHash = 'GENESIS';
  let valid = true;
  let checked = 0;
  let failure = null;
  for (const doc of snap.docs) {
    const d = doc.data();
    const canonical = JSON.stringify({ sequence: d.sequence, prevHash: d.prevHash, actorUid: d.actorUid, action: d.action, resourceType: d.resourceType, resourceId: d.resourceId || null, metadata: d.metadata || {}, result: d.result || 'success' });
    const expectedHash = crypto.createHash('sha256').update(canonical).digest('hex');
    if (Number(d.sequence) !== expectedSequence || d.prevHash !== previousHash || d.hash !== expectedHash) {
      valid = false;
      failure = { id: doc.id, sequence: d.sequence, expectedSequence, reason: 'hash-chain-mismatch' };
      break;
    }
    previousHash = d.hash; expectedSequence += 1; checked += 1;
  }
  const chain = await db.collection('audit_integrity').doc('chain').get();
  const latestSequence = chain.exists ? Number(chain.data().sequence || 0) : 0;
  if (valid && latestSequence > checked && snap.size === limit) {
    return { valid: true, checked, truncated: true, latestSequence };
  }
  if (valid && latestSequence !== checked) { valid = false; failure = { reason: 'chain-length-mismatch', latestSequence, checked }; }
  await recordSecurityEvent(valid ? 'AUDIT_INTEGRITY_VERIFIED' : 'AUDIT_INTEGRITY_FAILED', { checked, latestSequence, failure: failure ? JSON.stringify(failure) : '' });
  await incrementMetric(valid ? 'audit_integrity_passed' : 'audit_integrity_failed');
  return { valid, checked, latestSequence, failure };
});

exports.registerSecuritySession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const sessionId = cleanString(data?.sessionId, 120);
  const userAgent = cleanString(data?.userAgent, 300);
  if (!sessionId) throw new functions.https.HttpsError('invalid-argument', 'sessionId is required.');
  await enforceRateLimit(uid, 'security-session', 20, 3600);
  const sessionRef = db.collection('security_sessions').doc(crypto.createHash('sha256').update(`${uid}:${sessionId}`).digest('hex').slice(0, 40));
  const snap = await sessionRef.get();
  const provider = authProvider(context);
  const authTime = Number(context.auth?.token?.auth_time || 0);
  const fingerprint = crypto.createHash('sha256').update(`${provider}|${userAgent}`).digest('hex').slice(0, 32);
  if (snap.exists && snap.data().fingerprint && snap.data().fingerprint !== fingerprint) {
    await recordSecurityEvent('SUSPICIOUS_SESSION_CHANGE', { provider, sessionId: sessionId.slice(0, 40) }, uid);
    await incrementMetric('suspicious_session_changes');
  }
  await sessionRef.set({ uid, provider, fingerprint, lastAuthTime: authTime || null, lastSeenAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000), active: true }, { merge: true });
  await db.collection('users').doc(uid).set({ lastSecurityCheckAt: admin.firestore.FieldValue.serverTimestamp(), lastAuthProvider: provider }, { merge: true });
  return { success: true, provider, authTime };
});

exports.getMySecurityStatus = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const userRecord = await admin.auth().getUser(uid);
  const factors = userRecord.multiFactor?.enrolledFactors || [];
  const user = await getUser(uid);
  return {
    uid,
    emailVerified: Boolean(userRecord.emailVerified),
    disabled: Boolean(userRecord.disabled),
    provider: authProvider(context),
    mfaEnabled: factors.length > 0,
    mfaFactors: factors.map(f => ({ uid: f.uid, displayName: f.displayName || null, factorId: f.factorId || 'phone' })),
    recentAuth: Boolean(context.auth?.token?.auth_time && Math.floor(Date.now() / 1000) - Number(context.auth.token.auth_time) <= 15 * 60),
    status: user?.status || 'unknown'
  };
});

exports.revokeMySessions = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  await enforceRateLimit(uid, 'revoke-sessions', 3, 3600);
  await admin.auth().revokeRefreshTokens(uid);
  await recordSecurityEvent('SELF_SESSION_REVOCATION', {}, uid);
  await audit(uid, 'SELF_SESSION_REVOCATION', 'user', uid, {}, 'success');
  return { success: true, message: 'All refresh tokens revoked. Sign in again on trusted devices.' };
});

exports.revokeUserSessions = functions.https.onCall(async (data, context) => {
  const actorUid = await requireRecentAdmin(context);
  const uid = cleanString(data?.uid, 128);
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'User uid is required.');
  await admin.auth().revokeRefreshTokens(uid);
  await recordSecurityEvent('ADMIN_SESSION_REVOCATION', { targetUid: uid }, actorUid);
  await audit(actorUid, 'REVOKE_USER_SESSIONS', 'user', uid, {}, 'success');
  return { success: true };
});


exports.enqueueJob = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'observability.read');
  const payload = validatePayload(data, { allowed: ['type','payload','runAtMs','idempotencyKey'], fields: { type: { required: true, type: 'string' }, payload: { type: 'object' } } });
  await enforceRateLimit(actor.uid, 'enqueue_job', 20, 60);
  const result = await enqueueJob(payload.type, payload.payload || {}, { runAtMs: payload.runAtMs, idempotencyKey: payload.idempotencyKey });
  await audit(actor.uid, 'ENQUEUE_JOB', 'job', result.jobId, { type: result.type }, 'success');
  return apiResponse({ success: true, ...result }, requestMeta(data, context));
});

exports.getEventOutbox = functions.https.onCall(async (data, context) => {
  await requireAdminPermission(context, 'observability.read');
  const limit = Math.min(Math.max(Number(data?.limit || 50), 1), 100);
  const snap = await db.collection('event_outbox').orderBy('createdAt', 'desc').limit(limit).get();
  return apiResponse({ events: snap.docs.map(d => ({ id: d.id, ...d.data() })) }, requestMeta(data, context));
});

exports.retryEvent = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'observability.read');
  const eventId = cleanString(data?.eventId, 160);
  if (!eventId) throw new functions.https.HttpsError('invalid-argument', 'eventId is required.');
  const ref = db.collection('event_outbox').doc(eventId); const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Event not found.');
  const event = snap.data() || {};
  if (!['failed','dead_letter'].includes(event.status)) throw new functions.https.HttpsError('failed-precondition', 'Only failed or dead-letter events can be retried.');
  await ref.update({ status: 'pending', runAtMs: Date.now(), leaseUntilMs: 0, lastError: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  await audit(actor.uid, 'EVENT_RETRIED', 'event_outbox', eventId, { type: event.type });
  return { success: true, eventId };
});

exports.getJobs = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'observability.read');
  const limit = Math.min(Math.max(Number(data?.limit || 25), 1), 100);
  const snap = await db.collection('jobs').orderBy('updatedAt','desc').limit(limit).get();
  return apiResponse({ jobs: snap.docs.map(d => ({ id: d.id, ...d.data() })) }, requestMeta(data, context));
});

exports.retryJob = functions.https.onCall(async (data, context) => {
  const actor = await requireAdminPermission(context, 'observability.read');
  const jobId = cleanString(data?.jobId, 128);
  if (!jobId) throw new functions.https.HttpsError('invalid-argument','jobId is required.');
  const ref = db.collection('jobs').doc(jobId);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); if (!snap.exists) throw new functions.https.HttpsError('not-found','Job not found.');
    const job = snap.data() || {};
    if (!['failed','dead_letter'].includes(job.status)) throw new functions.https.HttpsError('failed-precondition','Only failed or dead-letter jobs can be retried.');
    tx.update(ref, { status:'queued', attempts:0, runAtMs:Date.now(), leaseUntilMs:0, lastError:null, updatedAt:admin.firestore.FieldValue.serverTimestamp() });
  });
  await audit(actor.uid, 'RETRY_JOB', 'job', jobId, {}, 'success');
  await incrementMetric('jobs_manually_retried');
  return { success:true, jobId };
});

exports.scheduledEventWorker = onSchedule({ schedule: 'every 2 minutes', timeZone: 'Africa/Lagos', retryCount: 2 }, async () => {
  const result = await runEventOutbox(20);
  await recordOperationalEvent('EVENT_WORKER_RUN', result.dead ? 'critical' : 'info', result);
});

exports.processQueuedJobs = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Africa/Lagos', retryCount: 2 }, async () => {
  const result = await runQueuedJobs(10);
  await recordOperationalEvent('JOB_WORKER_RUN', result.dead ? 'critical' : 'info', result);
});

exports.scheduledReliabilityCheck = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Africa/Lagos', retryCount: 2 }, async () => {
  const started = Date.now();
  try {
    const [adminSnap, metricSnap, backupSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'admin').limit(1).get(),
      db.collection('operational_metrics').limit(1).get(),
      db.collection('backup_verifications').doc('latest').get()
    ]);
    const backupMs = backupSnap.exists && backupSnap.data().verifiedAt?.toMillis ? backupSnap.data().verifiedAt.toMillis() : 0;
    const checks = [{ name: 'admin_account', ok: !adminSnap.empty }, { name: 'firestore_access', ok: metricSnap !== null }, { name: 'backup_freshness', ok: backupMs > 0 && Date.now() - backupMs <= 26 * 60 * 60 * 1000 }];
    const failed = checks.filter(c => !c.ok);
    await incrementMetric(failed.length ? 'scheduled_checks_failed' : 'scheduled_checks_passed');
    await recordOperationalEvent('SCHEDULED_RELIABILITY_CHECK', failed.length ? 'critical' : 'info', { durationMs: Date.now() - started, checks: JSON.stringify(checks), failures: String(failed.length) });
    if (failed.length) await sendOperationalAlert('KBOA reliability check failed', { checks, generatedAt: new Date().toISOString() });
  } catch (error) {
    await safeOperationalError(error, { event: 'SCHEDULED_RELIABILITY_CHECK_ERROR' });
    await sendOperationalAlert('KBOA scheduled reliability check error', { message: error?.message || String(error) });
    throw error;
  }
});

async function sendOperationalAlert(title, payload) {
  const webhook = process.env.KBOA_ALERT_WEBHOOK_URL;
  if (!webhook) { await recordOperationalEvent('ALERT_NOT_DELIVERED', 'warning', { reason: 'KBOA_ALERT_WEBHOOK_URL not configured', title }); return false; }
  const dedupKey = crypto.createHash('sha256').update(`${title}:${JSON.stringify(payload)}`).digest('hex').slice(0, 32);
  const ref = db.collection('alert_dedup').doc(dedupKey); const existing = await ref.get();
  if (existing.exists && Date.now() - Number(existing.data().sentAtMs || 0) < 30 * 60 * 1000) return false;
  const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, source: 'kboa', severity: 'critical', payload }) });
  if (!response.ok) throw new Error(`Alert webhook failed with HTTP ${response.status}`);
  await ref.set({ sentAtMs: Date.now(), title, createdAt: admin.firestore.FieldValue.serverTimestamp() }); await incrementMetric('alerts_sent'); return true;
}
