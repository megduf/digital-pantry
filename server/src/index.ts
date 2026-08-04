import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { itemsRouter } from "./routes/items.js";
import { categoriesRouter } from "./routes/categories.js";
import { recipesRouter } from "./routes/recipes.js";
import { groceryRouter } from "./routes/grocery.js";
import { receiptsRouter } from "./routes/receipts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
// Receipt photos travel as base64 JSON — raise the body limit above express's 100kb default.
app.use(express.json({ limit: "15mb" }));

app.use("/api/items", itemsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/grocery", groceryRouter);
app.use("/api/receipts", receiptsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: !!process.env.ANTHROPIC_API_KEY }));

// The frontend is served from the same origin as the API — no CORS needed
// in normal use, and no cross-origin restrictions to fight (an Artifact's
// sandbox blocks calls to a local backend entirely, which is why this app
// isn't hosted as an Artifact anymore).
app.use(express.static(path.join(__dirname, "..", "public")));

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Pantry app running at http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — receipt scanning and recipe parsing will fail until it is.");
  }
});
