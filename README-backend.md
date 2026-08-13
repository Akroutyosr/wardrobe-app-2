# Digital Wardrobe Twin — Phase 1: Wardrobe Digitization

Photo in → validated, structured tags out. This is the foundation everything
else in the project builds on.

## Setup:

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r ../requirements.txt

cp ../.env.example ../.env
# edit .env and paste your free-tier key from https://aistudio.google.com/apikey
```

## 1. Confirm your API key works

```bash
python ping.py
```
Expect: `Response: pong` (or similar). If this fails, fix it before going further --
everything else depends on this call working.

## 2. Tag a single photo (no saving, just inspect the output)

```bash
python -m app.tagging.tagger data/photos/some_item.jpg
```
Prints the structured JSON tags for that one photo. Good for eyeballing
prompt/schema quality before wiring up the full CLI.

## 3. Add items to your wardrobe (with manual correction)

```bash
python -m app.tagging.cli data/photos/some_item.jpg
```
Tags the photo, shows you the result, lets you correct any field, then saves
it to `data/wardrobe.json`. Do this for real items in your closet -- each one
becomes a candidate for your eval set too (see below).

## 4. Build your eval set (don't skip this)

1. Copy `data/eval_set/ground_truth_template.json` to `data/eval_set/ground_truth.json`.
2. For 50-100 real items, add an entry with the `image_path` and the tags
   *you* believe are correct (use the corrections you made in step 3 as a
   starting point).
3. Run:
   ```bash
   python -m app.eval.run_eval data/eval_set/ground_truth.json
   ```
4. This prints per-field accuracy (category, color, pattern, formality, etc.)
   and lists every item where the model got something wrong.

Re-run this eval every time you touch `TAGGING_SYSTEM_PROMPT` or the schema
in `app/tagging/schema.py` -- it's the only way to know whether a prompt
change actually helped or just felt like it should.

## What's deliberately not here yet

- No SQLite/Chroma -- Phase 1 stores everything in `data/wardrobe.json` on
  purpose, so you can trust the tagging pipeline before adding storage
  complexity. That's Phase 2.
- No retry limit tuning / cost optimization -- get it working and accurate
  first, then worry about efficiency.

## Definition of done for Phase 1

- `ping.py` works.
- You can point the CLI at 15-20 real photos from your own closet and get a
  valid schema back for every single one (no crashes, no malformed JSON).
- You have an eval score you trust (even if it's not perfect yet) and a
  sense of which fields the model struggles with most.
