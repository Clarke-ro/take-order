import path from "node:path";
import fs from "node:fs";

/**
 * Safety guard for Staging database operations.
 * Protects against accidental execution against production or main/dev databases.
 * Requires APP_ENV=staging and STAGING_PROJECT_REF in addition to URL safety and confirmation checks.
 */
export function assertStagingEnvironment(operationName: string): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      `[SAFETY ERROR] DATABASE_URL is not set. Cannot run '${operationName}' without a target database.`,
    );
  }

  // 1. Require explicit APP_ENV=staging
  if (process.env.APP_ENV !== "staging") {
    throw new Error(
      `[SAFETY BLOCKED] Refusing to execute '${operationName}'. Explicit staging environment is not identified (must set APP_ENV=staging).`,
    );
  }

  // 2. Require STAGING_PROJECT_REF and verify DATABASE_URL contains it
  const stagingProjectRef = process.env.STAGING_PROJECT_REF;
  if (!stagingProjectRef) {
    throw new Error(
      `[SAFETY BLOCKED] Refusing to execute '${operationName}'. STAGING_PROJECT_REF is not defined.`,
    );
  }

  if (!dbUrl.includes(stagingProjectRef)) {
    throw new Error(
      `[SAFETY BLOCKED] Refusing to execute '${operationName}'. Target DATABASE_URL does not contain the required staging ref (${stagingProjectRef}).`,
    );
  }

  // 3. Verify DATABASE_URL differs from main .env
  const mainEnvPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(mainEnvPath)) {
    const mainContent = fs.readFileSync(mainEnvPath, "utf-8");
    for (const line of mainContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("DATABASE_URL=")) {
        const mainUrl = trimmed.substring("DATABASE_URL=".length).trim();
        if (mainUrl && mainUrl === dbUrl) {
          throw new Error(
            `[SAFETY BLOCKED] Refusing to execute '${operationName}'. Staging DATABASE_URL is IDENTICAL to main dev .env DATABASE_URL.`,
          );
        }
      }
    }
  }

  // 4. Refuse if NODE_ENV is production
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[SAFETY BLOCKED] Refusing to execute '${operationName}' when NODE_ENV=production.`,
    );
  }

  // 5. Refuse if database URL contains production indicators unless explicitly forced
  const lowerUrl = dbUrl.toLowerCase();
  const isProdDbIndicator =
    lowerUrl.includes("prod") ||
    lowerUrl.includes("production") ||
    lowerUrl.includes("takeorder-prod") ||
    lowerUrl.includes("live");

  if (isProdDbIndicator && process.env.ALLOW_PROD_DANGEROUS !== "1") {
    throw new Error(
      `[SAFETY BLOCKED] Database URL appears to point to a PRODUCTION database. Refusing to run '${operationName}'. Set ALLOW_PROD_DANGEROUS=1 only if this is intended.`,
    );
  }

  // 6. Require confirmation flag
  const hasConfirmArg = process.argv.includes("--confirm");
  const hasConfirmEnv =
    process.env.CONFIRM_STAGING === "1" ||
    process.env.ALLOW_STAGING_SEED === "true" ||
    process.env.STAGING_CONFIRM === "1";

  if (!hasConfirmArg && !hasConfirmEnv) {
    console.warn(
      `\n⚠️  [STAGING SAFETY WARNING] Running '${operationName}' against staging database ref ${stagingProjectRef}.`,
    );
    console.warn(
      `To proceed without this prompt in automated pipelines, pass '--confirm' or set CONFIRM_STAGING=1.\n`,
    );
  }
}
