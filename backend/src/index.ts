import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { closeJellyfinConnections } from "./jellyfin/client.js";
import { JellyfinRealtime } from "./jellyfin/realtime.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const app = createApp();
  const server = createServer(app);
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 1_000;
  const realtime = new JellyfinRealtime();
  realtime.start();

  server.listen(config.port, "0.0.0.0", () => {
    logger.info({ port: config.port }, "WatchRadar listening over HTTP");
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    realtime.stop();
    server.close(() => {
      void Promise.allSettled([prisma.$disconnect(), closeJellyfinConnections()]).finally(() =>
        process.exit(0)
      );
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main().catch((error) => {
  logger.fatal({ err: error }, "Unable to start WatchRadar");
  process.exit(1);
});
