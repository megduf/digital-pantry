import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import type { GroceryItem } from "../types.js";

export const groceryRouter = Router();

function rowToItem(row: any): GroceryItem {
  return { ...row, checked: !!row.checked };
}

groceryRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM grocery_items ORDER BY checked, name").all();
  res.json(rows.map(rowToItem));
});

groceryRouter.post("/", (req, res) => {
  const { name, quantity, unit } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const item: GroceryItem = {
    id: randomUUID(),
    name,
    quantity: quantity ?? 0,
    unit: unit ?? null,
    note: null,
    source: "manual",
    checked: false,
  };
  db.prepare(
    "INSERT INTO grocery_items (id, name, quantity, unit, note, source, checked) VALUES (?, ?, ?, ?, ?, 'manual', 0)"
  ).run(item.id, item.name, item.quantity, item.unit, item.note);
  res.status(201).json(item);
});

groceryRouter.patch("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM grocery_items WHERE id = ?").get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: "not found" });
  const { name, quantity, unit, checked } = req.body ?? {};
  const updated = {
    name: name ?? existing.name,
    quantity: quantity ?? existing.quantity,
    unit: unit ?? existing.unit,
    checked: checked ?? !!existing.checked,
  };
  db.prepare("UPDATE grocery_items SET name=?, quantity=?, unit=?, checked=? WHERE id=?").run(
    updated.name,
    updated.quantity,
    updated.unit,
    updated.checked ? 1 : 0,
    req.params.id
  );
  res.json(rowToItem({ ...existing, ...updated }));
});

groceryRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM grocery_items WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});
