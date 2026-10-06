#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required" >&2
  exit 1
fi
npx firebase-tools@13.35.1 emulators:exec --only functions,firestore,auth --project kboa-academy-production-test "node tests/emulator-smoke.js"
