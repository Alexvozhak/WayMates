import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../src/core/routers/app.router.js";

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: "http://localhost:3001/trpc" })],
});

async function test() {
  try {
    console.log("Calling pathfinders endpoint...");
    const results = await client.search.pathfinders.query({
      userId: "test-user",
      referenceContext: {
        position: "middle",
        role: "developer",
      },
      targetContext: {
        position: { mode: "desired", values: ["senior"] },
      },
      excludedContextFields: [],
      excludedCreationReasons: [],
      targetRecencyMonths: null,
      referenceRecencyMonths: null,
      limit: 5,
    });

    console.log("Success! Results count:", results.length);
    console.log("Results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Error details:");
    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

test();
