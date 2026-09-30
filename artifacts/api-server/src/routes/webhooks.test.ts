import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import type { db } from "@workspace/db";
import { createApp } from "../app.js";

function createMockDatabase(): typeof db {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  } as unknown as typeof db;
}

test("GET /health returns 200 and ok status", async () => {
  const app = createApp(createMockDatabase(), {
    authMiddleware: (_req, _res, next) => next(),
  });
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.deepStrictEqual(body, { status: "ok" });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("POST /api/webhooks/revenuecat accepts valid webhook payload", async () => {
  const previousSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.REVENUECAT_WEBHOOK_SECRET = "test_webhook_secret_123";

  const app = createApp(createMockDatabase(), {
    authMiddleware: (_req, _res, next) => next(),
  });
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    // 1. Rejects missing auth header
    const missingAuthRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_test_webhook",
        },
      }),
    });
    assert.strictEqual(missingAuthRes.status, 401);

    // 2. Rejects invalid auth header (wrong secret)
    const invalidAuthRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer completely_wrong_secret_value",
      },
      body: JSON.stringify({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_test_webhook",
        },
      }),
    });
    assert.strictEqual(invalidAuthRes.status, 401);

    // 3. Accepts valid Bearer authorization
    const authorizedRes = await fetch(`http://127.0.0.1:${port}/api/webhooks/revenuecat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test_webhook_secret_123",
      },
      body: JSON.stringify({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_test_webhook",
          environment: "SANDBOX",
        },
      }),
    });
    assert.strictEqual(authorizedRes.status, 200);
    const body = (await authorizedRes.json()) as { received: boolean; appUserId: string; event: string };
    assert.strictEqual(body.received, true);
    assert.strictEqual(body.appUserId, "user_test_webhook");
    assert.strictEqual(body.event, "INITIAL_PURCHASE");
  } finally {
    process.env.REVENUECAT_WEBHOOK_SECRET = previousSecret;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
