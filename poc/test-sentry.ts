import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;

if (!DSN) {
  console.error("SENTRY_DSN not set. Run with:");
  console.error("SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx npx tsx poc/test-sentry.ts");
  process.exit(1);
}

console.log("Initializing Sentry...");

Sentry.init({
  dsn: DSN,
  environment: "poc-test",
  release: "waymates@poc",
});

console.log("Sending test error to Sentry...");

try {
  throw new Error(`Telegram Alert Test #${Date.now()}`);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      tool: "poc-test",
      userId: "usr_00000000-0000-7000-8000-000000000001",
      sessionId: "sess_00000000-0000-7000-8000-000000000001",
    },
    extra: {
      message: "This is a test error to verify Sentry integration",
      timestamp: new Date().toISOString(),
    },
  });
}

console.log("Flushing events...");

await Sentry.close(5000);

console.log("\n✅ Test error sent!");
console.log("Check Sentry dashboard: https://sentry.io/issues/");
