import { withNeo4jDriver } from "./import-helpers.js";
import languagesData from "./languages.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

export async function importLanguages(driver: Driver): Promise<void> {
  const languages = Object.entries(languagesData);

  console.log("Starting languages import...");
  console.log(`Found ${languages.length} languages to import\n`);

  for (const [code, name] of languages) {
    console.log(`Importing language: ${code}`);
    console.log(`  Canonical name: ${name}`);

    await driver.executeQuery(
      `
      MERGE (l:Language {code: $code})
      SET l.canonicalName = $name,
          l.verified = true,
          l.createdAt = timestamp(),
          l.createdBy = "system"
    `,
      { code, name },
    );
  }

  console.log("\n✅ Languages import completed!");
  console.log(`Total imported: ${languages.length} languages`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withNeo4jDriver(importLanguages);
}
