# Digital Pantry — Backend

Real backend for the Digital Pantry app: Node.js + TypeScript + Express, SQLite storage (via Node's built-in `node:sqlite` — no native build tools needed), and real Claude-powered receipt OCR and recipe parsing.

## Setup

```
cd server
npm install
cp .env.example .env
```

Edit `.env` and set `ANTHROPIC_API_KEY` to your own Anthropic API key. Without it, everything works except:
- `POST /api/receipts/parse-image` (receipt OCR)
- `POST /api/recipes/parse` (recipe ingredient parsing)

Both fail with a clear 502 error until a key is set — the rest of the app (pantry, categories, grocery, cook logic) doesn't need one.

## Run

```
npm run dev
```

Starts on `http://localhost:3001` (override with `PORT` in `.env`). `pantry.db` is created automatically on first run, seeded with the starter category list.

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

## Not built yet

This is the data + AI layer only. Nothing here talks to the `pantry.html` prototype — that still runs entirely client-side against `localStorage`. Wiring the frontend to this backend (replacing localStorage calls with `fetch`s to these endpoints, and replacing the prototype's mock OCR/recipe-parsing with real calls to `/api/receipts/parse-image` and `/api/recipes/parse`) is the next step.
