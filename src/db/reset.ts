// Drops and recreates the public schema. Development only.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (process.env.NODE_ENV === "production") throw new Error("refusing to reset a production database");

const sql = postgres(url, { max: 1 });
await sql.unsafe("DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS postgis;");
await sql.end();
console.log("schema reset");
