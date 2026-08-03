import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import type { GroceryItem, Ingredient, PantryItem, Recipe } from "../types.js";

const VOLUME_UNITS = ["cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons", "ml", "l", "liter", "liters"];

function normName(s: string): string {
  return s.toLowerCase().trim().replace(/s$/, "");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function loadItems(): PantryItem[] {
  return db.prepare("SELECT * FROM items").all() as unknown as PantryItem[];
}

function findMatches(items: PantryItem[], name: string): PantryItem[] {
  const n = normName(name);
  const exact = items.filter((it) => normName(it.name) === n);
  if (exact.length) return exact;
  return items.filter((it) => {
    const itn = normName(it.name);
    return itn.includes(n) || n.includes(itn);
  });
}

function updateItemQuantity(id: string, quantity_value: number) {
  db.prepare("UPDATE items SET quantity_value = ?, last_updated = ? WHERE id = ?").run(
    quantity_value,
    new Date().toISOString(),
    id
  );
}

function addOrIncrementGrocery(name: string, qty: number, unit: string, note: string) {
  const existing = db
    .prepare("SELECT * FROM grocery_items WHERE checked = 0")
    .all() as unknown as GroceryItem[];
  const match = existing.find((g) => normName(g.name) === normName(name));
  if (match) {
    db.prepare("UPDATE grocery_items SET quantity = ?, note = ? WHERE id = ?").run(
      round2(match.quantity + qty),
      note,
      match.id
    );
  } else {
    db.prepare(
      "INSERT INTO grocery_items (id, name, quantity, unit, note, source, checked) VALUES (?, ?, ?, ?, ?, 'auto', 0)"
    ).run(randomUUID(), name, qty, unit, note);
  }
}

export interface CookLineResult {
  name: string;
  amount: number;
  unit: string;
}

export interface AmbiguousReconcile {
  reason: "ambiguous";
  ingredient: Ingredient;
  candidates: { id: string; name: string }[];
}

export interface VolumeReconcile {
  reason: "volume";
  ingredient: Ingredient;
}

export type Reconcile = AmbiguousReconcile | VolumeReconcile;

export interface CookResult {
  subtracted: CookLineResult[];
  added: CookLineResult[];
  reconcile: Reconcile[];
}

export function cookRecipe(recipeId: string): CookResult {
  const row = db.prepare("SELECT * FROM recipes WHERE id = ?").get(recipeId) as
    | (Omit<Recipe, "ingredients"> & { ingredients: string })
    | undefined;
  if (!row) throw new Error("Recipe not found");
  const recipe: Recipe = { ...row, ingredients: JSON.parse(row.ingredients) };

  const items = loadItems();
  const subtracted: CookLineResult[] = [];
  const added: CookLineResult[] = [];
  const reconcile: Reconcile[] = [];

  for (const ing of recipe.ingredients) {
    const unit = (ing.unit || "").toLowerCase();
    if (VOLUME_UNITS.includes(unit)) {
      reconcile.push({ reason: "volume", ingredient: ing });
      continue;
    }
    const matches = findMatches(items, ing.name);
    const needed = ing.quantity || 1;

    if (matches.length > 1) {
      reconcile.push({
        reason: "ambiguous",
        ingredient: ing,
        candidates: matches.map((m) => ({ id: m.id, name: m.name })),
      });
      continue;
    }

    const match = matches[0];
    if (match && match.quantity_value >= needed) {
      const newQty = round2(match.quantity_value - needed);
      updateItemQuantity(match.id, newQty);
      match.quantity_value = newQty;
      subtracted.push({ name: match.name, amount: needed, unit: ing.unit });
    } else if (match) {
      const shortfall = round2(needed - match.quantity_value);
      updateItemQuantity(match.id, 0);
      match.quantity_value = 0;
      addOrIncrementGrocery(match.name, shortfall, ing.unit, `for ${recipe.name}`);
      added.push({ name: match.name, amount: shortfall, unit: ing.unit });
    } else {
      addOrIncrementGrocery(ing.name, needed, ing.unit, `for ${recipe.name}`);
      added.push({ name: ing.name, amount: needed, unit: ing.unit });
    }
  }

  return { subtracted, added, reconcile };
}

export function resolveAmbiguous(itemId: string, ingredientName: string, needed: number, unit: string, recipeName: string) {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId) as PantryItem | undefined;
  if (!item) throw new Error("Item not found");
  if (item.quantity_value >= needed) {
    updateItemQuantity(item.id, round2(item.quantity_value - needed));
  } else {
    const shortfall = round2(needed - item.quantity_value);
    updateItemQuantity(item.id, 0);
    addOrIncrementGrocery(item.name, shortfall, unit, `for ${recipeName}`);
  }
}
