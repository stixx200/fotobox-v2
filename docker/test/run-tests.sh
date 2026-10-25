#!/usr/bin/env sh
# Entry point of the test image: runs the given Nx targets for every project
# that has them (the Tauri host needs Rust and is tested by the desktop CI job).
set -eu
targets=$(echo "$@" | tr ' ' ',')
exec pnpm exec nx run-many -t "${targets:-test,e2e}" \
  --exclude=fotobox-tauri --output-style=static
