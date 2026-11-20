# ─── Build stage ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy lockfile + package.json first for layer caching
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

# Copy prisma schema + generate client
COPY prisma ./prisma
# Swap the datasource provider from sqlite -> postgresql for the production
# build. The local dev schema uses sqlite (sandbox has no Postgres), but
# production runs on Fly.io Postgres. Without this swap, prisma generate
# produces a SQLite client that rejects the postgres:// DATABASE_URL at
# runtime with "the URL must start with the protocol file:" (HTTP 500 on
# every API route). Only matches the datasource block — the generator block's
# provider is "prisma-client-js", so it is left untouched.
RUN sed -i 's/provider *= *"sqlite"/provider = "postgresql"/' prisma/schema.prisma
# Add directUrl (non-pooled) so `prisma db push` on boot can run DDL against
# the prod Postgres. Without it, db push tries DDL over the pooled DATABASE_URL
# and silently fails — new tables/columns never get created on deploy.
RUN sed -i '/url *= *env("DATABASE_URL")/a\  directUrl = env("DIRECT_URL")' prisma/schema.prisma
# Set dummy DATABASE_URL + DIRECT_URL during build so prisma generate can
# validate the schema. Real values are set as runtime secrets on fly.io.
ENV DATABASE_URL=postgresql://dummy:dummy@dummy:5432/dummy
ENV DIRECT_URL=postgresql://dummy:dummy@dummy:5432/dummy
# Set NEXT_PUBLIC_BASE_URL at build time so it's baked into the client bundle
# correctly. Without this, the fallback (localhost:3000) gets baked in and
# OG images / canonical URLs / sitemap all point to localhost in production.
ENV NEXT_PUBLIC_BASE_URL=https://usacricketers.com
RUN bun run prisma generate

# Copy the rest of the source
COPY . .

# Re-apply the postgres provider swap + directUrl insertion. `COPY . .` above
# clobbers the sed-modified prisma/schema.prisma (from the builder stage above)
# with the host's dev sqlite version. Without this re-sed, the runtime schema
# has provider="sqlite", so the boot `prisma db push` fails with "the URL must
# start with the protocol file:" (sqlite provider + postgres DATABASE_URL) and
# schema migrations never reach prod Postgres.
RUN sed -i 's/provider *= *"sqlite"/provider = "postgresql"/' prisma/schema.prisma && \
    sed -i '/url *= *env("DATABASE_URL")/a\  directUrl = env("DIRECT_URL")' prisma/schema.prisma

# Build the Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Install bun for the score-service mini-service + OpenSSL for Prisma + Caddy
# for the gateway (routes WebSocket traffic to the score-service on port 3003).
# Without OpenSSL, Prisma falls back to a wrong query-engine binary and
# mishandles DateTime serialization (Inconsistent column data errors).
# Without Caddy, the score-service (port 3003) is unreachable from the public
# URL — live scoring doesn't work.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && \
    curl -sL "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz" | tar -xz -C /usr/bin caddy && \
    rm -rf /var/lib/apt/lists/*
RUN npm install -g bun

# Install cheerio for the HTML-scraping import scripts (post importer, etc.)
# The standalone build doesn't include cheerio, so we install it separately.
RUN cd /app && npm install cheerio --no-save

# Copy standalone Next.js build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the DB file (if it exists; the volume mount will override this)
COPY --from=builder /app/db ./db

# Copy prisma schema + generated client engine (the runtime Prisma CLIENT —
# used by the app's queries). The @prisma/client package code is already
# bundled into the Next.js standalone output; .prisma holds the query-engine
# binary which standalone doesn't bundle.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Install the prisma CLI fresh with its FULL dependency tree (effect, c12,
# deepmerge-ts, empathic + all transitives). The previous selective copy of
# node_modules/prisma + node_modules/@prisma missed these external deps,
# causing "Cannot find module 'effect'" on boot — so `prisma db push` never
# ran and schema changes (new columns) never reached prod Postgres. Installing
# prisma@6.19.2 (matching the builder's resolved version) lets npm resolve the
# entire tree so the boot `prisma db push --accept-data-loss` in start-all.sh
# actually applies the schema.
RUN cd /app && npm install prisma@6.19.2 --no-save

# DB schema fixup script (legacy — only runs if sync-db.js exists)
COPY --from=builder /app/sync-db.js ./sync-db.js

# PostgreSQL migration script + data (runs on first boot to create tables +
# import existing data from SQLite)
COPY --from=builder /app/migrate-to-postgres.js ./migrate-to-postgres.js
COPY --from=builder /app/migration ./migration

# Raw-SQL schema fallback — guarantees the Penalty table exists on boot even
# if `prisma db push` fails to apply DDL (pooled connection / npx hiccup).
# Idempotent + non-fatal. Runs by start-all.sh after prisma db push.
COPY --from=builder /app/ensure-schema.js ./ensure-schema.js

# Copy the score-service mini-service
COPY --from=builder /app/mini-services ./mini-services

# Copy utility scripts (scraper, image fixer, match cleanup) — runnable on
# the VM via `flyctl ssh console -C "cd /app && bun run scripts/..."`
COPY --from=builder /app/scripts ./scripts

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose ports: 3000 = Next.js, 3003 = score-service
EXPOSE 3000 3003

# Copy the entrypoint script + Caddyfile for the gateway
COPY --from=builder /app/start-all.sh ./start-all.sh
COPY Caddyfile.fly ./Caddyfile
RUN chmod +x ./start-all.sh

# Create the DB directory (volume mount point)
RUN mkdir -p /app/db

# Volume for persistent SQLite data
VOLUME ["/app/db"]

# Expose ports: 8080 = Caddy gateway (fly internal_port), 3000 = Next.js, 3003 = score-service
EXPOSE 8080 3000 3003
# Start all services (Caddy gateway + Next.js + score-service)
CMD ["./start-all.sh"]
