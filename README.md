# נחיתה רכה — Soft Landing Moving Assistant

A calm, Hebrew (RTL) web app that turns moving to Tel Aviv into a clear, trackable checklist.
Users sign in with Google, browse a knowledge base of moving tasks and rights/benefits grouped by
category, set a status on each item (7 fixed statuses), add personal notes, and watch their overall
progress.

## Stack

| Layer      | Tech                                              |
| ---------- | ------------------------------------------------- |
| Frontend   | React + Vite + Tailwind (`/frontend`)             |
| Backend    | FastAPI / Python (`/backend`)                     |
| Data/Auth  | Supabase (Postgres + Google OAuth)                |
| Deploy     | Railway (single integrated service)               |

Data flow: **React → FastAPI → Supabase**. The frontend uses Supabase only for Google login and to
hold the session token; every data request goes through FastAPI, which verifies the Supabase JWT.

## Project layout

```
frontend/                 React app (Stitch "Soft Landing" design)
backend/                  FastAPI API + serves the built frontend in production
supabase/migrations/      SQL schema (0001 knowledge base, 0002 user tracking)
scripts/                  TypeScript scrapers that populate the knowledge base
nixpacks.toml, railway.json   Railway build/start config
```

## Database

The Supabase project already contains the scraped knowledge base: `cities`, `rights_items`,
`moving_tasks`, `scrape_log`. Migration **`0002_user_tracking.sql`** adds the per-user layer:

- `profiles` — one row per user (auto-created from Google name/email on sign-up).
- `user_item_status` — a user's status / notes / next-action for each item. RLS restricts every row
  to its owner (`auth.uid() = user_id`).

The 7 allowed statuses (spec §5): `לא התחיל`, `בבדיקה`, `בטיפול`, `הושלם`, `לא רלוונטי`,
`דורש בדיקה`, `ממתין לגורם חיצוני`.

> The seeded items currently have `verified = false`. The backend shows them anyway because
> `SHOW_UNVERIFIED=true`. Set it to `false` once items are reviewed and flipped to `verified = true`.

## One-time setup: enable Google login (manual, in the Supabase dashboard)

This cannot be done from code:

1. Supabase → **Authentication → Providers → Google** → enable.
2. Add a Google OAuth **Client ID + Secret** (from Google Cloud Console → OAuth consent + credentials).
3. In Google Cloud, set the **Authorized redirect URI** to:
   `https://mdymtwykvuvfxtupciwo.supabase.co/auth/v1/callback`
4. Supabase → Authentication → **URL Configuration**: add your site URLs to *Redirect URLs*
   (e.g. `http://localhost:5173` for dev and your Railway URL for prod).

## Environment variables

**`backend/.env`** (copy from `backend/.env.example`):

| Var                    | Where to find it                                            |
| ---------------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`         | Project Settings → API                                     |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → `service_role` (SECRET)           |
| `SUPABASE_ANON_KEY`    | Project Settings → API → anon/public                       |
| `FRONTEND_ORIGIN`      | Allowed CORS origins, comma-separated                      |
| `SHOW_UNVERIFIED`      | `true` to show unverified seed data (default)              |

**`frontend/.env`** (copy from `frontend/.env.example`):

| Var                       | Value                                          |
| ------------------------- | ---------------------------------------------- |
| `VITE_SUPABASE_URL`       | same as `SUPABASE_URL`                          |
| `VITE_SUPABASE_ANON_KEY`  | anon/public key                                |
| `VITE_API_URL`            | leave blank in dev (Vite proxies `/api`)       |

## Local development (two terminals)

**Backend:**

```bash
cd backend
py -m venv .venv                 # Windows: py ;  macOS/Linux: python3
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173  (proxies /api -> :8000)
```

Open http://localhost:5173, sign in with Google, and you land on the dashboard.

**Optional — AI agent skills:** this repo uses [Supabase's agent skills](https://github.com/supabase/agent-skills)
for Claude Code / Cursor / Copilot. They're gitignored (machine-local), so after cloning run:

```bash
npx skills experimental_install
```

## Production build / Railway

Railway uses `nixpacks.toml`: it builds the frontend, installs the backend, then starts FastAPI,
which serves `frontend/dist` at `/` and the API under `/api` — a single service.

```bash
# what Railway runs:
cd frontend && npm ci && npm run build
python -m pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set the `backend/.env` variables as Railway **service variables**, and add the Railway URL to
`FRONTEND_ORIGIN` and to the Supabase Auth redirect URLs.

## API summary

All routes are under `/api` and require `Authorization: Bearer <supabase access token>` except
`/api/health` and `/api/statuses`.

| Method | Path                                      | Purpose                                  |
| ------ | ----------------------------------------- | ---------------------------------------- |
| GET    | `/api/health`                             | liveness                                 |
| GET    | `/api/statuses`                           | the 7 fixed statuses                     |
| GET    | `/api/me`                                 | current user id/email                    |
| GET    | `/api/categories`                         | categories with item counts             |
| GET    | `/api/items?category=&type=`              | items + the user's status               |
| PUT    | `/api/items/{item_type}/{item_id}/status` | upsert status / notes / next_action      |
| GET    | `/api/progress`                           | progress summary for the dashboard       |
