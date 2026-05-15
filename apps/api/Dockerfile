# Multi-stage build for the Goldsmith NestJS API in a pnpm workspace monorepo.
# Skips pnpm deploy (it omits transitive deps from workspace packages).
# Instead: hoisted node_modules + compiled dist are copied directly to runtime.

# ── Base: pnpm + Node 20 ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ── Builder: install deps, compile API ───────────────────────────────────────
FROM base AS builder
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json .npmrc* ./
COPY tsconfig.base.json tsconfig.json* ./
COPY packages/ packages/
COPY apps/api/ apps/api/

# Hoist all packages so tsc resolves cross-workspace types.
# Also ensures all transitive production deps land in root node_modules/.
RUN echo "public-hoist-pattern[]=*" >> .npmrc && pnpm install --ignore-scripts

# Patch tsconfig.base.json to set types:["node"] so TypeScript doesn't
# auto-discover hoisted @types/hapi__* packages (which are transitively present
# but missing their own peer types — causes TS2688 across all package builds).
# This patch is Docker-build-only; it does not modify the committed tsconfig.
WORKDIR /repo
RUN node -e " \
  const fs=require('fs'); \
  const t=JSON.parse(fs.readFileSync('tsconfig.base.json','utf8')); \
  t.compilerOptions=t.compilerOptions||{}; \
  t.compilerOptions.types=['node']; \
  fs.writeFileSync('tsconfig.base.json',JSON.stringify(t,null,2)); \
  console.log('tsconfig.base.json patched: types=[\"node\"]'); \
"

# Build all workspace packages the API depends on (some have main:./src/index.ts
# and need compilation before Node.js can require() them at runtime),
# then build the API itself. Turbo handles dependency order automatically.
RUN pnpm exec turbo run build --filter=@goldsmith/api... 2>&1

# Patch workspace package.json files where main: points to TypeScript source.
# Pattern: ./src/index.ts compiles to ./dist/src/index.js (dist mirrors src tree).
# Only patches when the compiled file actually exists (i.e. package was built).
RUN node -e " \
  const fs = require('fs'); \
  fs.readdirSync('packages', {withFileTypes:true}) \
    .filter(e => e.isDirectory()) \
    .forEach(e => { \
      const f = 'packages/'+e.name+'/package.json'; \
      if (!fs.existsSync(f)) return; \
      const p = JSON.parse(fs.readFileSync(f,'utf8')); \
      if (!p.main || !p.main.endsWith('.ts')) return; \
      const rel = p.main.replace(/^\\.\\//,''); \
      const distPath = './dist/'+rel.replace(/\\.ts$/,'.js'); \
      const abs = 'packages/'+e.name+'/'+distPath.replace(/^\\.\\//,''); \
      if (fs.existsSync(abs)) { \
        console.log('patch', e.name, p.main, '->', distPath); \
        p.main = distPath; \
        fs.writeFileSync(f, JSON.stringify(p,null,2)); \
      } else { \
        console.log('skip', e.name, '(no', abs+')'); \
      } \
    }); \
"

# ── Runtime: minimal image, non-root user ────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S goldsmith && adduser -S api -G goldsmith

# Copy the compiled API output
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/assets ./assets

# Copy all hoisted node_modules (includes pg, drizzle, nestjs, etc.)
# This is larger than pnpm deploy but guaranteed to have all required packages.
COPY --from=builder /repo/node_modules ./node_modules

# Copy workspace package dist/ files (imported at runtime as @goldsmith/*)
COPY --from=builder /repo/packages ./packages

RUN chown -R api:goldsmith /app
USER api

EXPOSE 8080
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/main.js"]
