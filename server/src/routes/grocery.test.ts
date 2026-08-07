process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("POST /api/grocery defaults to manual source; source: 'auto' with a note is honored", async () => {
  const manual = await (await ctx.api("POST", "/api/grocery", { name: "Bananas", quantity: 6 })).json() as any;
  assert.equal(manual.source, "manual");
  assert.equal(manual.note, null);

  const auto = await (await ctx.api("POST", "/api/grocery", { name: "Butter", quantity: 1, unit: "lb", source: "auto", note: "for Pasta Bake" })).json() as any;
  assert.equal(auto.source, "auto");
  assert.equal(auto.note, "for Pasta Bake");
});

test("PATCH /api/grocery/:id edits and checks off an item", async () => {
  const created = await (await ctx.api("POST", "/api/grocery", { name: "Eggs", quantity: 12 })).json() as any;
  const res = await ctx.api("PATCH", `/api/grocery/${created.id}`, { checked: true, quantity: 6 });
  assert.equal(res.status, 200);
  const updated = await res.json() as any;
  assert.equal(updated.checked, true);
  assert.equal(updated.quantity, 6);
});

test("DELETE /api/grocery/:id removes the item", async () => {
  const created = await (await ctx.api("POST", "/api/grocery", { name: "Chips" })).json() as any;
  const del = await ctx.api("DELETE", `/api/grocery/${created.id}`);
  assert.equal(del.status, 204);
  const list = await (await ctx.api("GET", "/api/grocery")).json() as any;
  assert.ok(!list.some((g: any) => g.id === created.id));
});
