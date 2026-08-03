import { Router } from "express";
import { db } from "../db.js";
import type { PantryItem } from "../types.js";
import { addOrIncrementItem } from "../services/pantry.js";

export const itemsRouter = Router();

function ensureCategory(name: string) {
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(name);
  if (!existing) db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
}

itemsRouter.get("/", (_req, res) => {
  const items = db.prepare("SELECT * FROM items ORDER BY name").all();
  res.json(items);
});

itemsRouter.post("/", (req, res) => {
  const { name, category, quantity_type, quantity_value, weight_unit, source, raw_label } = req.body ?? {};
  if (!name || !category) return res.status(400).json({ error: "name and category are required" });
  const item = addOrIncrementItem({
    name,
    category,
    quantity_type,
    quantity_value,
    weight_unit,
    source: source ?? "manual",
    raw_label,
  });
  res.status(201).json(item);
});

itemsRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id) as PantryItem | undefined;
  if (!existing) return res.status(404).json({ error: "not found" });

  const { name, category, quantity_type, quantity_value, weight_unit } = req.body ?? {};
  if (category) ensureCategory(category);

  const updated: PantryItem = {
    ...existing,
    name: name ?? existing.name,
    category: category ?? existing.category,
    quantity_type: quantity_type ?? existing.quantity_type,
    quantity_value: quantity_value ?? existing.quantity_value,
    weight_unit:
      quantity_type === "weight" ? weight_unit ?? existing.weight_unit : quantity_type === "count" ? null : existing.weight_unit,
    last_updated: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE items SET name=?, category=?, quantity_type=?, quantity_value=?, weight_unit=?, last_updated=? WHERE id=?`
  ).run(
    updated.name,
    updated.category,
    updated.quantity_type,
    updated.quantity_value,
    updated.weight_unit,
    updated.last_updated,
    updated.id
  );
  res.json(updated);
});

// "Mark as out" — items are removed entirely, not zeroed (per spec section 2.1).
itemsRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});
