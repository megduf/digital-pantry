process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("renaming a category cascades to every item that used it", async () => {
  await ctx.api("POST", "/api/categories", { name: "Baking Test" });
  await ctx.api("POST", "/api/items", { name: "Cocoa Powder", category: "Baking Test", source: "manual" });

  const rename = await ctx.api("PATCH", "/api/categories/" + encodeURIComponent("Baking Test"), { name: "Baking Renamed" });
  assert.equal(rename.status, 200);

  const items = await (await ctx.api("GET", "/api/items")).json() as any;
  const cocoa = items.find((it: any) => it.name === "Cocoa Powder");
  assert.equal(cocoa.category, "Baking Renamed");

  const cats = await (await ctx.api("GET", "/api/categories")).json() as any;
  assert.ok(cats.includes("Baking Renamed"));
  assert.ok(!cats.includes("Baking Test"));
});

test("renaming to an existing category name is rejected", async () => {
  await ctx.api("POST", "/api/categories", { name: "Rename Source" });
  const res = await ctx.api("PATCH", "/api/categories/" + encodeURIComponent("Rename Source"), { name: "Vegetables" });
  assert.equal(res.status, 409);
});

test("deleting a category with items is blocked; deleting an empty one succeeds", async () => {
  await ctx.api("POST", "/api/categories", { name: "Delete Test" });
  await ctx.api("POST", "/api/items", { name: "Placeholder", category: "Delete Test", source: "manual" });

  const blocked = await ctx.api("DELETE", "/api/categories/" + encodeURIComponent("Delete Test"));
  assert.equal(blocked.status, 409);

  // Category name with a "/" — verify the slash survives URL encoding/routing correctly,
  // since "Household / Non-Food" is a real default category with this exact shape.
  await ctx.api("POST", "/api/categories", { name: "Snacks / Treats" });
  const del = await ctx.api("DELETE", "/api/categories/" + encodeURIComponent("Snacks / Treats"));
  assert.equal(del.status, 204);
  const cats = await (await ctx.api("GET", "/api/categories")).json() as any;
  assert.ok(!cats.includes("Snacks / Treats"));
});

test("category names with a slash round-trip correctly through rename and delete", async () => {
  await ctx.api("POST", "/api/categories", { name: "A / B" });
  const rename = await ctx.api("PATCH", "/api/categories/" + encodeURIComponent("A / B"), { name: "C / D" });
  assert.equal(rename.status, 200);
  const del = await ctx.api("DELETE", "/api/categories/" + encodeURIComponent("C / D"));
  assert.equal(del.status, 204);
});
