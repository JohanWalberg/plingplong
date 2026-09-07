import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests against the docker database (pnpm db:up, db:migrate, db:seed first).
// The dev .env supplies DATABASE_URL locally; CI sets it in the environment.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env: rely on the environment
}

export default defineConfig({
  test: {
    include: ["src/**/*.dbtest.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
