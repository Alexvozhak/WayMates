import { createHTTPServer } from "@trpc/server/adapters/standalone";

import { appRouter } from "./routers/_app.js";

import type { CoreContext } from "./routers/trpc.js";

function createTRPCServer(context: CoreContext): ReturnType<typeof createHTTPServer> {
  return createHTTPServer({
    router: appRouter,
    createContext: () => context,
  });
}

export function startTRPCServer(context: CoreContext, port: number, host: string): void {
  const server = createTRPCServer(context);

  server.listen(port, host);
  console.log(`🚀 WayMates Core tRPC Server listening on ${host}:${port}`);
}
