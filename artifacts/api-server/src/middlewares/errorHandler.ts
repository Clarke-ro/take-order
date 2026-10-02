import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode || 500;
    this.code = options.code;
    this.details = options.details;
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  // 1. Zod request validation error
  if (err instanceof ZodError) {
    logger.warn({ path: req.path, issues: err.issues }, "Request validation error");
    res.status(400).json({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // 2. Custom AppError / HttpError
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, code: err.code, path: req.path }, err.message);
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  // 3. PostgreSQL constraint violations
  if (err && typeof err === "object" && "code" in err) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode === "23505") { // unique_violation
      logger.warn({ err, path: req.path }, "Database unique constraint violation");
      res.status(409).json({
        error: "A record with this information already exists.",
        code: "DUPLICATE_ENTRY",
      });
      return;
    }
  }

  // 4. General unhandled exception
  const statusCode = typeof err?.statusCode === "number" ? err.statusCode : typeof err?.status === "number" ? err.status : 500;
  const isProduction = process.env.NODE_ENV === "production";

  logger.error(
    {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      path: req.path,
      method: req.method,
    },
    "Unhandled API server error",
  );

  res.status(statusCode).json({
    error: isProduction && statusCode === 500 ? "Internal Server Error" : (err?.message || "Internal Server Error"),
    code: err?.code || (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : undefined),
  });
};
