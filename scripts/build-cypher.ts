#!/usr/bin/env tsx
import { promises as fs } from "fs";
import path from "path";

const CYPHER_DOMAINS = {
  upserts: "src/cypher/upserts",
  finders: "src/cypher/finders",
  processors: "src/cypher/processors",
} as const;

type DomainName = keyof typeof CYPHER_DOMAINS;

async function buildCypherConstants() {
  console.log("🔄 Building Cypher constants with domain grouping...");

  let output = `// Auto-generated from .cypher files - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Run: npm run build:cypher to regenerate

`;

  // Collect files by domain
  const filesByDomain: Record<
    DomainName,
    Array<{ file: string; content: string }>
  > = {
    upserts: [],
    finders: [],
    processors: [],
  };

  let totalFiles = 0;

  for (const [domainName, dir] of Object.entries(CYPHER_DOMAINS)) {
    try {
      const files = await fs.readdir(dir);
      const cypherFiles = files.filter((f) => f.endsWith(".cypher"));

      for (const file of cypherFiles) {
        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, "utf-8");
        filesByDomain[domainName as DomainName].push({ file, content });
        totalFiles++;
      }
    } catch {
      console.warn(`⚠️  Directory ${dir} not found, skipping...`);
    }
  }

  // Generate domain-grouped exports
  for (const [domainName, files] of Object.entries(filesByDomain)) {
    if (files.length === 0) continue;

    const capitalizedDomain =
      domainName.charAt(0).toUpperCase() + domainName.slice(1);

    output += `// ${capitalizedDomain} domain\nexport const ${capitalizedDomain} = {\n`;

    files.forEach(({ file, content }) => {
      const constName = file
        .replace(".cypher", "")
        .toUpperCase()
        .replace(/-/g, "_");

      // Preserve leading comments and newlines, but trim trailing whitespace
      const normalized = content
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\s+$/g, "");
      output += `  ${constName}: \`${normalized}\`,\n`;
    });

    output += `} as const;\n\n`;
  }

  // Write generated file
  const outputPath = "generated/queries.generated.ts";
  await fs.writeFile(outputPath, output);

  console.log(
    `✅ Generated ${totalFiles} constants grouped by domains in ${outputPath}`
  );

  // List generated domains and constants
  for (const [domainName, files] of Object.entries(filesByDomain)) {
    if (files.length === 0) continue;

    const capitalizedDomain =
      domainName.charAt(0).toUpperCase() + domainName.slice(1);
    console.log(`   📁 ${capitalizedDomain}:`);

    files.forEach(({ file }) => {
      const constName = file
        .replace(".cypher", "")
        .toUpperCase()
        .replace(/-/g, "_");
      console.log(`      • ${constName}`);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildCypherConstants().catch(console.error);
}
