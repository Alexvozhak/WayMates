import { withDriver } from "@core/neo4j.js";

import industriesData from "./industries.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_INDUSTRIES_QUERY = `
  UNWIND $industries AS industry
  MERGE (i:Industry {canonicalName: industry.canonicalName})
  SET i.description = industry.description,
      i.verified = true,
      i.createdAt = timestamp(),
      i.createdBy = "system"
`;

async function importIndustries(driver: Driver): Promise<void> {
  const industries = Object.values(industriesData).map((displayName) => ({
    canonicalName: displayName,
    description: displayName,
  }));

  console.log("Starting industries import...");
  console.log(`Found ${industries.length} industries to import\n`);

  await driver.executeQuery(IMPORT_INDUSTRIES_QUERY, { industries });

  console.log("\n✅ Industries import completed!");
  console.log(`Total imported: ${industries.length} industries`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importIndustries);
}
