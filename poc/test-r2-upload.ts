/**
 * R2 Upload Test - verify Cloudflare R2 credentials work
 */

import "dotenv/config";
import { getR2Config, R2StorageService } from "../src/chart/services/r2-storage.js";

async function testR2Upload(): Promise<void> {
  console.log("🧪 Testing R2 Upload...\n");

  // 1. Check config
  console.log("1️⃣ Checking R2 config...");
  const config = getR2Config();
  console.log(`   ✅ Account ID: ${config.accountId.slice(0, 8)}...`);
  console.log(`   ✅ Bucket: ${config.bucketName}`);
  console.log(`   ✅ Public URL: ${config.publicUrl}`);
  console.log(`   ✅ TTL Days: ${config.ttlDays}`);

  // 2. Create test HTML
  const testHtml = `<!DOCTYPE html>
<html>
<head><title>R2 Test</title></head>
<body>
  <h1>✅ R2 Upload Works!</h1>
  <p>Uploaded at: ${new Date().toISOString()}</p>
</body>
</html>`;

  // 3. Upload
  console.log("\n2️⃣ Uploading test file...");
  const storage = new R2StorageService(config);
  const result = await storage.upload(testHtml);

  console.log(`   ✅ URL: ${result.url}`);
  console.log(`   ✅ Expires: ${result.expiresAt}`);

  console.log("\n🎉 R2 Upload SUCCESS!");
  console.log(`\n🔗 Open in browser:\n   ${result.url}`);
}

testR2Upload().catch((error) => {
  console.error("❌ R2 Upload FAILED:", error);
  process.exit(1);
});
