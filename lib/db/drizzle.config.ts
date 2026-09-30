import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

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
  // Override any empty/leftover variables from earlier sessions
  delete process.env.DATABASE_URL;
  safeLoadEnv(path.resolve(repoRoot, ".env.staging.local"), true);
} else {
  // Main dev mode: load .env
  safeLoadEnv(path.resolve(repoRoot, ".env"), false);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL is not set. Ensure the database is provisioned.");
}

// Staging identity enforcement
if (isStaging) {
  const stagingRef = process.env.STAGING_PROJECT_REF;
  if (!stagingRef) {
    throw new Error("[SAFETY BLOCKED] STAGING_PROJECT_REF is required in staging mode.");
  }
  if (!dbUrl.includes(stagingRef)) {
    throw new Error(
      `[SAFETY BLOCKED] DATABASE_URL does not contain the required staging ref (${stagingRef}).`,
    );
  }

  // Verify differs from main .env
  const mainEnv = path.resolve(repoRoot, ".env");
  if (fs.existsSync(mainEnv)) {
    const mainContent = fs.readFileSync(mainEnv, "utf-8");
    for (const line of mainContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        const mainUrl = trimmed.substring("DATABASE_URL=".length).trim();
        if (mainUrl && mainUrl === dbUrl) {
          throw new Error(
            "[SAFETY BLOCKED] Staging DATABASE_URL is IDENTICAL to main dev .env DATABASE_URL.",
          );
        }
      }
    }
  }
}

const lowerUrl = dbUrl.toLowerCase();
const isProdDbIndicator =
  lowerUrl.includes("prod") ||
  lowerUrl.includes("production") ||
  lowerUrl.includes("takeorder-prod") ||
  lowerUrl.includes("live");

if (isProdDbIndicator && process.env.ALLOW_PROD_DANGEROUS !== "1") {
  throw new Error(
    "[SAFETY BLOCKED] DATABASE_URL appears to point to a PRODUCTION database. Refusing to run db:push without ALLOW_PROD_DANGEROUS=1.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
