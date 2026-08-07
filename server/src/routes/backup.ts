import { Router } from "express";
import { db, DEFAULT_CATEGORIES } from "../db.js";

export const backupRouter = Router();

// Replaces all data with the contents of a previously exported backup.
// Wrapped in a transaction so a malformed file can't leave the database
// half-wiped.
backupRouter.post("/restore", (req, res) => {
  const { items, categories, recipes, grocery, receipts } = req.body ?? {};
  if (!Array.isArray(items) || !Array.isArray(recipes) || !Array.isArray(grocery) || !Array.isArray(receipts)) {
    return res.status(400).json({ error: "backup must include items[], recipes[], grocery[], and receipts[] arrays" });
  }
  const cats: string[] = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;

  try {
    db.exec("BEGIN");
    db.exec("DELETE FROM items");
    db.exec("DELETE FROM recipes");
    db.exec("DELETE FROM grocery_items");
    db.exec("DELETE FROM receipts");
    db.exec("DELETE FROM categories");

    const insCat = db.prepare("INSERT INTO categories (name) VALUES (?)");
    for (const c of cats) insCat.run(c);

    const insItem = db.prepare(
      `INSERT INTO items (id, name, category, quantity_type, quantity_value, weight_unit, source, raw_label, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const it of items) {
      insItem.run(
        it.id, it.name, it.category, it.quantity_type, it.quantity_value ?? 0,
        it.weight_unit ?? null, it.source, it.raw_label ?? null, it.last_updated
      );
    }

    const insRecipe = db.prepare(
      "INSERT INTO recipes (id, name, raw_text, ingredients, review_status) VALUES (?, ?, ?, ?, ?)"
    );
    for (const r of recipes) {
      insRecipe.run(r.id, r.name, r.raw_text ?? null, JSON.stringify(r.ingredients ?? []), r.review_status ?? "confirmed");
    }

    const insGrocery = db.prepare(
      "INSERT INTO grocery_items (id, name, quantity, unit, note, source, checked) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const g of grocery) {
      insGrocery.run(g.id, g.name, g.quantity ?? 0, g.unit ?? null, g.note ?? null, g.source ?? "manual", g.checked ? 1 : 0);
    }

    const insReceipt = db.prepare("INSERT INTO receipts (id, store, date, item_count, total) VALUES (?, ?, ?, ?, ?)");
    for (const r of receipts) {
      insReceipt.run(r.id, r.store, r.date, r.item_count ?? 0, r.total ?? null);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("restore failed", err);
    return res.status(400).json({ error: "That doesn't look like a valid backup file" });
  }
  res.status(204).end();
});
