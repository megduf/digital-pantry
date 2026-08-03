import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, listCategoryNames } from "../db.js";
import { addOrIncrementItem } from "../services/pantry.js";
import { parseReceiptImage, type ImageMediaType } from "../services/ai.js";

export const receiptsRouter = Router();

const ALLOWED_MEDIA_TYPES: ImageMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

receiptsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM receipts ORDER BY date DESC").all();
  res.json(rows);
});

// Real AI vision OCR (spec section 6, decision #2) — replaces the prototype's
// mock per-store receipt data now that a backend can call a vision model directly.
receiptsRouter.post("/parse-image", async (req, res) => {
  const { imageBase64, mediaType } = req.body ?? {};
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: "imageBase64 and mediaType are required" });
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: `mediaType must be one of ${ALLOWED_MEDIA_TYPES.join(", ")}` });
  }
  try {
    const lines = await parseReceiptImage(imageBase64, mediaType, listCategoryNames());
    res.json({ lines });
  } catch (err) {
    console.error("receipt parse failed", err);
    res.status(502).json({ error: "receipt parsing failed" });
  }
});

interface ConfirmLine {
  name: string;
  category: string;
  qty: number;
  unit: string;
  weight: boolean;
  price: number | null;
  raw: string;
  included: boolean;
}

// Confirms a reviewed receipt: adds included lines to the pantry and records
// the receipt's date/store/total for the money-spent summary (spec addition).
receiptsRouter.post("/confirm", (req, res) => {
  const { store, date, lines } = req.body ?? {};
  if (!store || !date || !Array.isArray(lines)) {
    return res.status(400).json({ error: "store, date, and lines[] are required" });
  }

  let itemCount = 0;
  let total = 0;
  for (const line of lines as ConfirmLine[]) {
    if (!line.included) continue;
    addOrIncrementItem({
      name: line.name,
      category: line.category,
      quantity_type: line.weight ? "weight" : "count",
      quantity_value: line.qty,
      weight_unit: line.weight ? "lb" : null,
      source: "receipt",
      raw_label: line.raw,
    });
    if (typeof line.price === "number") total = Math.round((total + line.price) * 100) / 100;
    itemCount++;
  }

  const receipt = { id: randomUUID(), store, date, item_count: itemCount, total };
  db.prepare("INSERT INTO receipts (id, store, date, item_count, total) VALUES (?, ?, ?, ?, ?)").run(
    receipt.id,
    receipt.store,
    receipt.date,
    receipt.item_count,
    receipt.total
  );
  res.status(201).json(receipt);
});
