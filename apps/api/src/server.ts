import { createApp } from "./app.js";
import { connectDb } from "./db/connection.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
    logger.info(`Health: http://localhost:${env.PORT}/api/v1/health`);
  });
}

main().catch((err) => {
  logger.error(err, "Failed to start API");
  process.exit(1);
});
