# Digital Wardrobe Twin — Master Project Plan
### Owned reference document. Update this as decisions get made — treat it as the single source of truth for vision, scope, and technical direction.

---

## 1. Vision

A personal app that turns your closet into a digital twin: every item tagged and understood, outfits generated from what you already own, and a second brain in your pocket when you're standing in a store deciding whether something's worth buying.

**Equally important, second purpose:** this project is a hands-on lab for the AI techniques worth having real experience with in 2026 — structured extraction from multimodal LLMs, embeddings/RAG, agentic tool-use, and evals — built entirely on free tools. Every feature decision should be filtered through both lenses: *is this useful to me*, and *does building it teach me something*.

**What this is not:** a startup. No monetization, no multi-user scale, no enterprise roadmap. Solo, free-tier, learn-by-building.

---

## 2. Feature catalog

Organized by module, with a priority tier so scope creep has somewhere honest to go instead of derailing the current phase.

### 2.1 Wardrobe Digitization
| Feature | Tier |
|---|---|
| Photo → structured tags (category, color, pattern, formality, season, fabric) | MVP |
| Manual tag correction | MVP |
| Wear history logging | MVP |
| Cost-per-wear tracking | V2 |
| Duplicate/near-identical item detection | V2 |
| Wear-frequency heatmap / "dead weight" surfacing | V2 |
| Color palette / wardrobe balance analysis | V2 |
| Seasonal rotation reminders | Stretch |
| Fabric/care-based laundry grouping | Stretch |

### 2.2 Outfit Recommendation
| Feature | Tier |
|---|---|
| Context-filtered outfit generation (occasion/weather/season) | MVP |
| "Complete the look" from one anchor item | MVP |
| Outfit reasoning explanation (why these pieces work) | MVP |
| Weather-synced suggestions | V2 |
| Outfit history + like/dislike feedback | V2 |
| Packing list / capsule wardrobe generator | V2 |
| "Surprise me" randomizer for decision fatigue | Stretch |
| Style evolution tracker over time | Stretch |

### 2.3 Shopping Decision Assistant (the standout feature)
| Feature | Tier |
|---|---|
| Photo → tag → buy/skip verdict with reasoning | MVP |
| Versatility score (pairs with X existing items) | MVP |
| Duplicate/redundancy warning | MVP |
| Visual "goes with" preview (existing items it pairs with) | V2 |
| Wardrobe gap analysis ("no white sneakers, this fills a real hole") | V2 |
| Price-per-projected-wear estimate | V2 |
| Wishlist / revisit-later mode | Stretch |
| Return-window reminder | Stretch |

### 2.4 Personalization & Engagement
| Feature | Tier |
|---|---|
| Feedback-informed re-ranking (few-shot on liked/disliked outfits) | V2 |
| Daily outfit push notification | Stretch |
| Closet value / cost-per-wear trend dashboard | Stretch |
| Trained preference model (logistic regression on outfit features) | Stretch |

**Rule of thumb:** don't start a V2/Stretch feature until every MVP feature in that module has a working eval or a clear "good enough" bar. Scope discipline is the actual hard part of a solo project — this table exists to make that decision easy to check, not to negotiate.

---

## 3. The technique-to-feature framework

This is the throughline of the whole project — every feature routes through a specific AI technique worth practicing deliberately, not just whatever's easiest.

| Feature area | Technique | What it teaches |
|---|---|---|
| Photo → tags | Multimodal LLM + structured output (JSON schema-constrained generation) | Reliable structured extraction without training a classifier |
| "Find items that go with this" | Embeddings + vector similarity search | Core retrieval primitive underneath RAG |
| Context-aware outfit generation | RAG (retrieval + generation) | Retrieve relevant subset, ground generation in it, avoid hallucinated items |
| Shopping buy/skip verdict | Agentic tool-use (multi-step, model-orchestrated) | The actual hard, valuable skill: chaining tools with model-decided order, not a hardcoded pipeline |
| "Is the tagging any good?" | Evals | Turning "feels better" into a number — arguably the most-skipped, most-valuable practice in solo AI projects |
| Personalization from feedback | Few-shot preference conditioning, optionally a small trained re-ranker later | Personalization without a heavy ML pipeline |
| Cost/latency discipline | Model routing (cheap model for tagging, stronger model for reasoning) | Practical skill: not every call needs the biggest model |
| (Stretch) Beating zero-shot on your own photos | LoRA fine-tuning on a small open VLM | Parameter-efficient fine-tuning, hands-on |
| (Stretch) Privacy / offline | Local inference via Ollama | Running/quantizing open models, comparing to API quality |

---

## 4. Architecture & stack

### 4.1 Current stack (Phase 1, in progress)
- **Vision/tagging model:** Gemini (`google-genai` SDK), model name resolved dynamically via `list_models.py` rather than hardcoded — free-tier model IDs have shifted multiple times already this year (2.5 → 3.x families), so this is a standing practice, not a one-time fix.
- **Schema/contract:** Pydantic `ClothingItem` model (`app/tagging/schema.py`) — the contract every later phase depends on.
- **Storage (Phase 1):** flat JSON (`data/wardrobe.json`) — intentionally simple, replaced by SQLite + Chroma in Phase 2.
- **Eval harness:** `app/eval/run_eval.py` — hand-labeled ground truth (`data/eval_set/ground_truth.json`), fuzzy matching for free-text fields, exact match for categorical fields, Jaccard overlap for seasons.

### 4.2 Planned additions by phase
| Phase | Adds |
|---|---|
| 2 | SQLite (structured fields) + Chroma (embeddings, local, zero infra) |
| 3 | RAG outfit engine: SQL filter + vector retrieval → LLM composition |
| 4 | Agent: function-calling orchestration over tagging/query/scoring/duplicate-check tools |
| 5 | Wear-log feedback loop, few-shot personalization |
| 6 | FastAPI backend, React web frontend, React Native mobile frontend |
| 7 | Model routing, LoRA fine-tuning experiment, Ollama comparison, optional Supabase migration for multi-device |

### 4.3 Tooling decisions (already made, recorded here so they don't get re-litigated)
- **Main dev environment:** local VS Code + a coding agent (opencode or Claude Code), not Google AI Studio as home base. AI Studio is a scratchpad for prompt iteration only.
- **Frontend prototyping:** Lovable is fine for a fast, fun visual mockup (see the "Threadit" prototype prompt) but not for the real build — it wires to its own Supabase backend and isn't suited to the custom Python agent/RAG logic that's the actual point of this project.
- **Photos for testing:** Pinterest screenshots, cropped to single items, are an acceptable stand-in for real wardrobe photos during pipeline testing — but the eval set should transition to real closet photos before trusting the numbers for anything beyond "does the pipeline run."

---

## 5. Evaluation methodology (lessons learned, not just theory)

This section exists because we already hit real problems here — worth keeping as a reference so they don't get re-learned.

- **Exact-match scoring is too strict for free-text fields.** `fabric_guess` scored 0% early on purely because "leather" vs "genuine leather" don't string-match, not because the tagging was wrong. Fixed by fuzzy/substring/word-overlap matching for `subcategory` and `fabric_guess`, and Jaccard overlap (not strict set equality) for `seasons`.
- **A second model (Kimi) as ground-truth labeler is a fast way to build an eval set, but it's a draft, not gospel** — always skim each label against the actual photo before trusting it. If the labeler and the model-under-test share the same blind spot, the eval will show false confidence.
- **Small samples (2-3 items) produce meaningless percentages.** A single miss swings a 2-item eval by 50%. Don't draw conclusions below ~30-50 items.
- **The eval script should print predicted-vs-expected on every miss**, not just which field missed — otherwise you can't tell a real tagging failure from a scoring-technique problem (this was the actual root cause of the early "0% fabric_guess" scare).
- **Current real numbers (47-item batch):** after the fuzzy-scoring fix plus the color-guidance prompt tweak — category 98%, formality 100%, pattern 89%, fabric_guess 96%, primary_color 91%, secondary_color 83%, seasons 96%, subcategory 85%. Remaining misses are mostly near-synonym granularity ("tote bag" vs "handbag"), which embeddings/RAG won't care about.

---

## 6. Decision log (running — add to this as the project progresses)

| Date/point in project | Decision | Why |
|---|---|---|
| Planning | Multimodal LLM tagging instead of custom CV pipeline (YOLO/Detectron2/etc.) | Zero training data needed, matches the "practice 2026 techniques" goal better |
| Planning | Chroma over a managed vector DB for v1 | Zero infra, free, sufficient for solo scale |
| Planning | Solo weekend-based roadmap, not a 12-month phased roadmap | Realistic for a hobby project pace |
| Phase 0 setup | Model name pinned via `.env`, resolved via `list_models.py` when it breaks | Free-tier model IDs change frequently and without much warning |
| Phase 1 | Storage kept as flat JSON, SQLite deferred to Phase 2 | Don't debug tagging and storage complexity simultaneously |
| Phase 1 eval | Switched from exact-match to fuzzy/overlap scoring for free-text and set fields | Exact-match was penalizing reasonable phrasing differences, not real errors |
| Phase 1 eval | Tightened color-naming guidance in `TAGGING_SYSTEM_PROMPT` (base color names, shades to `notes`) | `primary_color` was the real remaining weakness (70%); prompt fix + color normalization in eval lifted it to 91% |
| Phase 1 eval | Moved `primary_color`/`secondary_color` to fuzzy matching with shade-modifier normalization in `run_eval.py` | Shade differences ("dark red" vs "red") are ground-truth vocabulary mismatch, not tagging errors |
| Phase 2 | SQLite (`data/wardrobe.db`) + Chroma (`data/chroma/`), `ingest_item()` as single write path | Verified end-to-end; retrieval quality needs 20-50 real items before it's meaningful, per plan |
| Phase 2 | Found and fixed REPO_ROOT off-by-one (`parents[3]` → `parents[2]`) in tagger.py/store.py | Root cause of the earlier stray-data-folder confusion |
| Phase 2 verification | Ingested full 47-item batch, tested `find_similar` across 3 query types (jeans, casual top, formal shoes) | Confirmed general-purpose embeddings are strong at category-level similarity (shoes vs. tops vs. bags) but weak at attribute-level precision (color, formality, season) — validates the hybrid design: SQL hard-filters for precise constraints, vector search for soft "what pairs well" ranking within the filtered set, not vector search alone |
| Phase 3 verification | Fixed "outfit" completeness bug: anchor-based retrieval was returning only similarity-ranked neighbors (accessories near accessories), and the generation prompt had no explicit rule that an outfit needs a top+bottom or dress, plus shoes | Two independent fixes needed: retrieval must guarantee category coverage in the shortlist (topping up missing categories), AND the prompt must state structural completeness rules explicitly rather than assuming the model infers them. Both failure modes will recur in Phase 4's agent — retrieval quality and reasoning-step rules are separate concerns to guard separately |
| Phase 4 | Agent built as manual capped loop (`app/agent/`): tools.py exposes Phase 1-3 as callables + TOOL_DISPATCH; agent.py feeds FunctionCall/FunctionResponse parts back to the model for model-decided tool order, capped at 6 calls, verdict grounded in tool output | Chose manual loop over the SDK's automatic-function-calling config so tool order/choice stays visible and debuggable — the model-decided orchestration is the whole point of the phase. Verified: agent independently skipped redundant tools and produced grounded SKIP verdicts from real duplicate hits |
| Phase 4 verification | Tested agent on a genuine gap-filler item (nuanced "maybe" verdict) and a near-duplicate item (correct decisive "skip") | Tool-call ordering was fully model-chosen and efficient (3/6 calls both times) with no invalid tool references. One recurring soft spot: the plain-language verdict occasionally rounds counts loosely ("two similar items" when only one clearly matches) — tool-level grounding is accurate, but prose summarization isn't perfectly precise. Worth revisiting if it becomes a trust issue, not urgent now |
| Phase 5 verification | Logged one liked (5/5) and one disliked (2/5) outfit, re-ran generation | Confirmed feedback reaches the prompt and visibly shapes output — the liked outfit was directly reused with reasoning explicitly citing the preference. Minor caveat: model reused the exact liked combination rather than generalizing style, despite prompt instruction not to just repeat past outfits — worth monitoring at higher feedback volume, not urgent at 2 data points |
| Rough-edge fixes verified | Agent now correctly excludes non-matching duplicates from its count (3 total matches, 2 truly similar, verdict correctly says "two"); feedback loop remixed a liked item into new combinations rather than cloning the exact outfit | Both fixes confirmed working in this test. Programmatic repeat-filter in generate.py remains an untested safety net since no exact repeat occurred this run — not urgent to force-test |
| Tooling | VS Code + coding agent as home base; AI Studio as scratchpad only; Lovable for visual prototyping only | Matches where actual project value (custom backend logic) lives |
| Phase 6 | FastAPI layer (`backend/app/main.py` + `app/api.py`) exposing tagging/wardrobe/outfits/feedback/agent as REST; frontend wired via `src/lib/api.ts` + React Query, degrading to mock data when the API is down | Reuses Phase 1-5 modules unchanged behind HTTP; frontend keeps Lovable's UI/scrapbook look while swapping mock data for real wardrobe (95 real items). Photos served statically from `backend/data/photos` |
| Phase 6 | Category vocab mapped server-side (`top/bottom/dress/accessory` → `tops/bottoms/accessories`), formality int → label, colors normalized toward the frontend's base-color chips in `app/api.py` | The Lovable mock used a different vocabulary than the tagging schema; mapping in one DTO module keeps every page untouched |
| Phase 6 | Backend returns structured `clothing` JSON but the "should-I-buy" agent still runs as a long blocking call (10-30s Gemini); frontend shows a loading receipt meanwhile | Simplest correct v1; move to background job + polling only if it becomes a real UX complaint |
| Phase 6 data fix | Ran `app/scripts/dedupe_items.py`: the 47-item batch had been ingested twice (95 rows / 48 photos) — kept earliest row per `image_path`, dropped 47 rows + matching Chroma embeddings | Dupes showed up immediately once the frontend listed real wardrobe data; wear_log was unaffected (all references pointed at kept rows). `items` count is now 48 = distinct photos |
| Duplicate ingestion root cause found & fixed | ingest.py's `add_item()` did an unconditional INSERT with no idempotency check — the 47-item Phase 2 batch got run twice (~20min apart, confirmed via `created_at` timestamps), doubling to 95 rows before dedup. Fixed with a UNIQUE index on `items.image_path` (hard constraint) plus an upsert in `add_item()` (graceful re-run behavior: updates tags instead of failing or duplicating) | Verified by ingesting the same photo twice: insert (48→49) then re-run updates in place (stays 49, same id, `created_at` preserved, new tags take effect); unique index present; cleanup restored to 48. Existing deduped data applied the index without migration |

---

## 7. Open questions to resolve as you go

- Phase 6 (frontend wiring) verified end-to-end: outfit generation and the shopping agent both run through the REST API against the real 95-item wardrobe; frontend builds clean (`tsc --noEmit`, `eslint`, `vite build`). Next: mobile (React Native) or resume backend refinement — your call.
- Real wardrobe photos vs. continued Pinterest-sourced testing — pick a point to switch over before the eval set is treated as final.
- Supabase migration: stay local-only, or move to hosted once Phase 6 (frontend) makes multi-device access desirable?
- Fine-tuning stretch goal (Phase 7): worth pursuing only if zero-shot accuracy plateaus below a level you're satisfied with after prompt iteration — don't reach for it prematurely.

---

## 8. How to use this document
Treat §2 (feature catalog) as the scope guardrail, §3 as the reason each feature exists at all, §4 as the current architectural truth, §5-6 as institutional memory so mistakes don't get repeated, and §7 as your actual to-decide list. Update §6 and §7 as you go — they're meant to move, unlike §1-3 which should stay stable once set.
