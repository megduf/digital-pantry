export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity_type: "count" | "weight";
  quantity_value: number;
  weight_unit: string | null;
  source: "receipt" | "manual" | "common-item-checklist";
  raw_label: string | null;
  last_updated: string;
}

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  raw_text: string | null;
  ingredients: Ingredient[];
  review_status: "pending" | "confirmed";
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
  source: "auto" | "manual";
  checked: boolean;
}

export interface Receipt {
  id: string;
  store: string;
  date: string;
  item_count: number;
  total: number | null;
}

export interface ParsedReceiptLine {
  raw: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  weight: boolean;
  price: number | null;
  notItem: boolean;
  cryptic: boolean;
}
