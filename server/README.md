# Digital Pantry — Backend + real app

The real app: Node.js + TypeScript + Express, SQLite storage (via Node's built-in `node:sqlite` — no native build tools needed), real Claude-powered receipt OCR and recipe parsing, and the frontend (`public/index.html`) served from the same origin — one process, one URL, no CORS to fight.

This replaces the standalone `pantry.html` Artifact prototype at the repo root, which is now a step behind (it still mocks OCR/recipe parsing and only persists to `localStorage`, since an Artifact's sandbox can't call a local backend at all — that's the whole reason this moved out of Artifact hosting). Kept around for reference; this `server/` app is where active work happens now.

## Setup

```
cd server
npm install
cp .env.example .env
```

Edit `.env` and set `ANTHROPIC_API_KEY` to your own Anthropic API key. Without it, everything works except:
- `POST /api/receipts/parse-image` (receipt OCR) — the "Scan receipt photo" button
- `POST /api/recipes/parse` (recipe ingredient parsing) — the "New recipe" flow, which has no offline fallback anymore

Both fail with a clear toast in the UI (and a 502 from the API) until a key is set. Everything else — pantry, categories, grocery, cook logic, and the receipt paste-text fallback — doesn't need one, and the app shows a banner up top when no key is configured so it's obvious why those two features are unavailable.

## Run

```
npm run dev
```

Open **http://localhost:3001** in a browser. `pantry.db` is created automatically on first run, seeded with the starter category list — the starter checklist pops up automatically on an empty pantry, same as the old prototype.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/items` | List pantry items |
| POST | `/api/items` | Add/increment an item |
| PATCH | `/api/items/:id` | Edit an item |
| DELETE | `/api/items/:id` | Mark as out (removes entirely, not zeroed) |
| GET | `/api/categories` | List category names |
| POST | `/api/categories` | Add a category |
| PATCH | `/api/categories/:name` | Rename (cascades to items) |
| DELETE | `/api/categories/:name` | Delete (409 if items still use it) |
| GET | `/api/recipes` | List recipes |
| POST | `/api/recipes/parse` | AI-parse pasted recipe text into ingredients (review before saving) |
| POST | `/api/recipes` | Save a recipe |
| PATCH | `/api/recipes/:id` | Edit a recipe |
| DELETE | `/api/recipes/:id` | Delete a recipe |
| POST | `/api/recipes/:id/cook` | Subtract ingredients from pantry, shortfalls to grocery list |
| POST | `/api/recipes/:id/resolve` | Resolve one ambiguous/volume-unit line from a cook result |
| GET | `/api/grocery` | List grocery items |
| POST | `/api/grocery` | Add a manual grocery item |
| PATCH | `/api/grocery/:id` | Edit/check a grocery item |
| DELETE | `/api/grocery/:id` | Remove a grocery item |
| GET | `/api/receipts` | Receipt history (for the money-spent summary) |
| POST | `/api/receipts/parse-image` | AI vision OCR on a receipt photo (base64) — returns a review checklist |
| POST | `/api/receipts/confirm` | Confirm a reviewed receipt: adds items to pantry, records the receipt total |

## Frontend

`public/index.html` is a full rewrite of the old `pantry.html` prototype against this API instead of `localStorage`. Same design, same flows, plus:
- Receipt scanning is a real photo upload (file input) → `/api/receipts/parse-image`, not a per-store mock
- Recipe ingredient parsing is a real AI call → `/api/recipes/parse`, with no local fallback (the old prototype's regex parser is gone from this path)
- The receipt paste-text fallback stayed local (no backend endpoint for it — it's a lightweight heuristic, not worth an AI call)
- Backup is now a plain JSON download of the current server data (real browser, no Artifact sandbox needed) — restore-from-file isn't wired up, since there's no bulk-import endpoint yet
- UI-only state (which categories are expanded, whether first-run setup is done) still lives in `localStorage`; everything else is server-backed

Verified with a scripted Playwright pass against a live server: starter checklist → item add → category rename (cascades) → quantity stepper → grocery add/check/move-to-pantry → receipt paste-text → review → confirm (money-spent total came out correct) → recipe parse failing gracefully with no API key configured.

## Not built yet

- Restoring from a backup JSON file (no bulk-import endpoint)
- Multi-user / household sharing
- Deploying this anywhere — it's local-only right now (`localhost:3001`)
