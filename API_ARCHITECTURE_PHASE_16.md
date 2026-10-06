# KBOA Academy — Production Phase 16

## API & Service Architecture

Phase 16 introduces a backward-compatible service contract layer around Firebase callable functions and a versioned HTTP API surface.

### Contract
- API version: `v1`
- Contract version: `phase-16-v1`
- Every Phase 16-aware callable may return `_meta.apiVersion`, `_meta.contractVersion`, and `_meta.requestId`.
- HTTP `apiV1` returns the same contract metadata and response headers.

### Correlation IDs
Clients may send `requestId`. If omitted, the backend generates a cryptographically random request ID. The ID is propagated into operational/audit metadata for supported workflows.

### Validation
`validatePayload()` rejects unsupported request fields on Phase 16-aware operations and validates required field types before business logic runs.

### Idempotency
Critical mutation workflows can accept `idempotencyKey`.
- Keys are scoped to authenticated user + operation.
- Keys are persisted server-side in `idempotency_keys`.
- Concurrent identical requests are rejected while the first request is processing.
- Completed responses can be replayed for a short TTL.
- Payment processing retains its Paystack-reference idempotency model.

### Service boundaries
The Functions layer is the trusted service boundary. Browser clients must not write operational, security, authorization, rate-limit, or idempotency records directly.

### HTTP API
The exported `apiV1` function exposes the versioned health contract. Additional HTTP endpoints should be added under this service boundary only after authentication, authorization, validation, rate limiting, and audit requirements are defined.

## Production Requirements

Before enabling external API consumers:
1. Require authenticated identity for protected endpoints.
2. Require explicit permission/capability checks.
3. Require request validation and bounded payload sizes.
4. Require idempotency for retryable financial or state-changing operations.
5. Propagate request/correlation IDs into logs and audit events.
6. Keep secrets server-side only.
7. Add contract tests before introducing a new endpoint version.

## Compatibility
Phase 16 does not remove existing callable names. Existing clients can continue using them while migrating to the standardized response metadata.
