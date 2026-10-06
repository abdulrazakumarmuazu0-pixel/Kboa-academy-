# KBOA Academy — Production Phase 8

Phase 8 establishes the deployment/payment security boundary and a deterministic end-to-end workflow contract suite.

## Added

- Runtime Paystack public-key configuration in `js/runtime-config.js`.
- Explicit test/live public-key environment boundary in the client checkout.
- No Paystack secret key in client JavaScript.
- `.env.example` documenting the server-only `PAYSTACK_SECRET_KEY`.
- Phase 8 static deployment/security gate.
- E2E workflow contract test covering admissions, payment webhook/verification, enrollment, exams, certificates, and protected course assets.
- Production test chain updated to include Phase 8 gates.

## Payment configuration

The browser only receives a Paystack **public** key. The Paystack **secret** key must be configured in Firebase Functions/Cloud Secret Manager or the supported server environment. Never put `sk_test_*` or `sk_live_*` into HTML, browser JavaScript, Git, or the public hosting directory.

For local test mode, set `environment: 'test'` and use a `pk_test_*` public key. For production, set `environment: 'production'` and use a `pk_live_*` public key.

## E2E execution

Run:

```bash
npm run test:e2e:contract
npm run test:phase8
npm run test:emulator
```

The contract suite is deterministic and does not require external services. The emulator suite requires Firebase CLI/emulators and may require Java/Node resources.

## Deployment gate

Before production deployment:

1. Configure server-only `PAYSTACK_SECRET_KEY`.
2. Configure a production `pk_live_*` public key in runtime configuration.
3. Run `npm run test:production`.
4. Run the Firebase Emulator suite in CI or a workstation with Firebase CLI installed.
5. Verify Paystack webhook URL points to the deployed `paystackWebhook` function.
6. Perform one controlled Paystack test/live transaction according to the gateway's current test-mode policy before enabling public checkout.
