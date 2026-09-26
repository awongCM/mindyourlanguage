# Neon Postgres setup (Phase 6)

Mind Your Language stores **cloud sync data** (users, history, phrasebook, review events) in [Neon](https://neon.tech) Postgres. The Next.js app runs on **Render**; Neon is **not** provisioned by `render.yaml`. You connect the two with `DATABASE_URL` and one-time SQL migrations from this repo.

The Neon project name (e.g. **mindyourlanguage-db**) is only for your Neon dashboard — the app does not read that name.

---

## Architecture

| Component | Where | Repo touchpoint |
|-----------|--------|-----------------|
| Web app | Render (`render.yaml` web service) | `npm run start`, `/api/health` |
| User data | Neon Postgres | `DATABASE_URL` + `db/migrations/*.sql` |
| Dictionary | SQLite on Render disk (build import) | `npm run import-cedict` — **not** in Neon |

Translate and dictionary work **without** Neon. Sign-in and sync APIs need `DATABASE_URL` plus Google OAuth env vars.

---

## 1. Create or open the Neon project

1. Sign in at [console.neon.tech](https://console.neon.tech).
2. Use your project (e.g. **mindyourlanguage-db**).
3. **Region:** prefer **AWS US West (Oregon)** (`aws-us-west-2`) to match Render Oregon in [`render.yaml`](../render.yaml).

---

## 2. Connection string

1. In Neon → **Connect**, choose **direct** connection (hostname **without** `-pooler`).
2. Copy the URL and ensure TLS is enabled, e.g.  
   `postgresql://USER:PASSWORD@ep-xxxx.us-west-2.aws.neon.tech/neondb?sslmode=require`

Do **not** use the PgBouncer pooler URL for this app unless you later hit connection limits (one Node process on Render uses a small pool in [`apps/web/lib/db.ts`](../apps/web/lib/db.ts)).

---

## 3. Apply migrations (once per database)

Migrations are **not** run during Render build. Apply them manually after creating the Neon database.

### Option A — npm script (recommended)

Requires Node 20+ and `npm ci` at repo root (uses the `pg` package from the workspace).

```bash
# From repo root — reads DATABASE_URL from the environment
export DATABASE_URL='postgresql://…?sslmode=require'
npm run db:migrate
```

If `DATABASE_URL` is unset, the script also checks `apps/web/.env.local` for a `DATABASE_URL=` line.

### Option B — psql

```bash
export DATABASE_URL='postgresql://…?sslmode=require'
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -f db/migrations/002_cloud_sync.sql
```

### Option C — Neon SQL Editor

Run the contents of each file in order:

1. [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql) — `users`, `translations`, `phrasebook`
2. [`db/migrations/002_cloud_sync.sql`](../db/migrations/002_cloud_sync.sql) — sync columns + `review_events`

Re-running is safe: migrations use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` where applicable.

---

## 4. Local development

```bash
cp apps/web/.env.example apps/web/.env.local
```

Set at minimum:

| Variable | Example / notes |
|----------|-------------------|
| `DEEPL_API_KEY` | Required for translate |
| `DATABASE_URL` | Neon **direct** URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |

Then:

```bash
npm run db:migrate   # if not already applied to this Neon branch/database
npm run dev
```

**Google OAuth (local):** In Google Cloud Console, add authorized redirect URI:

`http://localhost:3000/api/auth/callback/google`

---

## 5. Render production

1. Deploy from [`render.yaml`](../render.yaml) (web service only — no Render Postgres).
2. Render → **mindyourlanguage** → **Environment** → set secrets:

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Same Neon direct URL (or a dedicated Neon branch for prod) |
| `DEEPL_API_KEY` | DeepL |
| `AUTH_SECRET` | Strong random secret |
| `AUTH_URL` | Public URL, e.g. `https://your-service.onrender.com` |
| `AUTH_GOOGLE_ID` | Google OAuth |
| `AUTH_GOOGLE_SECRET` | Google OAuth |

3. Redeploy after saving env vars.

**Google OAuth (production):** Add redirect URI:

`https://your-service.onrender.com/api/auth/callback/google`

`/api/health` does **not** require `DATABASE_URL` to return 200 when CEDICT and DeepL are configured.

---

## 6. Verify sync

1. Open the app (local or Render).
2. **Sign in with Google** (header).
3. Save a phrasebook entry → **Sync now** (or wait for first-login sync).
4. In Neon **SQL Editor**:

```sql
SELECT count(*) FROM users;
SELECT count(*) FROM phrasebook;
```

Counts should increase after sync.

---

## 7. Optional cleanup

If an old **Render Postgres** instance exists from a previous Blueprint (`databases:` block), delete it after production uses Neon and `DATABASE_URL` on Render points to Neon.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Sync returns **501** | `DATABASE_URL` not set on server |
| Sync returns **503** | Neon unreachable, cold start timeout, or SQL error — check Render logs |
| Sign-in works but sync **401** | `session.user.id` missing — JWT/user row not created; check Neon connectivity during login |
| `npm run db:migrate` fails SSL | Add `?sslmode=require` to URL |
| First DB query slow after idle | Neon Free scale-to-zero (~5 min); normal on free tier |

---

## Related docs

- Phase 6 spec: [`docs/superpowers/specs/2026-07-19-phase-6-public-readiness-design.md`](superpowers/specs/2026-07-19-phase-6-public-readiness-design.md)
- Deploy overview: [README § Deploy (Render)](../README.md#deploy-render)
