# KBOA Production Observability & Reliability

Phase 11 adds a production observability layer without exposing operational data to clients.

## Components
- `operational_metrics`: server-maintained counters.
- `operational_events`: immutable operational events/errors.
- `getObservabilitySnapshot`: admin-only dashboard API.
- `scheduledReliabilityCheck`: every 15 minutes in `Africa/Lagos`.
- `KBOA_ALERT_WEBHOOK_URL`: optional generic alert webhook.
- Alert deduplication: 30-minute suppression window.
- Transactional rate limiting on high-risk callable workflows.

## Alerting
Configure `KBOA_ALERT_WEBHOOK_URL` only in the Functions runtime secret/environment. Never put a webhook URL in frontend code.

## Rate limits
Limits are enforced server-side using Firestore transactions. Clients cannot read or mutate `rate_limits`.

## Important
Static checks prove configuration/code contracts only. They do not prove that Firebase, Cloud Scheduler, webhook delivery, or monitoring are live until deployed and exercised in the target project.
