import assert from "node:assert/strict";
import test from "node:test";
import { z, ZodError } from "zod";
import { AppError, errorHandler } from "./errorHandler";

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

test("errorHandler formats ZodError as 400 with details", () => {
  const schema = z.object({ name: z.string().min(3) });
  let zodError: ZodError | null = null;
  try {
    schema.parse({ name: "a" });
  } catch (err) {
    zodError = err as ZodError;
  }

  const req: any = { path: "/api/products", method: "POST" };
  const res = createMockResponse();

  errorHandler(zodError!, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "VALIDATION_ERROR");
  assert.ok(Array.isArray(res.body.details));
});

test("errorHandler handles AppError with custom status and code", () => {
  const appError = new AppError({
    message: "Active link limit reached",
    statusCode: 403,
    code: "LINK_LIMIT_REACHED",
  });

  const req: any = { path: "/api/orders", method: "POST" };
  const res = createMockResponse();

  errorHandler(appError, req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "LINK_LIMIT_REACHED");
  assert.equal(res.body.error, "Active link limit reached");
});

test("errorHandler catches Postgres unique violation (23505) and returns 409", () => {
  const pgError = { code: "23505", detail: "Key already exists" };

  const req: any = { path: "/api/products", method: "POST" };
  const res = createMockResponse();

  errorHandler(pgError, req, res, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "DUPLICATE_ENTRY");
});
