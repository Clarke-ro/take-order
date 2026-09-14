import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import type { db } from "@workspace/db";
import { createRouter } from "./routes";
import { logger } from "./lib/logger";

export function createApp(database: typeof db): Express {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", createRouter(database));

  return app;
}
