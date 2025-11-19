import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { DatabaseContext } from "../../../src/database-context.js";
import { DictionariesManager } from "../../../src/core/dictionaries-manager.js";
import { createDriver } from "../../../src/neo4j.js";

import type { Driver } from "neo4j-driver";

describe("Dictionaries Integration", () => {
  let driver: Driver;
  let db: DatabaseContext;
  let dictionariesManager: DictionariesManager;

  beforeAll(() => {
    driver = createDriver();
    db = new DatabaseContext(driver);
    dictionariesManager = new DictionariesManager(db);
  });

  afterAll(async () => {
    await driver.close();
  });

  // Business Logic: Verify that skills.yaml (85 skills) is imported with correct complexity values
  // This validates the entire seed data pipeline: yaml → import-skills.ts → Neo4j → getVerifiedDictionaries
  it("D1: getVerifiedDictionaries returns skills with complexity from yaml", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: skills.yaml contains 85 skills (as of ADR-009)
    // Test runs AFTER other integration tests, so DB may have additional skills from fixtures
    expect(dictionaries.skills.length).toBeGreaterThanOrEqual(85);

    // Business Rule: Specific complexity values from skills.yaml must match
    const skillsByName = new Map(dictionaries.skills.map((s) => [s.canonicalName, s.complexity]));

    // Verify sample of complexity values from different categories in skills.yaml
    expect(skillsByName.get("rust")).toBe(88); // Programming language
    expect(skillsByName.get("python")).toBe(60); // Programming language
    expect(skillsByName.get("typescript")).toBe(55); // Programming language
    expect(skillsByName.get("django")).toBe(70); // Web framework
    expect(skillsByName.get("kubernetes")).toBe(85); // Infrastructure
  });

  // Business Logic: Verify all dictionary types structure and that seed data is loaded
  // This ensures getVerifiedDictionaries returns correct schema shape
  it("D2: getVerifiedDictionaries returns all dictionary types with correct structure", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: All dictionary type keys must exist (even if empty arrays)
    expect(dictionaries).toHaveProperty("skills");
    expect(dictionaries).toHaveProperty("positions");
    expect(dictionaries).toHaveProperty("domains");
    expect(dictionaries).toHaveProperty("cities");
    expect(dictionaries).toHaveProperty("industries");
    expect(dictionaries).toHaveProperty("platforms");
    expect(dictionaries).toHaveProperty("languages");

    // Business Rule: Skills and languages must be imported from yaml/json seed data
    expect(dictionaries.skills.length).toBeGreaterThan(80); // ~85 from yaml minimum
    expect(dictionaries.languages.length).toBeGreaterThan(0); // from languages.json

    // Business Rule: Skills return structure is {canonicalName, complexity}
    const sampleSkill = dictionaries.skills[0];
    expect(sampleSkill).toBeDefined();
    expect(sampleSkill?.canonicalName).toBeDefined();
    expect(sampleSkill?.complexity).toBeDefined();
    expect(typeof sampleSkill?.canonicalName).toBe("string");
    expect(typeof sampleSkill?.complexity).toBe("number");

    // Business Rule: Other types return string[] (canonical names only)
    if (dictionaries.languages.length > 0) {
      expect(typeof dictionaries.languages[0]).toBe("string");
    }
  });

  // Business Logic: addTerm creates new skill with complexity
  // Discriminated union API requires complexity for type="skill"
  it("D3: addTerm creates new skill with correct complexity", async () => {
    const newSkillName = `test-skill-${Date.now()}`;
    const expectedComplexity = 75;

    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: newSkillName,
      complexity: expectedComplexity,
      verified: true,
      createdBy: "test-user",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();
    const addedSkill = dictionaries.skills.find((s) => s.canonicalName === newSkillName);

    // Business Rule: Newly added skill must exist with correct complexity
    expect(addedSkill).toBeDefined();
    expect(addedSkill?.complexity).toBe(expectedComplexity);
  });

  // Business Logic: MERGE idempotency - ON CREATE SET should preserve FIRST values
  // When same canonicalName is added twice, database should keep first creation data
  it("D4: addTerm is idempotent - MERGE preserves first creation", async () => {
    const skillName = `idempotent-skill-${Date.now()}`;
    const firstComplexity = 60;
    const secondComplexity = 80;

    // First call: creates node with complexity=60, verified=true, createdBy=user1
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: firstComplexity,
      verified: true,
      createdBy: "user1",
    });

    // Second call: attempts to create with different values
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: secondComplexity,
      verified: false,
      createdBy: "user2",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();
    const skill = dictionaries.skills.find((s) => s.canonicalName === skillName);

    // Business Rule: MERGE with ON CREATE SET keeps FIRST values
    // Second call should NOT update existing node
    expect(skill).toBeDefined();
    expect(skill?.complexity).toBe(firstComplexity); // NOT secondComplexity
  });

  // Business Logic: addTerm supports all dictionary types (position, domain, city, etc.)
  // Each type creates corresponding label node (Position, WorkDomain, City, etc.)
  it("D5: addTerm supports all dictionary types", async () => {
    const timestamp = Date.now();

    await dictionariesManager.addTerm({
      type: "position",
      canonicalName: `test-position-${timestamp}`,
      verified: true,
      createdBy: "test-user",
    });

    await dictionariesManager.addTerm({
      type: "domain",
      canonicalName: `test-domain-${timestamp}`,
      verified: true,
      createdBy: "test-user",
    });

    await dictionariesManager.addTerm({
      type: "city",
      canonicalName: `test-city-${timestamp}`,
      verified: true,
      createdBy: "test-user",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: Each term must be retrievable after creation
    expect(dictionaries.positions.includes(`test-position-${timestamp}`)).toBe(true);
    expect(dictionaries.domains.includes(`test-domain-${timestamp}`)).toBe(true);
    expect(dictionaries.cities.includes(`test-city-${timestamp}`)).toBe(true);
  });

  // Business Logic: Only verified=true terms should be returned by getVerifiedDictionaries
  // This is critical for normalization workflow: LLM should only see approved canonical names
  it("D6: getVerifiedDictionaries excludes unverified terms", async () => {
    const timestamp = Date.now();
    const unverifiedSkillName = `unverified-skill-${timestamp}`;
    const verifiedSkillName = `verified-skill-${timestamp}`;

    // Create unverified skill (user-suggested, pending review)
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: unverifiedSkillName,
      complexity: 50,
      verified: false, // NOT verified
      createdBy: "test-user",
    });

    // Create verified skill (approved canonical name)
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: verifiedSkillName,
      complexity: 60,
      verified: true, // VERIFIED
      createdBy: "test-user",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    const unverifiedSkill = dictionaries.skills.find(
      (s) => s.canonicalName === unverifiedSkillName,
    );
    const verifiedSkill = dictionaries.skills.find((s) => s.canonicalName === verifiedSkillName);

    // Business Rule: Only verified terms should appear in dictionaries
    expect(unverifiedSkill).toBeUndefined(); // Should NOT be returned
    expect(verifiedSkill).toBeDefined(); // Should be returned
    expect(verifiedSkill?.complexity).toBe(60);
  });
});
