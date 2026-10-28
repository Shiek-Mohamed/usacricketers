# Deployment Guide — usacricketers CMS

This document covers everything needed to take the project from the dev sandbox to production. Two deployment paths are documented below — pick the one that matches your needs.

| Path | Live scoring (socket.io) | Database | Effort | Cost | When to pick |
|---|---|---|---|---|---|
| **A — Docker on a VPS** (recommended) | ✅ Works | SQLite (file) | ~2-4 hrs | $5-20/mo | You need live match scoring |
| **B — Vercel + Neon Postgres** | ❌ Doesn't work | Postgres (managed) | ~1-2 hrs | Free tier | You don't need live scoring yet |

Path A is recommended because it preserves the socket.io mini-service (live scoring) and uses the existing `Dockerfile` + `Caddyfile` + `docker-compose.yml` already in the repo. Path B is simpler but breaks live scoring — Vercel doesn't support persistent WebSocket connections.

---

## Pre-deploy checklist (do this for both paths)

- [ ] Code is committed to a Git repository (GitHub, GitLab, or self-hosted)
- [ ] You have a domain name (e.g. `usacricketers.com`) with DNS control
- [ ] You have a Cloudflare account (free tier is enough)
- [ ] You have generated strong random secrets for `SCORER_SECRET` and `INTERNAL_SECRET` — use `openssl rand -hex 32` to generate them locally
- [ ] You have a Sentry account (free tier — for error monitoring; the `SENTRY_DSN` env var is already wired in `docker-compose.yml`)
- [ ] You know the admin email + password you'll use for the first login (default in dev is `admin@usacricketers.test` / `admin123` — **change this immediately after first deploy**)

### Generate secrets locally

```bash
# Generate two strong secrets — save these somewhere safe, you'll need them in deploy
echo "SCORER_SECRET=$(openssl rand -hex 32)"
echo "INTERNAL_SECRET=$(openssl rand -hex 32)"
```

---

## Path A — Docker on a VPS (recommended)

This path uses the existing `Dockerfile`, `Caddyfile`, and `docker-compose.yml` already in the repo. It runs Next.js (port 3000) and the score-service mini-service (port 3003) in a single Docker container, behind a Caddy reverse proxy that handles TLS + the `XTransformPort` gateway rule.

### Step A1 — Provision a server (15 min)

**Recommended providers** (any will work):
- **Hetzner Cloud** — best value ($5-7/mo for 2 vCPU, 4GB RAM, 40GB SSD). EU/US regions.
- **DigitalOcean** — $6/mo droplet (1 vCPU, 1GB RAM — too small; pick 2GB minimum). US regions.
- **Fly.io** — managed Docker hosting, no SSH required. Free tier covers small deployments.
- **Oracle Cloud Free Tier** — Always Free 4 ARM vCPU / 24GB RAM (overkill but free forever).

**Minimum specs**: 2 vCPU, 2GB RAM, 20GB SSD. The score-service + Next.js standalone together use ~400MB at idle, ~1.2GB under load.

**OS**: Ubuntu 22.04 LTS or 24.04 LTS (most documented, easiest to debug).

### Step A2 — Point DNS at the server (5 min)

In your domain registrar (or Cloudflare if you've delegated DNS):

```
A     @           <server_ip>      # root domain, e.g. usacricketers.com
A     www         <server_ip>      # www subdomain
```

If using Cloudflare:
1. Add your domain to Cloudflare (free tier)
2. Update nameservers at your registrar to Cloudflare's assigned nameservers
3. Add the A records above (Cloudflare will proxy them through its CDN — leave the orange cloud ON for DDoS protection)
4. Set SSL mode to **Full** (not Flexible — Flexible causes redirect loops with Caddy's TLS)

### Step A3 — SSH into the server and install prerequisites (10 min)

```bash
# SSH in (replace with your server IP)
ssh root@<server_ip>

# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose (official method)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install Caddy (for the reverse proxy / TLS termination)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Install git (for cloning the repo)
apt install -y git

# Create a non-root user for running the app (security best practice)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
```

### Step A4 — Clone the repo and set environment (5 min)

```bash
su - deploy
cd /home/deploy

# Clone your repo (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/usacricketers.git
cd usacricketers

# Create the .env file with your secrets
cat > .env << 'EOF'
# ─── Required secrets (use the values you generated in the pre-deploy step) ───
SCORER_SECRET=<paste your generated SCORER_SECRET>
INTERNAL_SECRET=<paste your generated INTERNAL_SECRET>

# ─── Database (SQLite file on disk) ───
DATABASE_URL=file:/app/db/custom.db

# ─── Optional monitoring ───
SENTRY_DSN=<paste your Sentry project DSN, or leave empty to disable>

# ─── Public base URL (update after first deploy with your real domain) ───
NEXT_PUBLIC_BASE_URL=https://usacricketers.com
EOF

chmod 600 .env  # protect secrets
```

### Step A5 — Build and start the Docker container (5 min)

```bash
# Build the image and start the container in detached mode
docker compose up --build -d

# Check that both services are running (you should see 2 processes inside the container)
docker compose logs -f --tail=50
```

You should see:
```
📦 Pushing Prisma schema to DB...
🏏 Starting score-service on port 3003...
🚀 Starting Next.js on port 3000...
```

Press `Ctrl+C` to exit the logs (the container keeps running).

### Step A6 — Configure Caddy as the reverse proxy with TLS (5 min)

Replace the default Caddyfile at `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste this configuration (replace `usacricketers.com` with your domain):

```caddy
usacricketers.com, www.usacricketers.com {
    # Route cross-service requests (socket.io score-service) via XTransformPort
    @transform_port_query {
        query XTransformPort=*
    }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort} {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }

    # All other traffic goes to the Next.js app
    handle {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
        }
    }
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
# Caddy will automatically request a Let's Encrypt TLS cert for your domain on first request
```

### Step A7 — Verify the deploy (5 min)

```bash
# From your local machine
curl -I https://usacricketers.com
# Should return: HTTP/2 200

# Open in a browser
open https://usacricketers.com
```

You should see the homepage. Click "VIDEOS" in the nav to verify the imported videos render. Click "Admin" → log in with `admin@usacricketers.test` / `admin123` → **immediately change the password**.

### Step A8 — Set up automated backups (10 min)

SQLite is a single file — back it up by copying it to off-box storage. **Litestream** is the easiest option (continuous replication to S3/R2).

```bash
# Install Litestream
sudo apt install -y litestream

# Create a Litestream config
sudo nano /etc/litestream.yml
```

Paste this (replace with your Cloudflare R2 or S3 bucket details):

```yaml
dbs:
  - path: /var/lib/docker/volumes/usacricketers_cricket-db/_data/custom.db
    replicas:
      - type: s3
        bucket: your-backup-bucket
        path: usacricketers-db
        region: auto
        endpoint: https://<account_id>.r2.cloudflarestorage.com
        access-key-id: <R2_ACCESS_KEY>
        secret-access-key: <R2_SECRET_KEY>
        sync-interval: 1s
```

```bash
sudo systemctl enable --now litestream
```

Litestream will continuously stream SQLite changes to R2 every second. To restore from a backup:

```bash
litestream restore -o restored.db s3://your-backup-bucket/usacricketers-db
```

---

## Path B — Vercel + Neon Postgres (only if you don't need live scoring)

**Important**: This path requires migrating from SQLite to PostgreSQL. The Prisma schema is portable, but you'll need to handle the JSON-in-String fields (currently stored as `String` for SQLite compatibility) — they become `Json` columns automatically when you switch providers.

### Step B1 — Migrate Prisma from SQLite to Postgres (15 min)

In `prisma/schema.prisma`, change the datasource provider:

```prisma
datasource db {
  provider = "postgresql"   // was: "sqlite"
  url      = env("DATABASE_URL")
}
```

Then run:

```bash
bun install
bun run db:generate
# Don't run db:push yet — wait until DATABASE_URL points at Neon
```

### Step B2 — Create a free Postgres database on Neon (2 min)

1. Go to **[neon.tech](https://neon.tech)** → Sign up with GitHub
2. Click **"Create Project"** → name it `usacricketers`
3. Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

### Step B3 — Push code to GitHub (3 min)

```bash
cd my-project

git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com first (don't add any files), then:
git remote add origin https://github.com/YOUR_USERNAME/usacricketers.git
git branch -M main
git push -u origin main
```

### Step B4 — Deploy on Vercel (5 min)

1. Go to **[vercel.com](https://vercel.com)** → sign up with GitHub
2. Click **"Add New Project"** → find your `usacricketers` repo → click **"Import"**
3. Scroll down to **"Environment Variables"** — add these:

| Name | Value |
|---|---|
| `DATABASE_URL` | *(paste your Neon connection string from Step B2)* |
| `SCORER_SECRET` | *(your generated 32-char hex string)* |
| `INTERNAL_SECRET` | *(your generated 32-char hex string)* |
| `NEXT_PUBLIC_BASE_URL` | `https://your-project.vercel.app` (update after first deploy with your real domain) |
| `SENTRY_DSN` | *(your Sentry DSN, or leave empty)* |

4. Click **"Deploy"** — Vercel builds for 2-3 minutes

### Step B5 — Initialize the database (1 min)

The Neon database is empty. Create the tables:

```bash
# Locally, pull the Vercel env vars
npm i -g vercel
vercel login
vercel link  # link to your project
vercel env pull .env

# Push the schema to Neon
bun run db:push

# Optional: seed with demo data
bun run prisma db seed
```

### Step B6 — Add your custom domain (5 min)

1. In Vercel → Settings → Domains → add `usacricketers.com`
2. Vercel shows you DNS records to add at your registrar (or Cloudflare) — add them
3. Wait 5-10 min for DNS propagation
4. Update `NEXT_PUBLIC_BASE_URL` env var in Vercel to `https://usacricketers.com`

### Step B7 — Verify the deploy

Open `https://usacricketers.com` — confirm the homepage renders, videos load, admin login works.

**Live scoring on this path**: ❌ Doesn't work. Vercel doesn't support persistent WebSocket connections. The site works fine without live scoring (you can still enter scores after the fact via the admin panel), but real-time ball-by-ball updates during a match won't function. If you need live scoring later, migrate to Path A.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path (`file:/app/db/custom.db`) for Path A, or Postgres connection string for Path B |
| `SCORER_SECRET` | Yes | Random 32-char hex string — signs scorer auth tokens |
| `INTERNAL_SECRET` | Yes | Random 32-char hex string — signs internal admin cookies |
| `NEXT_PUBLIC_BASE_URL` | Yes (for production) | Public URL of the site (e.g. `https://usacricketers.com`) — used for SEO canonical URLs, OG images, sitemap |
| `SENTRY_DSN` | Optional | Sentry project DSN — enables error monitoring |
| `REDIS_URL` | Optional (Stage 2 scaling) | Redis connection string — used by the score-service for multi-instance fanout |

---

## Cloudflare setup (recommended for both paths)

Putting Cloudflare in front of your site (free tier) gives you:
- ~70% reduction in origin traffic (CDN caches static assets + ISR pages)
- DDoS protection (cricket sites get attacked during matches)
- Free SSL + HTTP/3
- A foundation for Stage 1 scaling (Workers, R2, Cache Reserve all build on this)

### Setup

1. Add your domain to Cloudflare (free)
2. Update nameservers at your registrar to Cloudflare's
3. Set SSL/TLS mode to **Full** (not Flexible — Flexible breaks Caddy's TLS in Path A)
4. Enable these free features:
   - **Always Online** (serves cached pages if origin is down)
   - **Auto Minify** (HTML/CSS/JS — modest perf gain)
   - **Brotli** compression
5. Add a page rule: `*usacricketers.com/*` → Cache Level: "Everything" (Cloudflare will respect cache headers from Next.js)

---

## Post-deploy verification checklist (do this regardless of path)

- [ ] Homepage loads at `https://usacricketers.com` (HTTP 200, no console errors)
- [ ] Navigate to VIDEOS — verify all 46 videos render with thumbnails
- [ ] Click into one video — verify the YouTube iframe plays
- [ ] Navigate to MATCHES — verify the live/completed/upcoming filters work
- [ ] Click "Admin" in the header → log in → **change the admin password immediately**
- [ ] In admin, verify you can create/edit a Team, Player, Match, Article
- [ ] Test the live scoring flow if on Path A: log in as a scorer → push a ball event → verify the public scorecard updates in real time
- [ ] Run `curl -I https://usacricketers.com/sitemap.xml` → should return HTTP 200
- [ ] Check Sentry dashboard — confirm no errors are flowing in
- [ ] Verify backups (Path A): trigger a Litestream backup test, confirm the replica shows in R2

---

## Rollback procedure

### Path A (Docker)

```bash
# Find the previous image tag (Docker keeps recent images)
docker images

# Roll back to the previous image
docker compose down
docker tag usacricketers_app:previous usacricketers_app:latest
docker compose up -d

# If the database schema was migrated and you need to roll back data too:
docker compose down
litestream restore -o /var/lib/docker/volumes/usacricketers_cricket-db/_data/custom.db s3://your-backup-bucket/usacricketers-db
docker compose up -d
```

### Path B (Vercel)

1. In Vercel → your project → **"Deployments"**
2. Find the previous good deployment → click the `⋯` menu → **"Promote to Production"**
3. The rollback is instant

For database rollbacks on Neon: use the Neon console → "Time Travel" → restore to a timestamp before the bad migration.

---

## Runbook — common incidents + resolution

| Symptom | Likely cause | Fix |
|---|---|---|
| Site returns 502/503 | Caddy can't reach the Next.js process | `docker compose ps` → check if app is running. If not, `docker compose up -d`. If crashing, `docker compose logs --tail=100` to see why. |
| Live scorecard not updating | Score-service (port 3003) is down | `docker compose exec app bash` → `ps aux \| grep score` → confirm `bun index.ts` is running inside the container. If not, restart the container. |
| "Database is locked" errors in logs | SQLite write contention under load | Acceptable in dev. If in prod at high load, it's time for Stage 2 (migrate to Postgres). |
| Admin login fails after deploy | Default password was changed OR `INTERNAL_SECRET` mismatch | Check `docker compose exec app env \| grep INTERNAL_SECRET` — must match what was set during deploy. |
| Site is up but videos don't load | YouTube iframe blocked by CSP, OR oEmbed thumbnails blocked | Check browser console for CSP errors. Allow `img.youtube.com` and `i.ytimg.com` in your CSP. |
| TLS cert expired | Caddy didn't auto-renew (rare) | `sudo systemctl restart caddy` — it'll re-request on next request. |
| Sentry shows spike in errors | New deploy introduced a bug | Check Sentry for the specific error. If critical, roll back (see above). |

---

## When to scale (pointer to the scaling ladder)

The current setup (single Docker container + SQLite + Caddy + Cloudflare free tier) handles:

- **~1K-5K visits/day** comfortably
- **~5-10 simultaneous live matches** with scorer events (SQLite write contention is the limit)
- **~200 concurrent viewers** on a single live scorecard (single Next.js process event loop is the limit)

When you cross these thresholds, refer to the scaling ladder (Stage 1 / Stage 2 / Stage 3). The triggers to watch:

| Metric | Threshold | Action |
|---|---|---|
| P95 latency on `/api/matches/[id]` | > 200ms | Move to Stage 1 (Cloudflare cache tuning, ISR for completed matches) |
| SQLite "database is locked" errors in logs | > 1 per day | Move to Stage 2 (migrate to Postgres + Redis) |
| Concurrent connections to Next.js process | > 200 | Spin up 2nd Docker instance behind Caddy load balancer |
| Memory RSS of the container | > 1.5GB | Right-size the box (2GB → 4GB) |

See the scaling roadmap (in the conversation history) for the full Stage 1/2/3 plan. Don't pre-scale — wait until you have actual traffic data to validate which bottleneck you hit first.

---

## Maintenance: keeping the deploy healthy

### Weekly (5 min)

- Check Sentry for new errors → triage any
- Check Litestream backup health: `litestream generations` should show recent replicas
- Check disk space on the server: `df -h` — the SQLite file grows slowly, but Docker image layers can pile up

### Monthly (15 min)

- Update dependencies: `bun update` → run `bun run lint` → run `bun run dev` to verify locally → commit → redeploy
- Update the server OS: `apt update && apt upgrade -y`
- Review Cloudflare analytics: cache hit ratio should be > 80%; if not, investigate which URLs are bypassing cache

### Before a big match (10 min)

- Verify the score-service is running: `docker compose exec app ps aux | grep bun`
- Verify Litestream is replicating: `litestream generations`
- Notify the on-call maintainer (Role 1 freelancer) that a match is happening
- Pre-warm Cloudflare cache by running `curl https://usacricketers.com/matches` once

---

## Next steps after first deploy

1. **Change the admin password** (already in checklist — non-negotiable)
2. **Update `NEXT_PUBLIC_BASE_URL`** to your real domain
3. **Set up the on-call maintainer freelancer** (Role 1 — see the freelancer hiring plan)
4. **Submit sitemap to Google Search Console** at `https://usacricketers.com/sitemap.xml`
5. **Verify SEO meta tags** are rendering (use the "Inspect" tool in Search Console)
6. **Add real content** — replace any demo content with real teams, players, matches, articles
7. **Set up uptime monitoring** — Uptime Robot (free) pinging `https://usacricketers.com` every 5 min
8. **Document this deploy in `worklog.md`** so the next person knows what was done (the worklog discipline applies to ops work too, not just code changes)

---

## Quick reference — file inventory for deployment

| File | Purpose | Path |
|---|---|---|
| `Dockerfile` | Multi-stage build (Node 22 + Bun, Next.js standalone + score-service) | `/Dockerfile` |
| `Caddyfile` (dev) | Gateway config used by the dev sandbox — single port `:81`, routes `XTransformPort=N` to `localhost:N` | `/Caddyfile` |
| `docker-compose.yml` | Production compose — single service, exposes 3000+3003, mounts `/app/db` as a volume for SQLite persistence | `/docker-compose.yml` |
| `start-all.sh` | Entrypoint inside the container — runs `prisma db push` + score-service + Next.js concurrently | `/start-all.sh` |
| `start-score-service.sh` | Local-dev wrapper that auto-restarts the score-service on exit | `/start-score-service.sh` |
| `start-dev.sh` | Local dev convenience script (used by `bun run dev`) | `/start-dev.sh` |
| `.env` | Your secrets (NOT in git — add to `.gitignore`) | `/.env` |
| `prisma/schema.prisma` | Database schema — change `provider` for SQLite ↔ Postgres migration | `/prisma/schema.prisma` |
| `scripts/import-usacricketers-videos.ts` | Re-runnable video importer from usacricketers.com | `/scripts/import-usacricketers-videos.ts` |

---

Questions or issues during deploy — refer to the **Runbook** section above first, then check `worklog.md` for prior context, then escalate to the deployment freelancer (Role 2 in the hiring plan).
