# Digital Pantry App — Product Spec (v1)

## 1. Overview

A mobile app (prototyped first as a web/desktop mockup) that tracks kitchen inventory ("the pantry") by:
- Scanning grocery receipts (photo or PDF/email) and filing purchased items into categorized pantry entries
- Letting recipes deduct ingredients from the pantry when cooked
- Auto-adding missing recipe ingredients to a grocery list
- Supporting manual entry, editing, and reconciliation at every step

Initial platform: prototype as a web app / artifact to validate flows → build as native mobile app in a later phase. Offline-first with sync when connectivity returns. Multi-user (household) support is a later phase.

---

## 2. Core Concepts & Data Model

### 2.1 Pantry Item
| Field | Notes |
|---|---|
| `id` | unique identifier |
| `name` | clean display name (e.g. "2% Milk") |
| `category` | single category (see §4) |
| `quantity_type` | `count` or `weight` |
| `quantity_value` | numeric amount |
| `weight_unit` | lb / oz / kg / g (if weight type) |
| `source` | `receipt`, `manual`, `common-item-checklist` |
| `raw_label` | original receipt line text, for traceability |
| `last_updated` | timestamp |

- No expiration/use-by tracking (explicitly out of scope).
- Items are **removed entirely** (not zeroed out) when marked "ran out."
- Quantity drift is expected and resolved via manual adjustment (no auto-reconciliation logic needed in v1).

### 2.2 Category
- Fixed starter list, editable/expandable later (see §4).
- Each item belongs to **exactly one** category.
- Pantry view supports **search** across all items regardless of category.

### 2.3 Recipe
| Field | Notes |
|---|---|
| `id` | unique identifier |
| `name` | recipe title |
| `raw_text` | pasted-in text (from Google Doc) |
| `parsed_ingredients` | list of `{name, quantity, unit}` after auto-parse |
| `review_status` | pending / confirmed |

### 2.4 Grocery List
- Auto-populated when a recipe requires more of an item than is currently in the pantry (shortfall quantity + item name).
- Also manually editable (add/remove items directly).

---

## 3. Feature Flows

### 3.1 Receipt Ingestion
1. **Capture**: user takes a photo, uploads a PDF, or forwards/imports an email receipt.
2. **OCR + parse**: text extracted from image/PDF; line items identified.
3. **Store-aware parsing**: custom parsing logic tuned to the 5 known formats — **Costco, Ranch 99, Trader Joe's, Safeway, Farmers Market** (Farmers Market receipts, if any exist, will likely need a generic/manual fallback since they're informal).
4. **Review checklist**: every parsed line item is shown to the user as a checklist entry:
   - Suggested clean name + category (editable)
   - Suggested quantity/unit (editable)
   - Option to **manually substitute** the item entirely (e.g., cryptic SKU → correct real item)
   - Option to mark a line as "not an item" (tax, discount, subtotal) and discard it
5. **Confirm**: confirmed items are added to (or incremented in) the pantry.
6. Non-food items (paper towels, foil, etc.) are included and categorized like any other item — not filtered out.
7. **Manual entry path**: a "+ Add item manually" option exists independent of receipt scanning, for anything not captured by a receipt.

### 3.2 Recipe Ingestion & Cooking
1. User pastes recipe text (copied from a Google Doc) into a "New Recipe" field.
2. App auto-parses ingredient lines into `{name, quantity, unit}`.
3. **Review step**: user confirms/corrects parsed ingredients before saving the recipe (same review-checklist pattern as receipts, for consistency).
4. When the user marks a recipe as **"Cooked"**:
   - App attempts to subtract each ingredient's quantity from the matching pantry item.
   - If pantry has enough → subtract and update pantry.
   - If pantry has too little or the item isn't in the pantry at all → **do not block cooking**; instead, add the shortfall (or full amount, if missing) to the **Grocery List** tab.
5. Unit mismatches (recipe says "2 cups" of something the pantry tracks in count/weight) are flagged for the user to manually reconcile at confirm time — v1 does not need full unit-conversion logic, just a way to flag and let the user resolve it inline.

### 3.3 Initial Pantry Setup
1. On first use, app shows a **fixed starter checklist of common items** grouped by category (e.g., "Olive Oil," "Onions," "Rice," "Eggs" — a curated default list, editable later).
2. User taps items they currently have:
   - If the item is naturally countable, a quantity can be entered (optional — presence-only is also valid).
   - If no quantity given, item is just marked "in stock."
3. These become normal pantry items, indistinguishable from receipt-added or manually-added ones going forward.

### 3.4 Running Out
- From any pantry item (whether it came from the common-items checklist, a receipt, or manual entry), user can tap **"Mark as out."**
- This **removes the item from the pantry entirely** (not zeroed — gone, matching your spec). Re-adding later is a fresh add (via receipt, manual, or the common-items list again).

### 3.5 Search & Categories
- Pantry view is organized by category by default (accordion or tabbed sections).
- A search bar lets the user find any item across all categories instantly.
- Categories are editable: user can rename, add, or remove categories after initial setup; existing items keep their category assignment until manually reassigned.

### 3.6 Sync / Offline
- All actions (add, subtract, mark-out, edit) work fully offline against local storage.
- When connectivity returns, local changes sync to a backend store.
- v1 targets single-user local-first storage with sync as a backend addition; multi-user conflict resolution is deferred to the household-sharing phase (§6).

---

## 4. Starter Category List (editable later)

- Vegetables
- Fruits
- Starches (rice, bread, pasta, potatoes)
- Meat & Poultry
- Seafood
- Dairy & Eggs
- Pantry Staples (oils, spices, canned goods, condiments)
- Frozen
- Beverages
- Snacks
- Household / Non-Food

*(You can refine names/groupings before we build — this is just a reasonable starting default.)*

---

## 5. Phase 1 Scope (Build This First)

**In scope:**
- Manual item add/edit/remove
- Common-items starter checklist for initial setup
- Category-organized pantry view with search
- Receipt photo capture → OCR → review checklist → pantry update (start with 1–2 stores, e.g. Trader Joe's + Safeway, to prove the parsing pattern before covering all 5)
- Manual receipt item entry (fallback when OCR isn't available/accurate — covers Farmers Market too)
- Recipe paste → auto-parse → review → save
- "Mark as cooked" → subtract from pantry → shortfall to grocery list
- Grocery list tab (auto + manual entries)
- Offline local storage

**Explicitly deferred to later phases:**
- PDF/email receipt import
- Full 5-store OCR coverage
- Native mobile app (start as web prototype)
- Multi-user household sharing
- Cloud sync (start local-only, add sync once core flows are validated)
- Any expiration/freshness tracking (not planned at all, per your answer)

---

## 6. Decisions (confirmed 2026-08-02)

1. **Starter common-items list**: drafted below (§7).
2. **OCR approach**: AI vision model (send receipt photos to a vision-capable model for parsing), not hand-written per-store parsers.
3. **Recipe parsing**: AI-based parser for ingredient lines, not rule-based.
4. **Prototype target**: clickable web artifact first, to validate flows before any mobile build.

Note: the first web-artifact prototype cannot make live AI calls (no such runtime capability is available to artifacts), so OCR and recipe parsing are **simulated with a mock parser** in the prototype to demonstrate the review-checklist UX. Real AI vision/parsing calls get wired in once this becomes a backed app.

---

## 7. Starter Common-Items Checklist (draft, editable)

| Category | Items |
|---|---|
| Vegetables | Onions, Garlic, Potatoes, Carrots, Bell Peppers, Tomatoes, Leafy Greens, Broccoli |
| Fruits | Bananas, Apples, Lemons, Limes, Avocados |
| Starches | Rice, Pasta, Bread, Tortillas |
| Meat & Poultry | Chicken Breast, Ground Beef, Bacon |
| Seafood | Salmon, Shrimp |
| Dairy & Eggs | Milk, Eggs, Butter, Cheese, Yogurt |
| Pantry Staples | Olive Oil, Vegetable Oil, Salt, Black Pepper, Sugar, Flour, Canned Tomatoes, Canned Beans, Soy Sauce, Vinegar, Peanut Butter, Honey |
| Frozen | Frozen Vegetables, Frozen Fruit, Ice Cream |
| Beverages | Coffee, Tea, Juice, Water |
| Snacks | Chips, Crackers, Nuts |
| Household / Non-Food | Paper Towels, Toilet Paper, Dish Soap, Trash Bags |

---

## 8. Prototype

**Phase 1** (2026-08-02): clickable prototype published as a Claude Artifact — pantry inventory with category search, starter checklist, mock receipt-scan review (Trader Joe's / Safeway), recipe paste-and-parse with cook-and-deduct, and grocery list. OCR and ingredient parsing are simulated (no live AI calls available inside Artifacts); local storage persists state across visits.

**Phase 2** (2026-08-02): built on top of Phase 1, still within the same Artifact/local-storage constraints —
- Mock receipt-scan coverage extended to all 5 stores (added Costco, Ranch 99)
- "Paste receipt text" flow, standing in for both PDF/email import and the Farmers Market manual fallback (§5 deferred items) until real OCR/email ingestion exists
- Category management (rename/add/delete) per §3.5 — renaming carries existing items along; delete is blocked while items still use the category
- Local backup: export the full app state as JSON (via the artifact's `downloads` capability) and restore from a pasted backup, as a stand-in for the real cloud-sync layer in §3.6

**Phase 3** (2026-08-02): usability hardening on the existing flows, no new feature surface —
- Quick +/− quantity steppers on pantry rows (step 1 for count items, 0.5 for weight) so routine adjustments don't need the edit modal
- Undo on every destructive action (mark item as out, delete recipe, remove grocery item) via a toast action, since none of these had a safety net before
- Recipes are editable after saving — rename, edit/remove ingredient lines, or add a forgotten one — instead of only viewable or deletable
- Grocery items are editable in place (name/quantity/unit), not just checkable or removable

**Phase 4** (2026-08-02): closing gaps between tabs, and correctness on cook —
- Grocery items, once checked off (bought), get a "Move to pantry" action that opens a prefilled add-item form and removes the item from the grocery list on save — previously the only way back into the pantry was a fresh manual/receipt add, even for something just bought off the list
- Item traceability surfaced in the edit modal: source (receipt/manual/starter checklist), the original receipt line text if any, and last-updated date — the `raw_label` field was always stored (§2.1) but never shown anywhere
- "Mark as cooked" no longer silently grabs the first fuzzy pantry match when an ingredient name matches more than one item (e.g. "milk" matching both "2% Milk" and "Whole Milk") — it's now flagged in the same "needs your input" panel as unit mismatches, with a button per candidate item

**Phase 5** (2026-08-02): accessibility and reachability polish —
- Starter checklist is reachable anytime from the Pantry toolbar, not just on first run; items already in the pantry show as checked and locked so re-browsing it can't create duplicates
- Expand all / Collapse all for pantry categories
- Modals: focus moves to the first field on open, Tab is trapped within the modal while open (previously focus could escape to the page behind it)
- Toast notifications are announced to screen readers (`role="status" aria-live="polite"`)

**Money spent** (2026-08-03): receipt line items now carry an optional price (added to the mock scan data, and to the "paste receipt text" parser via a `$` pattern) shown as an editable field in the review checklist. On confirm, the total of included lines is stored on that receipt's history record. The Receipts tab shows a "spent this month" stat plus a month-by-month breakdown, computed from receipt totals — this wasn't in the original spec's data model (§2) but is a natural extension once receipts carry prices at all. Pantry items themselves still don't carry a price field, matching §2.1 as written; cost lives only on the receipt record.

The receipt review checklist also has a **receipt date** field (defaults to today, backdatable, capped at today) so a receipt scanned late still lands in the correct month's spend total instead of always using the moment it was confirmed.

Still not buildable inside an Artifact and deferred to the real backed app: actual AI vision OCR, actual AI recipe parsing, native mobile, multi-user household sharing, real cloud sync.

---

## 9. Real Backend (started 2026-08-03)

Started the real backend the prototype was always meant to hand off to. Lives in `server/` alongside the prototype in this same repo.

**Stack:** Node.js + TypeScript + Express. SQLite via Node's built-in `node:sqlite` (no native build step — deliberately avoids `better-sqlite3`/node-gyp given this machine's earlier permission/build friction). Real Claude API integration (`@anthropic-ai/sdk`, model `claude-opus-4-8`, structured outputs via `output_config.format` + Zod schemas) for the two things the prototype could only simulate:
- `POST /api/receipts/parse-image` — real vision OCR on a receipt photo, replacing the mock per-store data
- `POST /api/recipes/parse` — real AI ingredient parsing, replacing the mock line parser

Full REST API for items, categories (with rename-cascade / delete-while-unused-only), recipes, grocery, and receipts; the cook-recipe matching/reconciliation logic (ambiguous-match detection, volume-unit flagging, shortfall-to-grocery) was ported over from the prototype's JS. Verified against a live server: CRUD across all five resources, cook-and-deduct, category rename cascade, and the AI endpoints failing gracefully (502, server stays up) when no `ANTHROPIC_API_KEY` is configured.

**Update (2026-08-04): frontend wired to the backend.** `server/public/index.html` is the real app now — same design and flows as `pantry.html`, but talks to the backend via `fetch` instead of `localStorage`, and the backend serves it from the same origin (`http://localhost:3001`) so there's no CORS to manage. This was a bigger architectural move than "add fetch calls": an Artifact's sandbox blocks all outbound network requests except through a couple of narrow capabilities, so the app fundamentally could not call a local backend while still hosted as an Artifact. Moving to a real page served by Express was the only way through — which is also why `pantry.html` at the repo root is no longer the active version; it's kept as a reference/offline demo but is now a step behind.

Real backend, real change in what's possible:
- Receipt scanning: a real photo upload → real Claude vision OCR (`/api/receipts/parse-image`), not a per-store mock
- Recipe parsing: a real Claude call (`/api/recipes/parse`) — and unlike receipts, there's no local fallback left for this path, so adding a recipe now requires `ANTHROPIC_API_KEY` to be configured
- The receipt paste-text fallback (Farmers Market, forwarded emails) stayed local — a regex heuristic, not worth a model call
- Cook-recipe matching/reconciliation logic moved server-side entirely; the frontend just calls `/api/recipes/:id/cook` and renders whatever comes back
- Backup: real `<a download>` JSON export now that we're not Artifact-sandboxed; restore-from-file isn't built (no bulk-import endpoint yet)

Verified with a scripted Playwright pass against a live server (see `server/README.md` for the full flow list) — starter checklist, item CRUD, category rename cascade, quantity steppers, full grocery flow, receipt paste→review→confirm with a correct money-spent total, and the recipe-parse endpoint failing gracefully (toast, not a crash) with no API key configured.

**Update (2026-08-07): tests + backup restore.** The backend had real business logic (cook-recipe matching, category-rename cascade, receipt money totals) and zero automated coverage — that's the kind of thing that silently regresses as the app keeps growing, so this pass closed it:
- 29-test suite on Node's built-in test runner, running against an isolated in-memory SQLite database (never touches the real `pantry.db`) — covers cook-recipe logic directly (ambiguous matches, volume-unit flagging, shortfall-to-grocery) plus route-level tests for every resource, including the `/` character in `Household / Non-Food`-style category names surviving URL routing correctly
- The two AI-calling endpoints are skipped in the suite unless `ANTHROPIC_API_KEY` is set, rather than mocked — kept as true end-to-end checks against the real model instead of tests that would just confirm a hand-written fake behaves like a hand-written fake
- Along the way, extracted Express app construction (`app.ts`) from server startup (`index.ts`) so tests can spin up the app without binding a port — a standard testability refactor
- Completed the backup feature: `POST /api/backup/restore` (transactional — a malformed file can't leave the database half-wiped) plus the frontend upload-and-confirm UI, closing the gap flagged in the last update

Verified with `npm test` (29 passed, 1 correctly skipped without an API key) and a second scripted Playwright pass specifically driving the restore flow end-to-end through the real UI.

*Doc is ready to drive continued iteration on the real app in `server/`.*
