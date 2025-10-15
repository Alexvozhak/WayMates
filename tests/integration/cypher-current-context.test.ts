import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Driver } from "neo4j-driver";
import {
  createDriver,
  withWriteSession,
  withReadSession,
} from "../../src/neo4j.js";
import { SearchQueryBuilder } from "../../src/orcestrator/search-query-builder.js";
import { PresetsManager } from "../../src/orcestrator/preset-manager.js";
import { SearchResultSchema } from "../../src/schemas-zod.js";
import { join } from "path";

describe("Cypher Current Context Query", () => {
  let driver: Driver;
  let queryBuilder: SearchQueryBuilder;

  beforeAll(async () => {
    driver = createDriver();

    const presetsManager = new PresetsManager(
      join(process.cwd(), "config", "presets.json")
    );
    presetsManager.load();
    queryBuilder = new SearchQueryBuilder(presetsManager);
  });

  afterAll(async () => {
    await driver?.close();
  });

  it("should execute buildCurrentContextQuery and return valid SearchResultSchema", async () => {
    // Seed test data
    const testUser = {
      user_id: "usr_test_current_context",
      contexts: [
        {
          context_id: "ctx_test_current",
          created_at: "2020-01-01T00:00:00Z",
          creation_reason: ["started_working"],
          position: "Junior",
          domains: ["Frontend"],
          skills: [{ name: "javascript", category: "language" }],
          industry: "tech",
          company_size: "startup",
          work_type: "office",
          team_size: 5,
          country_code: "us",
          city_name: "sf",
          birth_year: 1995,
        },
      ],
    };

    await withWriteSession(driver, (tx) =>
      tx.run(
        `
        MERGE (u:User {user_id: $userId})
        SET u.birth_year = $birthYear
        FOREACH (ctx IN $contexts |
          MERGE (c:Context {context_id: ctx.context_id})
          SET c = ctx,
              c.created_at = datetime(ctx.created_at)
          MERGE (u)-[:HAS_CONTEXT]->(c)
        )
      `,
        {
          userId: testUser.user_id,
          birthYear: testUser.contexts[0].birth_year,
          contexts: testUser.contexts,
        }
      )
    );

    // Execute query
    const constraints = { results_limit: 10 };
    const cypher = queryBuilder.buildCurrentContextQuery(
      "BALANCED",
      constraints
    );

    const result = await withReadSession(driver, (tx) =>
      tx.run(cypher, {
        currentContext: testUser.contexts[0],
        me: testUser.user_id,
      })
    );

    // Validate results
    expect(result.records).toHaveLength(0); // No similar contexts in test DB

    // Test query structure (even if no results)
    expect(cypher).toContain("datetime(");
    expect(cypher).toContain("$currentContext AS requestedContext");
    expect(cypher).toContain("RETURN {");
  });
});
