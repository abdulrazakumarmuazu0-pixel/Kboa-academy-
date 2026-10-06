#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
npx firebase-tools@13.35.1 emulators:exec --only auth,firestore,storage --project kboa-academy-production-test "node tests/rules-emulator.js"
