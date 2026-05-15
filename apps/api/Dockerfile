# Multi-stage build for the Goldsmith NestJS API in a pnpm workspace monorepo.
# Final image: ~150MB, non-root user, no dev deps, no TypeScript toolchain.

# ── Base: pnpm + Node 20 (matches repo engines field) ────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ── Builder: install deps, compile API ───────────────────────────────────────
FROM base AS builder
WORKDIR /repo

# Workspace root manifests — changing these invalidates the install cache layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json .npmrc* ./

# Workspace package manifests (all needed for pnpm workspace resolution).
# Source + committed dist/ of each package are copied in the next step.
COPY packages/ packages/
COPY apps/api/ apps/api/

# Install all deps (dev included — needed for tsc).
RUN pnpm install --ignore-scripts

# Compile the API. Workspace package dist/ files are already present (committed),
# so only apps/api/src needs to be compiled by tsc.
WORKDIR /repo/apps/api
RUN pnpm run build

# Create a standalone production deployment:
#   - copies the package (including compiled dist/)
#   - installs production deps only (no devDependencies)
#   - correctly bundles workspace packages via their package.json#exports
WORKDIR /repo
RUN pnpm --filter @goldsmith/api deploy --prod /standalone

# ── Runtime: minimal image, non-root user ────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non-root user — security baseline
RUN addgroup -S goldsmith && adduser -S api -G goldsmith

# Copy the standalone deployment (node_modules + compiled dist + assets)
COPY --from=builder /standalone .

# Fix ownership before dropping to non-root
RUN chown -R api:goldsmith /app
USER api

# Cloud Run injects PORT; NestJS listens on 0.0.0.0 automatically (see main.ts)
EXPOSE 3000
ENV NODE_ENV=production PORT=3000

# Lightweight healthcheck — /health endpoint provided by NestJS TerminusModule
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
