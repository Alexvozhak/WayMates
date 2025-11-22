import { createServer } from "node:http";

import { createHTTPHandler } from "@trpc/server/adapters/standalone";

import { appRouter } from "./routers/app.router.js";

import type { CoreContext } from "./routers/trpc.js";

function createTRPCServer(context: CoreContext): ReturnType<typeof createServer> {
  const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: () => context,
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
  console.log(`🚀 WayMates Core tRPC Server listening on ${host}:${port}`);
}
