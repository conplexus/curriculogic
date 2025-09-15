// src/db/client.ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";
import { env } from "@/lib/env";

// ---- Env & SSL handling
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to your environment (.env.local) — e.g. postgres://user:pass@host:5432/db?sslmode=require"
  );
}

// Heuristics: enable SSL in prod or when sslmode=require|verify-ca|verify-full
const requiresSSL = (() => {
  try {
    const url = new URL(DATABASE_URL);
    const mode = url.searchParams.get("sslmode");
    if (mode && ["require", "verify-ca", "verify-full"].includes(mode)) return true;
  } catch {}
  return process.env.NODE_ENV === "production";
})();

// ---- Singleton Pool (safe across HMR & serverless invocations)
declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __db: NodePgDatabase<typeof schema> | undefined;
}

const pool: Pool =
  global.__dbPool ??
  new Pool({
    connectionString: DATABASE_URL,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  } as PoolConfig);

if (process.env.NODE_ENV !== "production") {
  global.__dbPool = pool;
}

// ---- Drizzle client
export const db: NodePgDatabase<typeof schema> =
  global.__db ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  global.__db = db;
}

export { schema };
