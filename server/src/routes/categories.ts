import { Router } from "express";
import { db } from "../db.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT name FROM categories ORDER BY id").all() as { name: string }[];
  res.json(rows.map((r) => r.name));
});

categoriesRouter.post("/", (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(name);
  if (existing) return res.status(409).json({ error: "category already exists" });
  db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
  res.status(201).json({ name });
});

// Rename cascades to every item in that category, per spec section 3.5.
categoriesRouter.patch("/:name", (req, res) => {
  const oldName = req.params.name;
  const { name: newName } = req.body ?? {};
  if (!newName) return res.status(400).json({ error: "name is required" });
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(oldName);
  if (!existing) return res.status(404).json({ error: "not found" });
  const clash = db.prepare("SELECT id FROM categories WHERE name = ?").get(newName);
  if (clash) return res.status(409).json({ error: "target category already exists" });

  db.prepare("UPDATE categories SET name = ? WHERE name = ?").run(newName, oldName);
  db.prepare("UPDATE items SET category = ? WHERE category = ?").run(newName, oldName);
  res.json({ name: newName });
});

// Delete is blocked while items still use the category — reassign first.
categoriesRouter.delete("/:name", (req, res) => {
  const name = req.params.name;
  const inUse = db.prepare("SELECT COUNT(*) as n FROM items WHERE category = ?").get(name) as { n: number };
  if (inUse.n > 0) {
    return res.status(409).json({ error: `${inUse.n} item(s) still use this category` });
  }
  const info = db.prepare("DELETE FROM categories WHERE name = ?").run(name);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});
