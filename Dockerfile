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
RUN bun run prisma generate

# Copy the rest of the source
COPY . .

# Build the Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Install bun for the score-service mini-service
RUN npm install -g bun

# Copy standalone Next.js build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy the DB file (if it exists; the volume mount will override this)
COPY --from=builder /app/db ./db

# Copy prisma schema + generated client (the runtime Prisma CLIENT — used by
# the app's queries and by sync-db.js). The prisma CLI is NOT needed at
# runtime; sync-db.js uses the client's $executeRawUnsafe for schema fixups.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# DB schema fixup script — drops legacy columns on boot (idempotent).
COPY --from=builder /app/sync-db.js ./sync-db.js

# Copy the score-service mini-service
COPY --from=builder /app/mini-services ./mini-services

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose ports: 3000 = Next.js, 3003 = score-service
EXPOSE 3000 3003

# Copy the entrypoint script
COPY --from=builder /app/start-all.sh ./start-all.sh
RUN chmod +x ./start-all.sh

# Create the DB directory (volume mount point)
RUN mkdir -p /app/db

# Volume for persistent SQLite data
VOLUME ["/app/db"]

# Start both services
CMD ["./start-all.sh"]
