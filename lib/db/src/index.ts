import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

function findRepoRoot(): string {
  let curr = process.cwd();
  while (curr && curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.resolve(curr, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.resolve(curr, ".env.staging.local")) ||
      fs.existsSync(path.resolve(curr, ".env"))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

const repoRoot = findRepoRoot();
const isStaging = process.env.APP_ENV === "staging" || !!process.env.STAGING_PROJECT_REF;

function safeLoadEnv(filePath: string, override: boolean = false): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const eqIdx = trimmed.indexOf("=");
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key && (override || !process.env[key])) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

if (isStaging) {
  // In staging mode, load ONLY .env.staging.local — NEVER fall back to .env
  delete process.env.DATABASE_URL;
  safeLoadEnv(path.resolve(repoRoot, ".env.staging.local"), true);
} else {
  safeLoadEnv(path.resolve(repoRoot, ".env"), false);
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

if (isStaging) {
  const stagingRef = process.env.STAGING_PROJECT_REF;
  if (!stagingRef) {
    throw new Error("[SAFETY BLOCKED] STAGING_PROJECT_REF is required in staging mode.");
  }
  if (!process.env.DATABASE_URL.includes(stagingRef)) {
    throw new Error(
      `[SAFETY BLOCKED] DATABASE_URL does not contain required staging ref (${stagingRef}).`,
    );
  }
}

const poolMax = Number(process.env.DB_POOL_MAX || (process.env.NODE_ENV === "production" ? 5 : 10));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 20000,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  keepAlive: true,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined,
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
});
export const db = drizzle(pool, { schema });

export * from "./schema/index";
