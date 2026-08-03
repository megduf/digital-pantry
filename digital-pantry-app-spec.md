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

Still not buildable inside an Artifact and deferred to the real backed app: actual AI vision OCR, actual AI recipe parsing, native mobile, multi-user household sharing, real cloud sync.

*Doc is ready to drive continued prototype iteration and, eventually, the real build.*
