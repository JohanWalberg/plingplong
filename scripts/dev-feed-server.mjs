// Serves the adapter fixtures over HTTP for local end-to-end crawls.
// Usage: node scripts/dev-feed-server.mjs [port]
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const port = Number(process.argv[2] ?? 4010);
const dir = "src/worker/adapters/fixtures";
const types = { xml: "application/xml", json: "application/json", html: "text/html" };

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nAllow: /\n");
  const file = join(dir, url.pathname.replace(/^\//, ""));
  if (!existsSync(file)) return res.writeHead(404).end("not found");
  const ext = file.split(".").pop();
  res.writeHead(200, { "content-type": types[ext] ?? "text/plain" }).end(readFileSync(file));
}).listen(port, () => console.log(`fixture server on http://localhost:${port}`));
