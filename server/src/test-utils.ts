import type { Server } from "node:http";
import { createApp } from "./app.js";

export async function startTestServer() {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  function api(method: string, path: string, body?: unknown) {
    return fetch(base + path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function close() {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return { base, api, close };
}
