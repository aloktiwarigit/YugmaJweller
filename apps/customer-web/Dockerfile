# Multi-stage build for Goldsmith customer-web (Next.js 14 / App Router / SSR).
# Targets Cloud Run with Next's `output: 'standalone'` bundle for a self-contained
# server.js + the slimmest possible runtime image.
#
# Mirrors apps/api/Dockerfile patterns: hoisted node_modules, monorepo workspace
# copy, dist patching for ts-source packages. See apps/api/Dockerfile for the
# reasoning behind each patch step.

# ── Base: pnpm + Node 20 ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ── Builder: install deps, compile customer-web ──────────────────────────────
FROM base AS builder
WORKDIR /repo

# NEXT_PUBLIC_* values must be present at build time because Next bakes them
# into the client bundle. Defaults are sane placeholders; Cloud Build passes
# real values via --build-arg.
ARG NEXT_PUBLIC_SHOP_SLUG=anchor-dev
ARG NEXT_PUBLIC_API_BASE=https://goldsmith-api-528920018833.asia-east1.run.app
ARG NEXT_PUBLIC_SITE_URL=https://goldsmith-customer-web.example.com
ARG API_URL=https://goldsmith-api-528920018833.asia-east1.run.app
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=

# NOTE: NODE_ENV is intentionally NOT set here. pnpm/npm both skip
# devDependencies when NODE_ENV=production, which would strip tailwindcss,
# postcss, autoprefixer, and the @types/* packages Next needs at build time.
# NODE_ENV=production is set only in the runtime stage below.
ENV NEXT_PUBLIC_SHOP_SLUG=$NEXT_PUBLIC_SHOP_SLUG \
    NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    API_URL=$API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_TELEMETRY_DISABLED=1

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json .npmrc* ./
COPY tsconfig.base.json tsconfig.json* ./
COPY packages/ packages/
COPY apps/customer-web/ apps/customer-web/

# Force a flat (non-symlinked) node_modules so Next's webpack resolver finds
# tailwindcss, postcss plugins, and `@/...` path-alias targets. The default
# pnpm `.pnpm/<hash>/...` symlinked layout breaks Next's CSS pipeline and
# can cascade into spurious "module not found" errors on path aliases.
# See CLAUDE.md Android section for the same lesson in customer-mobile.
RUN printf 'node-linker=hoisted\nshamefully-hoist=true\npublic-hoist-pattern[]=*\n' > .npmrc \
 && pnpm install --ignore-scripts

# Same tsconfig types[]=node patch as apps/api — avoids TS2688 from transitive
# @types/hapi__* packages that lack their own peer types. customer-web's
# tsconfig.json does NOT extend tsconfig.base.json, so we patch both.
RUN node -e " \
  const fs=require('fs'); \
  for (const f of ['tsconfig.base.json','apps/customer-web/tsconfig.json']) { \
    const t=JSON.parse(fs.readFileSync(f,'utf8')); \
    t.compilerOptions=t.compilerOptions||{}; \
    t.compilerOptions.types=['node']; \
    fs.writeFileSync(f,JSON.stringify(t,null,2)); \
    console.log('patched',f); \
  } \
"

# Build workspace packages that customer-web transpiles, then build Next.
RUN pnpm exec turbo run build --filter=@goldsmith/customer-web... 2>&1 || true
WORKDIR /repo/apps/customer-web
RUN pnpm exec next build

# ── Runtime: minimal Next standalone image ───────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S goldsmith && adduser -S web -G goldsmith

# Next's standalone output bundles only the files actually referenced by the
# server, plus a minimal node_modules. server.js is the entry point.
COPY --from=builder /repo/apps/customer-web/.next/standalone ./
COPY --from=builder /repo/apps/customer-web/.next/static ./apps/customer-web/.next/static
COPY --from=builder /repo/apps/customer-web/public ./apps/customer-web/public

RUN chown -R web:goldsmith /app
USER web

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

# In standalone mode, server.js lives at the workspace path so we cd to it.
WORKDIR /app/apps/customer-web

CMD ["node", "server.js"]
