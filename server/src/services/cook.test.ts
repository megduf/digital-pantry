// Static imports in ESM are hoisted and evaluated before this module's own
// statements, regardless of source order — so setting PANTRY_DB_PATH above a
// `import { db } from "../db.js"` would NOT run before db.ts initializes.
// Dynamic import() after the assignment is what actually orders this correctly.
process.env.PANTRY_DB_PATH = ":memory:";

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { db } = await import("../db.js");
const { cookRecipe, resolveAmbiguous } = await import("./cook.js");

function seedItem(overrides: Partial<Record<string, unknown>> = {}) {
  const item = {
    id: randomUUID(),
    name: "Milk",
    category: "Dairy & Eggs",
    quantity_type: "count",
    quantity_value: 2,
    weight_unit: null,
    source: "manual",
    raw_label: null,
    last_updated: new Date().toISOString(),
    ...overrides,
  };
  db.prepare(
    `INSERT INTO items (id, name, category, quantity_type, quantity_value, weight_unit, source, raw_label, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    item.id, item.name as string, item.category as string, item.quantity_type as string,
    item.quantity_value as number, item.weight_unit as string | null, item.source as string,
    item.raw_label as string | null, item.last_updated as string
  );
  return item;
}

function seedRecipe(name: string, ingredients: { name: string; quantity: number; unit: string }[]) {
  const id = randomUUID();
  db.prepare("INSERT INTO recipes (id, name, raw_text, ingredients, review_status) VALUES (?, ?, NULL, ?, 'confirmed')").run(
    id, name, JSON.stringify(ingredients)
  );
  return id;
}

function getItem(id: string): any {
  return db.prepare("SELECT * FROM items WHERE id = ?").get(id);
}

test("cookRecipe subtracts from pantry when there's enough", () => {
  const item = seedItem({ name: "Eggs", quantity_value: 12 });
  const recipeId = seedRecipe("Omelette", [{ name: "Eggs", quantity: 2, unit: "" }]);

  const result = cookRecipe(recipeId);

  assert.equal(result.subtracted.length, 1);
  assert.equal(result.subtracted[0].name, "Eggs");
  assert.equal(result.subtracted[0].amount, 2);
  assert.equal(result.added.length, 0);
  assert.equal(result.reconcile.length, 0);
  assert.equal(getItem(item.id).quantity_value, 10);
});

test("cookRecipe sends the shortfall to the grocery list and zeroes the pantry item", () => {
  const item = seedItem({ name: "Butter", quantity_value: 1 });
  const recipeId = seedRecipe("Baking", [{ name: "Butter", quantity: 3, unit: "" }]);

  const result = cookRecipe(recipeId);

  assert.equal(result.subtracted.length, 0);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].amount, 2); // needed 3, had 1
  assert.equal(getItem(item.id).quantity_value, 0);

  const grocery = db.prepare("SELECT * FROM grocery_items").all() as any[];
  assert.equal(grocery.length, 1);
  assert.equal(grocery[0].name, "Butter");
  assert.equal(grocery[0].quantity, 2);
  assert.equal(grocery[0].source, "auto");
});

test("cookRecipe adds the full amount to grocery when the ingredient isn't in the pantry at all", () => {
  const recipeId = seedRecipe("Stir Fry", [{ name: "Soy Sauce", quantity: 1, unit: "" }]);

  const result = cookRecipe(recipeId);

  assert.equal(result.subtracted.length, 0);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].name, "Soy Sauce");
  assert.equal(result.added[0].amount, 1);
});

test("cookRecipe flags an ingredient that matches more than one pantry item instead of guessing", () => {
  seedItem({ name: "2% Milk", category: "Dairy & Eggs" });
  seedItem({ name: "Whole Milk", category: "Dairy & Eggs" });
  const recipeId = seedRecipe("Cereal", [{ name: "Milk", quantity: 1, unit: "" }]);

  const result = cookRecipe(recipeId);

  assert.equal(result.subtracted.length, 0);
  assert.equal(result.added.length, 0);
  assert.equal(result.reconcile.length, 1);
  assert.equal(result.reconcile[0].reason, "ambiguous");
  if (result.reconcile[0].reason === "ambiguous") {
    assert.equal(result.reconcile[0].candidates.length, 2);
  }
});

test("cookRecipe flags a volume-unit ingredient instead of guessing a conversion", () => {
  const item = seedItem({ name: "Rice", quantity_value: 5 });
  const recipeId = seedRecipe("Rice Bowl", [{ name: "Rice", quantity: 2, unit: "cups" }]);

  const result = cookRecipe(recipeId);

  assert.equal(result.subtracted.length, 0);
  assert.equal(result.reconcile.length, 1);
  assert.equal(result.reconcile[0].reason, "volume");
  // The pantry item is untouched until the user resolves it manually.
  assert.equal(getItem(item.id).quantity_value, 5);
});

test("resolveAmbiguous subtracts from the chosen item when there's enough", () => {
  const item = seedItem({ name: "Flour", quantity_value: 5 });
  seedRecipe("Bread", [{ name: "Flour", quantity: 2, unit: "" }]);

  resolveAmbiguous(item.id, "Flour", 2, "", "Bread");

  assert.equal(getItem(item.id).quantity_value, 3);
});

test("resolveAmbiguous sends the shortfall to grocery and zeroes the item when there isn't enough", () => {
  const item = seedItem({ name: "Sugar", quantity_value: 1 });

  resolveAmbiguous(item.id, "Sugar", 4, "cup", "Cake");

  assert.equal(getItem(item.id).quantity_value, 0);
  const grocery = db.prepare("SELECT * FROM grocery_items WHERE name = 'Sugar'").all() as any[];
  assert.equal(grocery.length, 1);
  assert.equal(grocery[0].quantity, 3);
  assert.equal(grocery[0].note, "for Cake");
});
