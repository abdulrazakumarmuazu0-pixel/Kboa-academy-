# KBOA Academy — Production Phase 19

## Scope
Production search, reporting, analytics aggregation, and data retention foundations.

## Analytics
- `trackAnalyticsEvent` records allow-listed product events.
- Raw analytics events are server-written; clients cannot read/write the collection directly.
- Daily counters in `analytics_daily` provide bounded aggregation for dashboards.
- Reports aggregate only bounded daily counters rather than scanning the entire event history.

## Search
- `course_search` is a server-maintained search index.
- Search tokenization is normalized and bounded.
- Published-course search is rate limited and returns a bounded result set.
- `rebuildSearchIndex` is admin-only and a daily scheduled maintenance job refreshes the index.

## Reports
- `getAnalyticsReport` provides 7d/30d/90d product event summaries.
- `getOperationalReport` provides bounded operational severity counts.
- Report access is audited and requires the `reports.view` capability.

## Retention
Raw analytics events are intentionally separated from daily aggregates. Production retention should be enforced with a managed TTL policy on `analytics_events.createdAt` and a documented export/retention schedule before launch.

## Production note
This phase adds application-level aggregation and search indexing. It does not claim that a managed Firestore TTL/export policy is already enabled in the deployed Firebase project.
