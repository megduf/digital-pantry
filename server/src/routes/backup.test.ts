process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("POST /api/backup/restore replaces all data with the backup's contents", async () => {
  // Seed some data that the restore should wipe.
  await ctx.api("POST", "/api/items", { name: "Should Be Gone", category: "Vegetables", source: "manual" });

  const backup = {
    categories: ["Custom Category"],
    items: [{
      id: "item-1", name: "Restored Milk", category: "Custom Category", quantity_type: "count",
      quantity_value: 2, weight_unit: null, source: "manual", raw_label: null, last_updated: "2026-08-01T00:00:00.000Z",
    }],
    recipes: [{ id: "recipe-1", name: "Restored Recipe", raw_text: null, ingredients: [{ name: "Milk", quantity: 1, unit: "" }], review_status: "confirmed" }],
    grocery: [{ id: "grocery-1", name: "Restored Grocery Item", quantity: 1, unit: null, note: null, source: "manual", checked: false }],
    receipts: [{ id: "receipt-1", store: "Restored Store", date: "2026-08-01T00:00:00.000Z", item_count: 1, total: 5 }],
  };

  const res = await ctx.api("POST", "/api/backup/restore", backup);
  assert.equal(res.status, 204);

  const items = await (await ctx.api("GET", "/api/items")).json() as any;
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Restored Milk");

  const cats = await (await ctx.api("GET", "/api/categories")).json() as any;
  assert.deepEqual(cats, ["Custom Category"]);

  const recipes = await (await ctx.api("GET", "/api/recipes")).json() as any;
  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].name, "Restored Recipe");

  const grocery = await (await ctx.api("GET", "/api/grocery")).json() as any;
  assert.equal(grocery.length, 1);

  const receipts = await (await ctx.api("GET", "/api/receipts")).json() as any;
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].total, 5);
});

test("POST /api/backup/restore rejects a malformed payload without touching existing data", async () => {
  await ctx.api("POST", "/api/items", { name: "Untouched", category: "Vegetables", source: "manual" });

  const res = await ctx.api("POST", "/api/backup/restore", { items: "not an array" });
  assert.equal(res.status, 400);

  const items = await (await ctx.api("GET", "/api/items")).json() as any;
  assert.ok(items.some((it: any) => it.name === "Untouched"));
});
