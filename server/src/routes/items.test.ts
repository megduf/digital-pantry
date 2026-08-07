process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("POST /api/items creates an item; a second POST with the same name+category increments it", async () => {
  const res1 = await ctx.api("POST", "/api/items", { name: "Milk", category: "Dairy & Eggs", quantity_type: "count", quantity_value: 1, source: "manual" });
  assert.equal(res1.status, 201);
  const item1 = await res1.json() as any;
  assert.equal(item1.quantity_value, 1);

  // "milk" (different case) should still match the same item by normalized name.
  const res2 = await ctx.api("POST", "/api/items", { name: "milk", category: "Dairy & Eggs", quantity_type: "count", quantity_value: 2, source: "manual" });
  assert.equal(res2.status, 201);
  const item2 = await res2.json() as any;
  assert.equal(item2.id, item1.id);
  assert.equal(item2.quantity_value, 3);
});

test("POST /api/items with an unknown category creates it automatically", async () => {
  const res = await ctx.api("POST", "/api/items", { name: "Kimchi", category: "Fermented", source: "manual" });
  assert.equal(res.status, 201);
  const cats = await (await ctx.api("GET", "/api/categories")).json() as any;
  assert.ok(cats.includes("Fermented"));
});

test("PATCH /api/items/:id edits an item", async () => {
  const created = await (await ctx.api("POST", "/api/items", { name: "Yogurt", category: "Dairy & Eggs", source: "manual" })).json() as any;
  const res = await ctx.api("PATCH", `/api/items/${created.id}`, { quantity_value: 5 });
  assert.equal(res.status, 200);
  const updated = await res.json() as any;
  assert.equal(updated.quantity_value, 5);
});

test("PATCH /api/items/:id on a missing id returns 404", async () => {
  const res = await ctx.api("PATCH", "/api/items/does-not-exist", { quantity_value: 1 });
  assert.equal(res.status, 404);
});

test("DELETE /api/items/:id removes the item entirely (mark as out, not zeroed)", async () => {
  const created = await (await ctx.api("POST", "/api/items", { name: "Butter", category: "Dairy & Eggs", source: "manual" })).json() as any;
  const del = await ctx.api("DELETE", `/api/items/${created.id}`);
  assert.equal(del.status, 204);
  const list = await (await ctx.api("GET", "/api/items")).json() as any;
  assert.ok(!list.some((it: any) => it.id === created.id));
});

test("POST /api/items requires name and category", async () => {
  const res = await ctx.api("POST", "/api/items", { name: "No Category" });
  assert.equal(res.status, 400);
});
