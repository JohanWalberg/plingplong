import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://hyrabostad:hyrabostad@localhost:5433/hyrabostad" },
  extensionsFilters: ["postgis"],
});
