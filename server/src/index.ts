import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Pantry app running at http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set — receipt scanning and recipe parsing will fail until it is.");
  }
});
