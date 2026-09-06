import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Reuse the connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __hyrabostadSql?: ReturnType<typeof postgres> };
const client = globalForDb.__hyrabostadSql ?? postgres(url, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.__hyrabostadSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
/** The executor inside db.transaction(); helpers accept either so they compose. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
