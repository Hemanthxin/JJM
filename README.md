# JJM Dashboard — Next.js + Neon + Vercel

A React/Next.js port of the JJM SCSP/TSP dashboard with a login page and a Neon
Postgres database. Next.js handles both the UI and the API (route handlers), so
there is **no separate backend** to run.

## Stack
- **Next.js 14 (App Router)** — UI + API in one app
- **Neon Postgres** — stores the analysis data and the login users (`@neondatabase/serverless`)
- **Auth** — username/password (bcrypt) → signed JWT in an httpOnly cookie (`jose`); `middleware.ts` protects `/dashboard`
- **Charts** — Chart.js · **Map** — Leaflet

## 1. Create a Neon database
1. Sign up at https://neon.tech and create a project.
2. Copy the **pooled** connection string (Dashboard → Connection Details).

## 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
- `DATABASE_URL` — your Neon connection string
- `AUTH_SECRET` — a long random string (`openssl rand -base64 32`)
- `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` — the first login

## 3. Install & seed
```bash
npm install
npm run seed     # creates tables, loads scripts/dashboard_data.json, creates the admin user
```
> `npm run seed` reads `DATABASE_URL` from the environment. On Windows PowerShell:
> `$env:DATABASE_URL="postgres://..."; npm run seed`

To refresh the data later, regenerate `output_files/dashboard_data.json` (from the
Python builder), copy it to `scripts/dashboard_data.json`, and run `npm run seed` again.

## 4. Run locally
```bash
npm run dev
```
Open http://localhost:3000 → login with your seed credentials.

## 5. Deploy to Vercel
1. Push this folder to a Git repo (GitHub/GitLab).
2. On https://vercel.com → **New Project** → import the repo.
   - If `jjm-web` is a subfolder of a larger repo, set **Root Directory = jjm-web**.
3. Add Environment Variables in Vercel (Project → Settings → Environment Variables):
   - `DATABASE_URL`, `AUTH_SECRET` (and optionally the SEED_* vars)
4. Deploy. Then run the seed **once** against Neon (from your machine, with the
   production `DATABASE_URL`): `npm run seed`.
   - Or use Vercel's Neon integration (Storage tab) to attach the database automatically.

## Project layout
```
app/
  login/page.tsx            login UI
  dashboard/page.tsx        server component (auth + fetch data from Neon)
  dashboard/Dashboard.tsx   client dashboard (charts, map, ranking, comparative)
  api/auth/login            POST -> verify bcrypt, set JWT cookie
  api/auth/logout           POST -> clear cookie
lib/db.ts                   Neon client
lib/auth.ts                 JWT session helpers
lib/data.ts                 fetch analysis JSON
middleware.ts               protects /dashboard
scripts/seed.mjs            create tables + load data + admin user
public/kar_districts.json   Karnataka district geometry (heat map)
```

## Notes
- The dashboard data lives in the `analysis` table as a single JSONB row (same
  structure as `dashboard_data.json`). Swapping data is just a re-seed.
- To add users: insert into `users` with a bcrypt hash, or extend `seed.mjs`.
