import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;
if (!DSN) {
  console.error("SENTRY_DSN required");
  process.exit(1);
}

Sentry.init({
  dsn: DSN,
  environment: "production",
  release: "waymates@1.0.0",
  serverName: "facade",
});

class SearchGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchGraphError";
  }
}

console.log("Simulating realistic error from ConverseTool...\n");

const userId = "usr_019a6ea7-18be-770d-85a1-ea515ab10d65";
const sessionId = "sess_019a6ea7-18be-770d-85a1-ea515ab10d66";
const tool = "converse";
const requestId = "req_" + Date.now();

try {
  throw new SearchGraphError("Neo4j connection timeout after 30000ms");
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      tool,
      userId,
      sessionId,
      module: "facade",
      node: "search",
    },
    extra: {
      requestId,
      phase: "searching",
      query: "SELECT candidates with goal filter",
      userMessage: "Найди мне senior backend разработчиков",
    },
    user: {
      id: userId,
    },
  });
}

await Sentry.close(5000);

console.log("✅ Realistic error sent!");
console.log(`\nTags sent:`);
console.log(`  - userId: ${userId}`);
console.log(`  - sessionId: ${sessionId}`);
console.log(`  - tool: ${tool}`);
console.log(`  - module: facade`);
console.log(`  - node: search`);
console.log(`\nCheck Telegram for alert!`);
