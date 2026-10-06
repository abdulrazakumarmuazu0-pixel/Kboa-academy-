# KBOA Academy — Phase 18 Event-Driven Architecture

## Production design
- `event_outbox` is a server-only transactional outbox.
- Admission status changes write the domain mutation and event in one Firestore transaction.
- `scheduledEventWorker` publishes pending events every 2 minutes.
- Consumers are idempotent: notification IDs derive from the event ID.
- Failed events use exponential backoff and become `dead_letter` after the retry budget.
- Admins can inspect and retry failed/dead-letter events.

## Operational requirements
- Deploy the scheduled worker with Firebase Scheduler/Cloud Scheduler enabled.
- Monitor `events_outbox_failed` and `events_outbox_dead_letter`.
- Review dead-letter events before retrying.
- Keep event payloads minimal and free of secrets.
- This phase does not claim delivery to external email/SMS providers; provider adapters can consume the same event contract later.
