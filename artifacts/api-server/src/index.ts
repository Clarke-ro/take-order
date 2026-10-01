import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { createApp } from "./app";

import { ensureDatabaseSchema } from "./lib/ensure-tables";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure database tables exist asynchronously
void ensureDatabaseSchema(db);

const app = createApp(db);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
