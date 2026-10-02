import { z } from "zod";
import { logger } from "./logger";

/**
 * Mask secret string for safe logging (shows only first 4 characters).
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return "<unset>";
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "****";
  return `${trimmed.slice(0, 4)}****`;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  REVENUECAT_SECRET_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
}).superRefine((data, ctx) => {
  // In production, CLERK_SECRET_KEY is mandatory for seller authentication
  if (data.NODE_ENV === "production" && !data.CLERK_SECRET_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CLERK_SECRET_KEY"],
      message: "CLERK_SECRET_KEY is required in production environment",
    });
  }
});

export type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Validates process.env against the strict environment schema.
 * Throws a formatted error if validation fails, with secrets safely masked.
 */
export function validateEnv(rawEnv: Record<string, string | undefined> = process.env): ValidatedEnv {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => {
      const field = err.path.join(".");
      const val = rawEnv[field];
      return `  - ${field}: ${err.message} (current: ${maskSecret(val)})`;
    }).join("\n");

    const message = `[FATAL] Server environment validation failed:\n${errorDetails}`;
    logger.fatal(message);
    throw new Error(message);
  }

  logger.info({
    NODE_ENV: result.data.NODE_ENV,
    PORT: result.data.PORT,
    DATABASE_URL: maskSecret(result.data.DATABASE_URL),
    CLERK_SECRET_KEY: maskSecret(result.data.CLERK_SECRET_KEY),
    REVENUECAT_SECRET_KEY: maskSecret(result.data.REVENUECAT_SECRET_KEY),
    REVENUECAT_WEBHOOK_SECRET: maskSecret(result.data.REVENUECAT_WEBHOOK_SECRET),
    SUPABASE_URL: maskSecret(result.data.SUPABASE_URL),
  }, "Environment configuration validated successfully");

  return result.data;
}
