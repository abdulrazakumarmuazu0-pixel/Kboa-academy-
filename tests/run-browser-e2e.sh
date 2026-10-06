#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${KBOA_E2E_PORT:-5000}"
npx firebase-tools@13.35.1 emulators:exec --only hosting --project kboa-academy-production-test "KBOA_BASE_URL=http://127.0.0.1:${PORT} node tests/e2e/browser-smoke.js"
