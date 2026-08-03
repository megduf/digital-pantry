import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import type { Ingredient, Recipe } from "../types.js";
import { parseRecipeText } from "../services/ai.js";
import { cookRecipe, resolveAmbiguous } from "../services/cook.js";

export const recipesRouter = Router();

function rowToRecipe(row: any): Recipe {
  return { ...row, ingredients: JSON.parse(row.ingredients) };
}

recipesRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM recipes ORDER BY name").all();
  res.json(rows.map(rowToRecipe));
});

// Real AI-based ingredient parsing (spec section 6, decision #3) — replaces the
// prototype's simulated parser now that a backend can call the model directly.
recipesRouter.post("/parse", async (req, res) => {
  const { raw_text } = req.body ?? {};
  if (!raw_text) return res.status(400).json({ error: "raw_text is required" });
  try {
    const ingredients = await parseRecipeText(raw_text);
    res.json({ ingredients });
  } catch (err) {
    console.error("recipe parse failed", err);
    res.status(502).json({ error: "recipe parsing failed" });
  }
});

recipesRouter.post("/", (req, res) => {
  const { name, raw_text, ingredients } = req.body ?? {};
  if (!name || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: "name and ingredients[] are required" });
  }
  const recipe: Recipe = {
    id: randomUUID(),
    name,
    raw_text: raw_text ?? null,
    ingredients: ingredients as Ingredient[],
    review_status: "confirmed",
  };
  db.prepare(
    "INSERT INTO recipes (id, name, raw_text, ingredients, review_status) VALUES (?, ?, ?, ?, 'confirmed')"
  ).run(recipe.id, recipe.name, recipe.raw_text, JSON.stringify(recipe.ingredients));
  res.status(201).json(recipe);
});

recipesRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM recipes WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "not found" });
  const { name, ingredients } = req.body ?? {};
  const updated = {
    name: name ?? existing.name,
    ingredients: ingredients ?? JSON.parse(existing.ingredients),
  };
  db.prepare("UPDATE recipes SET name=?, ingredients=? WHERE id=?").run(
    updated.name,
    JSON.stringify(updated.ingredients),
    req.params.id
  );
  res.json(rowToRecipe({ ...existing, ...updated, ingredients: JSON.stringify(updated.ingredients) }));
});

recipesRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM recipes WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

recipesRouter.post("/:id/cook", (req, res) => {
  try {
    const result = cookRecipe(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? "cook failed" });
  }
});

// Resolves one "needs your input" line from a cook result — either an ambiguous
// pantry match or a volume-unit ingredient the user chose to subtract manually.
recipesRouter.post("/:id/resolve", (req, res) => {
  const recipe = db.prepare("SELECT name FROM recipes WHERE id = ?").get(req.params.id) as
    | { name: string }
    | undefined;
  if (!recipe) return res.status(404).json({ error: "recipe not found" });
  const { itemId, ingredientName, needed, unit } = req.body ?? {};
  if (!itemId || needed == null) return res.status(400).json({ error: "itemId and needed are required" });
  try {
    resolveAmbiguous(itemId, ingredientName ?? "", needed, unit ?? "", recipe.name);
    res.status(204).end();
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? "resolve failed" });
  }
});
