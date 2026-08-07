import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Tests set PANTRY_DB_PATH=:memory: for a fresh, isolated database per process.
const dbPath = process.env.PANTRY_DB_PATH || path.join(__dirname, "..", "pantry.db");

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity_type TEXT NOT NULL CHECK (quantity_type IN ('count','weight')),
    quantity_value REAL NOT NULL DEFAULT 0,
    weight_unit TEXT,
    source TEXT NOT NULL,
    raw_label TEXT,
    last_updated TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    raw_text TEXT,
    ingredients TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'confirmed'
  );

  CREATE TABLE IF NOT EXISTS grocery_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    checked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    store TEXT NOT NULL,
    date TEXT NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    total REAL
  );
`);

export const DEFAULT_CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Starches",
  "Meat & Poultry",
  "Seafood",
  "Dairy & Eggs",
  "Pantry Staples",
  "Frozen",
  "Beverages",
  "Snacks",
  "Household / Non-Food",
];

const categoryCount = db.prepare("SELECT COUNT(*) as n FROM categories").get() as { n: number };
if (categoryCount.n === 0) {
  const insert = db.prepare("INSERT INTO categories (name) VALUES (?)");
  for (const name of DEFAULT_CATEGORIES) insert.run(name);
}

export function listCategoryNames(): string[] {
  const rows = db.prepare("SELECT name FROM categories ORDER BY id").all() as { name: string }[];
  return rows.map((r) => r.name);
}
