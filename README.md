# Twinish — Digital Wardrobe Twin 💅🏻

Turn your closet into a digital twin: every item tagged and understood, outfits
generated from what you actually own, a shopping assistant for "should I buy
this?", and a virtual fitting room that composites your clothes onto a
full-body photo.

```
wardrobe-app/
├── MASTERPLAN.md      ← project plan & decision log (source of truth)
├── backend/           ← FastAPI: tagging, wardrobe storage, outfit gen, try-on
├── frontend/          ← TanStack Start + React UI (Lovable scaffold)
├── README.md          ← you are here
└── README-backend.md  ← tagging pipeline deep-dive + eval guide
```

## Stack

- **Backend**: Python / FastAPI. Gemini for tagging + outfit generation + the
  shopping agent; Postgres (Supabase) + pgvector for wardrobe storage; IDM-VTON
  via Hugging Face Spaces for virtual try-on.
- **Frontend**: TanStack Start + React + Tailwind (Lovable scaffold), talks to
  the backend through a thin REST client in `src/lib/api.ts`.

## Quickstart

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then fill in GEMINI_API_KEY + DATABASE_URL
```

- Get a free Gemini key at https://aistudio.google.com/apikey
- The backend needs a **Supabase Postgres** database (pgvector). Create a free
  project, run `CREATE EXTENSION IF NOT EXISTS vector;` in the SQL editor, and
  put the connection string in `DATABASE_URL` (Project Settings → Database →
  connection string, port 6543 works).
- First time only — copy local data into Postgres:
  ```bash
  python -m app.scripts.migrate_to_postgres
  ```

Sanity check, then start the API:

```bash
python ping.py                      # "Response: pong" → key works
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health`
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
bun install          # npm install works too, but bun.lock is the source of truth
cp .env.example .env # VITE_API_URL=http://localhost:8000 (default when unset)
bun run dev
```

The UI falls back to built-in mock data when the backend is unreachable, so
the frontend still renders during development before the server is up.

## API overview

See `backend/app/main.py` for the authoritative list. Main endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/items` | list wardrobe (`?category=&season=`) |
| GET | `/api/items/{id}` | single item |
| GET | `/api/items/{id}/similar` | embedding-similar items (pgvector) |
| POST | `/api/items/upload` | tag a photo without saving (review step) |
| POST | `/api/items` | save a reviewed item |
| POST | `/api/outfits/generate` | RAG outfit generation (Gemini) |
| GET | `/api/outfits/{id}` | one persisted outfit (deep-link) |
| POST | `/api/outfits/{id}/rate` | rate a generated outfit |
| GET | `/api/planner/week` | weekly planner outfits |
| POST | `/api/feedback` | log a worn outfit + rating (few-shot signal) |
| GET | `/api/colors` | distinct wardrobe colors for filter chips |
| POST | `/api/should-i-buy` | shopping agent verdict (upload a photo) |
| POST | `/api/fitting-room/photo` | upload a full-body photo for try-on |
| POST | `/api/fitting-room/tryon` | run the sequential try-on pipeline |
| GET | `/api/fitting-room/session/{id}` | poll try-on progress |
| GET | `/photos/*`, `/cutouts/*` | served wardrobe images |
| GET | `/personal-photos/*` | private face/body uploads (no cache) |

## Virtual fitting room

1. Upload a full-body photo (`/api/fitting-room/photo`).
2. Pick a generated outfit — top/bottom/outerwear/dress/shoes items are
   composited one at a time via IDM-VTON (accessories are skipped).
3. Poll the session endpoint for progress; each pass's result feeds the next.

Notes:

- Try-on runs on Hugging Face Spaces (free, shared) — set `HF_TOKEN` in
  `backend/.env` to use your authenticated ZeroGPU quota, otherwise anonymous
  users are throttled after roughly one run.
- Face/body uploads live in `backend/data/personal_uploads/`, which is
  **gitignored** — personal photos are never committed. Wardrobe photos are
  tracked in git so the free-tier instance's ephemeral disk still has them.

## More docs

- `MASTERPLAN.md` — feature catalog, architecture, eval methodology, and a
  running decision log (§8 explains how to keep it current).
- `README-backend.md` — tagging pipeline deep-dive: tagging a photo, building
  the eval set, and running accuracy evals.
