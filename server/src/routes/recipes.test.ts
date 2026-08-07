process.env.PANTRY_DB_PATH = ":memory:";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const { startTestServer } = await import("../test-utils.js");

let ctx: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { ctx = await startTestServer(); });
after(async () => { await ctx.close(); });

test("POST /api/recipes saves a recipe; PATCH edits it; DELETE removes it", async () => {
  const created = await (await ctx.api("POST", "/api/recipes", {
    name: "Cereal Bowl",
    ingredients: [{ name: "Milk", quantity: 1, unit: "" }],
  })).json() as any;
  assert.equal(created.name, "Cereal Bowl");
  assert.equal(created.ingredients.length, 1);

  const edited = await (await ctx.api("PATCH", `/api/recipes/${created.id}`, {
    name: "Cereal Bowl (Big)",
    ingredients: [{ name: "Milk", quantity: 2, unit: "" }],
  })).json() as any;
  assert.equal(edited.name, "Cereal Bowl (Big)");
  assert.equal(edited.ingredients[0].quantity, 2);

  const del = await ctx.api("DELETE", `/api/recipes/${created.id}`);
  assert.equal(del.status, 204);
  const list = await (await ctx.api("GET", "/api/recipes")).json() as any;
  assert.ok(!list.some((r: any) => r.id === created.id));
});

test("POST /api/recipes requires name and ingredients[]", async () => {
  const res = await ctx.api("POST", "/api/recipes", { name: "No Ingredients" });
  assert.equal(res.status, 400);
});

test("POST /api/recipes/:id/cook on a missing recipe returns 404", async () => {
  const res = await ctx.api("POST", "/api/recipes/does-not-exist/cook");
  assert.equal(res.status, 404);
});

test("cooking a recipe end-to-end through the API subtracts from the pantry", async () => {
  await ctx.api("POST", "/api/items", { name: "Eggs", category: "Dairy & Eggs", quantity_type: "count", quantity_value: 12, source: "manual" });
  const recipe = await (await ctx.api("POST", "/api/recipes", {
    name: "Omelette",
    ingredients: [{ name: "Eggs", quantity: 2, unit: "" }],
  })).json() as any;

  const cook = await (await ctx.api("POST", `/api/recipes/${recipe.id}/cook`)).json() as any;
  assert.equal(cook.subtracted.length, 1);
  assert.equal(cook.subtracted[0].amount, 2);

  const items = await (await ctx.api("GET", "/api/items")).json() as any;
  const eggs = items.find((it: any) => it.name === "Eggs");
  assert.equal(eggs.quantity_value, 10);
});

// Recipe ingredient parsing (POST /api/recipes/parse) calls the real Claude API
// and needs ANTHROPIC_API_KEY — skipped here rather than mocked, so it stays a
// true end-to-end check when a key is available instead of testing a fake.
test("POST /api/recipes/parse produces structured ingredients from raw text", { skip: !process.env.ANTHROPIC_API_KEY }, async () => {
  const res = await ctx.api("POST", "/api/recipes/parse", { raw_text: "2 cups flour\n1 lb chicken breast\n3 cloves garlic" });
  assert.equal(res.status, 200);
  const body = await res.json() as any;
  assert.ok(Array.isArray(body.ingredients));
  assert.ok(body.ingredients.length >= 3);
});
