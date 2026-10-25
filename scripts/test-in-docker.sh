#!/usr/bin/env sh
# Builds the test image (docker/test/Dockerfile) and runs the tests in it.
# Arguments are Nx targets (default: test e2e). Playwright
# reports and traces end up in tmp/docker/playwright on the host.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
image=fotobox-test

DOCKER_BUILDKIT=1 docker build -f "$root/docker/test/Dockerfile" -t "$image" "$root"
mkdir -p "$root/tmp/docker/playwright"
exec docker run --rm --init \
  -v "$root/tmp/docker/playwright:/workspace/tmp/playwright" \
  "$image" "$@"
