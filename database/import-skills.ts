import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";
import { z } from "zod";

import { withDriver } from "../src/neo4j.js";

import type { Driver } from "neo4j-driver";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const YAML_FILE = "skills.yaml";

const IMPORT_SKILLS_QUERY = `
  UNWIND $skills AS skill
  MERGE (s:Skill {canonicalName: skill.canonicalName})
  SET s.complexity = skill.complexity,
      s.verified = true,
      s.createdAt = timestamp(),
      s.createdBy = "system"
`;

const skillsConfigSchema = z.object({
  skills: z.record(z.string(), z.number().min(0).max(100)),
});

async function importSkillsFromYAML(driver: Driver): Promise<void> {
  const yamlPath = path.join(dirname, YAML_FILE);
  const yamlContent = fs.readFileSync(yamlPath, "utf8");
  const rawData = YAML.parse(yamlContent);
  const data = skillsConfigSchema.parse(rawData);

  console.log("Starting skills import from YAML...");

  const skills = Object.entries(data.skills).map(([canonicalName, complexity]) => ({
    canonicalName,
    complexity,
  }));

  console.log(`Found ${skills.length} skills to import\n`);

  await driver.executeQuery(IMPORT_SKILLS_QUERY, { skills });

  console.log("\n✅ Skills import completed!");
  console.log(`Total imported: ${skills.length} skills`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importSkillsFromYAML);
}
