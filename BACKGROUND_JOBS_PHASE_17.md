# KBOA Academy — Phase 17 Background Jobs & Workflow Orchestration

## Production design
- Firestore-backed durable jobs with explicit queued/processing/completed/failed/dead_letter states.
- Transactional job claiming prevents concurrent workers from processing the same job.
- Five-minute scheduled worker processes due jobs in bounded batches.
- Retry uses exponential backoff with a five-attempt ceiling and dead-letter state.
- Job leases expire after five minutes so interrupted workers can be reclaimed.
- Admin observability APIs support listing and manually retrying failed/dead-letter jobs.
- Idempotency keys can deduplicate enqueue requests.

## Production note
The worker is code/configuration only until deployed to Firebase. Scheduler execution, Firestore indexes, IAM, monitoring, and alert delivery must be verified in the target Firebase project.
