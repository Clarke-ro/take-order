import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { createApp } from "./app";

import { ensureDatabaseSchema } from "./lib/ensure-tables";

import { validateEnv } from "./lib/env";

// Fail fast on missing/malformed required secrets before starting services
const env = validateEnv();
const port = env.PORT;

// Ensure database tables exist before listening
await ensureDatabaseSchema(db);

const app = createApp(db);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
