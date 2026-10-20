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

Migrations are **not** run during the Render build (see [`render.yaml`](../render.yaml)). Apply them after creating the Neon database.

### Option A — GitHub Actions (recommended without Render Shell)

Free Render tiers do not include a persistent shell, so use the workflow in [`.github/workflows/neon-db-migrate.yml`](../.github/workflows/neon-db-migrate.yml):

1. Add repository secret **`DATABASE_URL`** (same Neon direct URL as Render, with `?sslmode=require`).
2. GitHub → **Actions** → **Neon database migrate** → **Run workflow**.

The workflow also runs automatically on pushes to `main` that change `db/migrations/` or `scripts/run-migrations.ts`. Re-running is safe (idempotent SQL).

### Option B — npm script (local or any machine with Node)

Requires Node 20+ and `npm ci` at repo root (uses the `pg` package from the workspace).

```bash
# From repo root — reads DATABASE_URL from the environment
export DATABASE_URL='postgresql://…?sslmode=require'
npm run db:migrate
```

If `DATABASE_URL` is unset, the script also checks `apps/web/.env.local` for a `DATABASE_URL=` line.

### Option C — psql

```bash
export DATABASE_URL='postgresql://…?sslmode=require'
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -f db/migrations/002_cloud_sync.sql
psql "$DATABASE_URL" -f db/migrations/003_anon_users.sql
psql "$DATABASE_URL" -f db/migrations/004_phrasebook_drop_translation_fk.sql
```

### Option D — Neon SQL Editor

Run the contents of each file in order:

1. [`db/migrations/001_initial.sql`](../db/migrations/001_initial.sql) — `users`, `translations`, `phrasebook`
2. [`db/migrations/002_cloud_sync.sql`](../db/migrations/002_cloud_sync.sql) — sync columns + `review_events`
3. [`db/migrations/003_anon_users.sql`](../db/migrations/003_anon_users.sql) — `users.anon_token_hash` for anonymous browser identity
4. [`db/migrations/004_phrasebook_drop_translation_fk.sql`](../db/migrations/004_phrasebook_drop_translation_fk.sql) — drops the phrasebook → translations foreign key so history trims no longer delete saved phrases

Re-running is safe: migrations use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` where applicable.

---

## 4. Local development

### Local-only (no Neon yet)

Use this while you are still on translate + `localStorage` only. Neon and Google OAuth can wait until Render deployment.

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable | Local-only |
|----------|------------|
| `DEEPL_API_KEY` | **Required** — paste your DeepL key |
| `AUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_GOOGLE_AUTH` | `false` (hides sign-in until OAuth + Neon are ready) |
| `DATABASE_URL` | Leave empty |
| `AUTH_GOOGLE_*` | Leave empty |

```bash
npm run dev
```

Translate, history, phrasebook (browser), and practice work without Neon. The header hides **Sign in with Google** until you flip `NEXT_PUBLIC_GOOGLE_AUTH=true`.

### Full Phase 6 local (Neon + Google)

Set at minimum:

| Variable | Example / notes |
|----------|-------------------|
| `DEEPL_API_KEY` | Required for translate |
| `DATABASE_URL` | Neon **direct** URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `http://localhost:3000` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_GOOGLE_AUTH` | `true` |

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

## 8. Anonymous browser persistence (no sign-in)

The app can keep each browser's history, phrasebook, and practice data in Neon **without Google sign-in**.

- The server sets an httpOnly `myl_anon` cookie the first time that browser saves something. Only a SHA-256 hash of its token is stored (`users.anon_token_hash`, migration `003`). Reads (GET) with no cookie create nothing and return an empty list.
- On load the page pulls that browser's rows from Neon, merges them with browser storage, and shows the newest translation again. After changes it pushes quietly in the background about 2 seconds later. Pushes add or update rows, and delete only rows this browser saw on the server and then removed locally. A failed or empty first load never deletes cloud rows.
- A signed-in Google session, if present, takes precedence over the cookie identity.
- Clearing cookies or opening another browser starts an empty Neon user. Old rows stay in Neon and are not linked.
- With `DATABASE_URL` unset the sync routes return `501` and the app stays browser-only, skipping sync silently with no errors shown. The page still restores the newest history entry on refresh from browser storage.
- **Limits** (constants in [`apps/web/lib/sync/limits.ts`](../apps/web/lib/sync/limits.ts)) protect Neon Free's 0.5 GB: request bodies up to 5 MB; 200 history items, 2,000 phrasebook items, 2,000 `deletedIds` and 1,000 review events per request; at most 2,000 phrasebook rows per user; and the newest 5,000 review events kept per user (older ones are trimmed). A sync over a limit gets `413 Payload too large`, which the app logs quietly in the browser console (background sync) or shows as the usual sync error toast ("Sync now").

**Render setup for this mode:** apply migrations 001–004, then set only `DATABASE_URL` (Neon direct URL, `sslmode=require`). Keep `AUTH_SECRET` and `AUTH_URL` as they are. `NEXT_PUBLIC_GOOGLE_AUTH` and the Google OAuth variables are not needed.

**Verify:** save a phrase, reload, and confirm History, Phrasebook, and the last translation return. In the Neon SQL editor:

```sql
SELECT count(*) FROM users WHERE anon_token_hash IS NOT NULL;
SELECT count(*) FROM phrasebook;
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Sync returns **501** | `DATABASE_URL` not set on server |
| Sync returns **503** | Neon unreachable, cold start timeout, or SQL error — check Render logs |
| Signed-in data lands in an anonymous user | `session.user.id` missing (JWT/user row not created); check Neon connectivity during login |
| `npm run db:migrate` fails SSL | Add `?sslmode=require` to URL |
| First DB query slow after idle | Neon Free scale-to-zero (~5 min); normal on free tier |

---

## Related docs

- Phase 6 spec: [`docs/superpowers/specs/2026-07-19-phase-6-public-readiness-design.md`](superpowers/specs/2026-07-19-phase-6-public-readiness-design.md)
- Deploy overview: [README § Deploy (Render)](../README.md#deploy-render)
