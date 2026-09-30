import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  let userId: string | null | undefined = null;
  try {
    userId = getAuth(req).userId;
  } catch {
    // clerkMiddleware not mounted (e.g. in test or dev without Clerk keys)
  }
  if (!userId && process.env.NODE_ENV !== "production") {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer test-")) {
      userId = authHeader.replace("Bearer test-", "").trim();
    } else if (req.headers["x-test-user-id"]) {
      userId = String(req.headers["x-test-user-id"]).trim();
    }
  }
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};