import { withDriver } from "../src/neo4j.js";

import languagesData from "./languages.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_LANGUAGES_QUERY = `
  UNWIND $languages AS lang
  MERGE (l:Language {code: lang.code})
  SET l.canonicalName = lang.name,
      l.verified = true,
      l.createdAt = timestamp(),
      l.createdBy = "system"
`;

async function importLanguages(driver: Driver): Promise<void> {
  const languages = Object.entries(languagesData).map(([code, name]) => ({
    code,
    name,
  }));

  console.log("Starting languages import...");
  console.log(`Found ${languages.length} languages to import\n`);

  await driver.executeQuery(IMPORT_LANGUAGES_QUERY, { languages });

  console.log("\n✅ Languages import completed!");
  console.log(`Total imported: ${languages.length} languages`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importLanguages);
}
