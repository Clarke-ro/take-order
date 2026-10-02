import assert from "node:assert/strict";
import test from "node:test";
import { maskSecret, validateEnv } from "./env";

test("maskSecret correctly masks sensitive strings", () => {
  assert.equal(maskSecret(undefined), "<unset>");
  assert.equal(maskSecret(""), "<unset>");
  assert.equal(maskSecret("abcd"), "****");
  assert.equal(maskSecret("sk_live_123456789"), "sk_l****");
  assert.equal(maskSecret("postgres://user:pass@host:5432/db"), "post****");
});

test("validateEnv succeeds with valid development environment", () => {
  const result = validateEnv({
    NODE_ENV: "development",
    PORT: "3000",
    DATABASE_URL: "postgres://localhost:5432/takeorder",
  });
  assert.equal(result.PORT, 3000);
  assert.equal(result.NODE_ENV, "development");
});

test("validateEnv fails fast when DATABASE_URL is missing", () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: "development", DATABASE_URL: "" }),
    /DATABASE_URL is required/,
  );
});

test("validateEnv fails fast when CLERK_SECRET_KEY is missing in production", () => {
  assert.throws(
    () => validateEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://prod-db:5432/takeorder",
    }),
    /CLERK_SECRET_KEY is required in production environment/,
  );
});
