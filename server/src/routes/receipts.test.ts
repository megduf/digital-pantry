process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("POST /api/receipts/confirm adds only the included lines and totals their prices", async () => {
  const res = await ctx.api("POST", "/api/receipts/confirm", {
    store: "Trader Joe's",
    date: "2026-08-01T12:00:00.000Z",
    lines: [
      { name: "Bananas", category: "Fruits", qty: 1, unit: "count", weight: false, price: 1.99, raw: "TJ ORG BANANAS", included: true },
      { name: "", category: "", qty: 0, unit: "", weight: false, price: null, raw: "SUBTOTAL", included: false },
      { name: "Eggs", category: "Dairy & Eggs", qty: 1, unit: "count", weight: false, price: 4.29, raw: "ORG EGGS LG DZ", included: true },
    ],
  });
  assert.equal(res.status, 201);
  const receipt = await res.json() as any;
  assert.equal(receipt.item_count, 2);
  assert.equal(receipt.total, 6.28);
  assert.equal(receipt.store, "Trader Joe's");

  const items = await (await ctx.api("GET", "/api/items")).json() as any;
  assert.ok(items.some((it: any) => it.name === "Bananas"));
  assert.ok(items.some((it: any) => it.name === "Eggs"));

  const receipts = await (await ctx.api("GET", "/api/receipts")).json() as any;
  assert.equal(receipts.length, 1);
});

test("POST /api/receipts/confirm requires store, date, and lines[]", async () => {
  const res = await ctx.api("POST", "/api/receipts/confirm", { store: "Costco" });
  assert.equal(res.status, 400);
});

// Vision OCR calls the real Claude API and needs ANTHROPIC_API_KEY — skipped
// rather than mocked, so it stays a true end-to-end check when a key exists.
test("POST /api/receipts/parse-image rejects an unsupported media type before calling the model", async () => {
  const res = await ctx.api("POST", "/api/receipts/parse-image", { imageBase64: "AAAA", mediaType: "image/bmp" });
  assert.equal(res.status, 400);
});
