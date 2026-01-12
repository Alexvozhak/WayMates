import { createServer } from "node:http";

import { captureException } from "@shared/sentry.js";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";


import { logger } from "./logger.js";
import { appRouter } from "./routers/app.router.js";

import type { CoreContext } from "./routers/trpc.js";

function createTRPCServer(context: CoreContext): ReturnType<typeof createServer> {
  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: () => context,
    onError: ({ error, path }) => {
      captureException(error, { path: path ?? "unknown" });
      logger.error({ err: error, path }, "tRPC error");
    },
  });

  return createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    trpcHandler(req, res);
  });
}

export function startTRPCServer(context: CoreContext, port: number, host: string): void {
  const server = createTRPCServer(context);

  server.listen(port, host);
  logger.info({ host, port }, "WayMates Core tRPC Server started");
}
