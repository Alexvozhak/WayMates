import { withDriver } from "../src/core/neo4j.js";

import rolesData from "./roles.json" with { type: "json" };

import type { Driver } from "neo4j-driver";

const IMPORT_ROLES_QUERY = `
  UNWIND $roles AS role
  MERGE (r:Role {canonicalName: role.canonicalName})
  SET r.description = role.description,
      r.verified = true,
      r.createdAt = timestamp(),
      r.createdBy = "system"
`;

async function importRoles(driver: Driver): Promise<void> {
  const roles = Object.values(rolesData).map((displayName) => ({
    canonicalName: displayName,
    description: displayName,
  }));

  console.log("Starting roles import...");
  console.log(`Found ${roles.length} roles to import\n`);

  await driver.executeQuery(IMPORT_ROLES_QUERY, { roles });

  console.log("\n✅ Roles import completed!");
  console.log(`Total imported: ${roles.length} roles`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await withDriver(importRoles);
}
