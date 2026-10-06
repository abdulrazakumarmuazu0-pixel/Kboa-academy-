# API Migration Guide — Phase 16

## Existing clients
Existing KBOA callable functions remain available. No forced client migration is required.

## Recommended request metadata
For retryable mutations, send:

- `requestId`: client-generated tracing identifier
- `idempotencyKey`: stable unique key for one intended mutation

Example shape:

```json
{
  "requestId": "mobile-8f1c...",
  "idempotencyKey": "admission-2026-000123",
  "programId": "program-id",
  "fullName": "Student Name"
}
```

Never reuse an idempotency key for a different business operation.

## Versioning
Phase 16 establishes `v1` / `phase-16-v1`. Breaking changes should use a new contract version rather than silently changing field semantics.
