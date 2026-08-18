# Twinish Backend — Tagging Pipeline & Eval Guide

The foundation of the project: **photo in → validated, structured tags out**.
Everything else (outfit generation, the shopping agent) builds on the tagging
pipeline. This doc walks through the core CLI/Eval flows. For setup, the full
API surface, and the virtual fitting room, see the root `README.md`.

All commands run from `backend/`.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add GEMINI_API_KEY + DATABASE_URL
```

`.env.example` is your template; `python-dotenv` comes with
`requirements.txt`, so `ping.py` will read whatever you put in `.env`.

## 1. Confirm your API key works

```bash
python ping.py
```

Expect: `Response: pong` (or similar). If this fails, fix it before going
further — everything else depends on this call working.

## 2. Tag a single photo (no saving, just inspect the output)

```bash
python -m app.tagging.tagger data/photos/some_item.jpg
```

Prints structured JSON tags for that one photo. Good for eyeballing
prompt/schema quality before wiring up the full CLI.

Need test photos? `python download_test_photos.py` pulls a small batch of
clothing images from Wikimedia Commons (terms are names like "blue
t-shirt", "denim jeans" — swap in real photos of your own clothes before
building a trustworthy eval set).

## 3. Add items to your wardrobe (with manual correction)

```bash
python -m app.tagging.cli data/photos/some_item.jpg
```

Tags the photo, shows you the result, lets you correct any field, then saves
it via `app.storage.ingest.ingest_item()` (Postgres + pgvector embeddings).
Do this for real items in your closet — each one also becomes a candidate for
your eval set (see below).

## 4. Build your eval set (don't skip this)

1. Copy `data/eval_set/ground_truth_template.json` →
   `data/eval_set/ground_truth.json`.
2. For 50–100 real items, add an entry with the `image_path` and the tags
   *you* believe are correct (use the corrections you made in step 3 as a
   starting point).
3. Run:

   ```bash
   python -m app.eval.run_eval data/eval_set/ground_truth.json
   ```

4. This prints per-field accuracy (category, color, pattern, formality, etc.)
   and lists every item where the model got something wrong.

Re-run this eval every time you touch `TAGGING_SYSTEM_PROMPT` or the schema
in `app/tagging/schema.py` — it's the only way to know whether a prompt
change actually helped or just felt like it should.

## What's deliberately not automated

- **Cost optimization / retry tuning** — get it working and accurate first,
  then worry about efficiency.
- The eval set is hand-labeled on purpose; that's what makes the numbers
  meaningful.

## Definition of done

- `ping.py` works.
- You can point the CLI at 15–20 real photos from your own closet and get a
  valid schema back for every single one (no crashes, no malformed JSON).
- You have an eval score you trust (even if it's not perfect yet) and a sense
  of which fields the model struggles with most.