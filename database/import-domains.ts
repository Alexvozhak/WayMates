import { withDriver } from "../src/core/neo4j.js";

import domainsData from "./domains.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_DOMAINS_QUERY = `
  UNWIND $domains AS canonicalName
  MERGE (d:WorkDomain {canonicalName: canonicalName})
  SET d.verified = true,
      d.createdAt = timestamp(),
      d.createdBy = "system"
`;

async function importDomains(driver: Driver): Promise<void> {
  const domains = Object.values(domainsData);

  console.log("Starting domains import...");
  console.log(`Found ${domains.length} domains to import\n`);

  await driver.executeQuery(IMPORT_DOMAINS_QUERY, { domains });

  console.log("\n✅ Domains import completed!");
  console.log(`Total imported: ${domains.length} domains`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importDomains);
}
