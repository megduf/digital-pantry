import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import type { PantryItem } from "../types.js";

function normName(s: string): string {
  return s.toLowerCase().trim().replace(/s$/, "");
}

function ensureCategory(name: string) {
  const existing = db.prepare("SELECT id FROM categories WHERE name = ?").get(name);
  if (!existing) db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
}

export interface AddItemInput {
  name: string;
  category: string;
  quantity_type?: "count" | "weight";
  quantity_value?: number;
  weight_unit?: string | null;
  source: PantryItem["source"];
  raw_label?: string | null;
}

export function addOrIncrementItem(data: AddItemInput): PantryItem {
  ensureCategory(data.category);

  const candidates = db.prepare("SELECT * FROM items WHERE category = ?").all(data.category) as unknown as PantryItem[];
  const existing = candidates.find((it) => normName(it.name) === normName(data.name));

  if (existing) {
    const newQty = (existing.quantity_value || 0) + (data.quantity_value ?? 0);
    const last_updated = new Date().toISOString();
    db.prepare("UPDATE items SET quantity_value = ?, last_updated = ? WHERE id = ?").run(
      newQty,
      last_updated,
      existing.id
    );
    return { ...existing, quantity_value: newQty, last_updated };
  }

  const item: PantryItem = {
    id: randomUUID(),
    name: data.name,
    category: data.category,
    quantity_type: data.quantity_type === "weight" ? "weight" : "count",
    quantity_value: data.quantity_value ?? 1,
    weight_unit: data.quantity_type === "weight" ? data.weight_unit ?? "lb" : null,
    source: data.source,
    raw_label: data.raw_label ?? null,
    last_updated: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO items (id, name, category, quantity_type, quantity_value, weight_unit, source, raw_label, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    item.id,
    item.name,
    item.category,
    item.quantity_type,
    item.quantity_value,
    item.weight_unit,
    item.source,
    item.raw_label,
    item.last_updated
  );
  return item;
}
