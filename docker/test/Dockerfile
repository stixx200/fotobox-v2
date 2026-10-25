# Test runner image: unit, integration and e2e tests in a clean Linux
# environment (Chromium from the Playwright base image, Node 24, pnpm).
#
#   scripts/test-in-docker.sh            # build the image and run all tests
#   scripts/test-in-docker.sh e2e        # only some targets
#
# The base image tag must match @playwright/test in pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

# The base image ships Node 24 (like CI) and corepack; pnpm's version comes
# from packageManager in package.json.
RUN corepack enable pnpm

ENV CI=1 \
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  NX_DAEMON=false \
  NX_NO_CLOUD=true \
  NX_TUI=false \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /workspace

# Dependencies first, so source changes reuse this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts/postinstall.mjs scripts/
RUN --mount=type=cache,id=fotobox-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY . .

# Targets to run; override with `docker run … <targets>`.
ENTRYPOINT ["docker/test/run-tests.sh"]
CMD ["test", "e2e"]
