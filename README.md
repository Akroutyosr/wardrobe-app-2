# Digital Wardrobe Twin: TWINISH 💅🏻

This folder merges the two pieces that were previously in separate zips:

```
wardrobe-app/
├── MASTERPLAN.md        ← project plan (source of truth, see §8 for how to use it)
├── README-backend.md    ← original Phase 1 backend README (setup steps below)
├── backend/             ← Python tagging/agent/eval pipeline (was wardrobe-app_copie/backend)
└── frontend/            ← Lovable-generated TanStack Start + React UI (was closet-bestie-style-main)
```

Nothing inside `backend/` or `frontend/` was changed — this is a straight merge into
one folder so you can work on both from a single VS Code window / single git repo.
Two things were deliberately **not** carried over and need to be regenerated locally:

- `backend/venv/` (460MB, machine-specific — recreate with the steps below)
- `frontend/node_modules/` (not present in the zip either — `bun install` will create it)

Your real `backend/.env` (with your Gemini API key) **was** copied over, so the
backend should work as-is once the venv is rebuilt.

## Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python ping.py                  # sanity check — should print "Response: pong"
```

See `README-backend.md` for the full Phase 1 walkthrough (tagging a photo, building
the eval set, running `run_eval.py`).

## Frontend setup

The frontend uses `bun` (see `bunfig.toml`, `bun.lock`):

```bash
cd frontend
bun install
bun run dev
```

If you don't have bun installed: `npm install` / `npm run dev` will also work off
`package.json`, but `bun.lock` won't be respected (expect slightly different resolved
versions).

## Phase 6: running the full stack (FastAPI backend + React frontend)

The frontend pages (closet, outfit ideas, add-item, should-I-buy, planner) talk to
a real FastAPI backend that reuses the Phase 1–5 pipeline. Photos are stored
locally and served from the backend; reads and writes hit the API.

**1. Start the backend** (from `backend/`):

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then add GEMINI_API_KEY + DATABASE_URL
```

The backend now reads and writes **Supabase Postgres** (pgvector) instead of
local SQLite + Chroma. Create a free Supabase project, enable the vector
extension in the SQL editor (`CREATE EXTENSION IF NOT EXISTS vector;`), grab
the connection string from Project Settings → Database, put it in `DATABASE_URL`
in `backend/.env`, then run the one-time migration:

```bash
python -m app.scripts.migrate_to_postgres   # copies wardrobe.db + Chroma into Postgres
```

Then start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health` → `{"status":"ok","items":49,…}`
Interactive docs: `http://localhost:8000/docs`

**2. Point the frontend at it** (from `frontend/`):

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:8000 (this is also the default)
npm install
npm run dev
```

Every read hooks through `src/lib/api.ts` and falls back to the built-in mock
data (`src/lib/closet-data.ts`) if the backend isn't reachable, so the UI still
renders during development before the server is up.

Main API endpoints (see `backend/app/main.py`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/items` | list wardrobe (`?category=&season=`, frontend vocab) |
| GET | `/api/items/{id}` | single item |
| GET | `/api/items/{id}/similar` | embedding-similar items (pgvector) |
| POST | `/api/outfits/generate` | RAG outfit generation (Gemini) |
| GET | `/api/outfits/{id}` | one persisted outfit (deep-link) |
| POST | `/api/outfits/{id}/rate` | rate a generated outfit |
| POST | `/api/feedback` | log a worn outfit + rating (few-shot signal) |
| GET | `/api/colors` | distinct wardrobe colors for filter chips |
| POST | `/api/items/upload` | tag a photo without saving (review step) |
| POST | `/api/items` | save a reviewed item (Postgres + pgvector) |
| POST | `/api/should-i-buy` | shopping agent verdict (upload a photo) |
| GET | `/photos/*` | served wardrobe photos (static) |

## Suggested next steps

1. `git init` at this root (`wardrobe-app/`) if you want one repo covering both
   halves instead of two separate git histories.
2. Add a root `.gitignore` covering `backend/venv/`, `backend/__pycache__/`,
   `backend/.env`, `frontend/node_modules/`, `frontend/dist/`.
3. Rebuild the venv and `bun install` as above to confirm both sides still run
   post-merge.
