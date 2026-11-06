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
# Set dummy DATABASE_URL + DIRECT_URL during build so prisma generate can
# validate the schema. Real values are set as runtime secrets on fly.io.
ENV DATABASE_URL=postgresql://dummy:dummy@dummy:5432/dummy
ENV DIRECT_URL=postgresql://dummy:dummy@dummy:5432/dummy
RUN bun run prisma generate

# Copy the rest of the source
COPY . .

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

# Copy standalone Next.js build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the DB file (if it exists; the volume mount will override this)
COPY --from=builder /app/db ./db

# Copy prisma schema + generated client (the runtime Prisma CLIENT — used by
# the app's queries and by sync-db.js). Also copy the prisma CLI for
# `prisma db push` on boot (creates tables in PostgreSQL).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# DB schema fixup script (legacy — only runs if sync-db.js exists)
COPY --from=builder /app/sync-db.js ./sync-db.js

# PostgreSQL migration script + data (runs on first boot to create tables +
# import existing data from SQLite)
COPY --from=builder /app/migrate-to-postgres.js ./migrate-to-postgres.js
COPY --from=builder /app/migration ./migration

# Copy the score-service mini-service
COPY --from=builder /app/mini-services ./mini-services

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
