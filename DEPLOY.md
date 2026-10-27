# Deploy Guide — Vercel (Free) + Neon PostgreSQL (Free)

## What you need (all free):
1. **GitHub account** — to host your code
2. **Vercel account** — to host the website (sign up with GitHub)
3. **Neon account** — to host the database (sign up with GitHub)

---

## Step 1: Create a free database (2 minutes)

1. Go to **[neon.tech](https://neon.tech)** → Sign up with GitHub
2. Click **"Create Project"**
3. Name it `usacricketers`
4. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb`)
5. Save it somewhere — you'll need it in Step 3

## Step 2: Push your code to GitHub (3 minutes)

```bash
cd my-project

# Initialize git (if you haven't already)
git init
git add .
git commit -m "My cricket site"

# Create a new repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

If you don't have GitHub yet — sign up free at **[github.com](https://github.com)**, click **"New repository"**, name it `usacricketers`, leave it public, don't add any files. Then run the commands above.

## Step 3: Deploy on Vercel (2 minutes)

1. Go to **[vercel.com](https://vercel.com)** → sign up with GitHub
2. Click **"Add New Project"**
3. Find your `usacricketers` repository → click **"Import"**
4. Scroll down to **"Environment Variables"** — add these:

| Name | Value |
|---|---|
| `DATABASE_URL` | *(paste your Neon connection string from Step 1)* |
| `SCORER_SECRET` | *(any random string — type 20+ random characters)* |
| `INTERNAL_SECRET` | *(any random string — type 20+ random characters)* |
| `NEXT_PUBLIC_BASE_URL` | `https://your-project.vercel.app` *(you'll update this after first deploy)* |

5. Click **"Deploy"**

Vercel will build your site (takes 2-3 minutes). When it's done, you'll get a live URL like `usacricketers.vercel.app`.

## Step 4: Initialize the database (1 minute)

After the first deploy, your database is empty. You need to create the tables:

1. Go to **neon.tech** → your project → **SQL Editor**
2. Click **"Prisma"** in the sidebar → you can run migrations there
3. OR: install the Vercel CLI and run:
```bash
npm i -g vercel
vercel login
vercel link  # link to your project
vercel env pull .env  # pull your environment variables
npx prisma db push  # create all tables
npx prisma db seed  # seed with demo data (optional)
```

## Step 5: Visit your site 🎉

Open `https://your-project.vercel.app` in your browser.

**Admin login**: Click "Admin" in the header → email: `admin@usacricketers.test` / password: `admin123`

*(Change this password immediately after first login via the admin panel.)*

---

## What works on Vercel:
✅ All content management (articles, matches, players, teams, series, galleries, videos)
✅ Admin panel + dashboard
✅ Public site (home, news, matches, schedule, teams, players, stats)
✅ Scorecard display (completed matches)
✅ SEO (sitemap, RSS, OG images, meta tags)
✅ PWA (manifest, service worker)
✅ Banners + advertising
✅ Player comparison + timeline
✅ Bulk scheduling + player upload

## What doesn't work on Vercel:
❌ **Live scoring (WebSocket)** — Vercel doesn't support persistent WebSocket connections. To enable live scoring, add a separate VPS (Oracle Cloud free tier) running just the score-service, and point the `XTransformPort` / WebSocket URL to it. This is a future step — the site works perfectly without live scoring.

---

## After deployment:
1. **Change the admin password** — log in → Admin → (future: settings page) or via SQL: `UPDATE "SiteAdmin" SET passwordHash = '...' WHERE email = '...'`
2. **Add your domain** — in Vercel → Settings → Domains → add your GoDaddy domain
3. **Update NEXT_PUBLIC_BASE_URL** — set it to your custom domain (e.g. `https://usacricketers.com`)
4. **Add real content** — create real teams, players, matches, articles
