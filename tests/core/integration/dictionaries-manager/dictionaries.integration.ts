import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { DatabaseContext } from "../../../../src/core/database-context.js";
import { DictionariesManager } from "../../../../src/core/dictionaries-manager.js";
import { createDriver } from "../../../../src/core/neo4j.js";

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

  // Business Logic: Verify that skills.yaml (85 skills) is imported
  // This validates the entire seed data pipeline: yaml → import-skills.ts → Neo4j → getVerifiedDictionaries
  it("D1: getVerifiedDictionaries returns skills from yaml", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: skills.yaml contains 85 skills (as of ADR-009)
    // Test runs AFTER other integration tests, so DB may have additional skills from fixtures
    expect(dictionaries.skill.length).toBeGreaterThanOrEqual(85);

    // Business Rule: Specific skills from skills.yaml must be present
    expect(dictionaries.skill).toContain("rust"); // Programming language
    expect(dictionaries.skill).toContain("python"); // Programming language
    expect(dictionaries.skill).toContain("typescript"); // Programming language
    expect(dictionaries.skill).toContain("django"); // Web framework
    expect(dictionaries.skill).toContain("kubernetes"); // Infrastructure
  });

  // Business Logic: Verify all dictionary types structure and that seed data is loaded
  // This ensures getVerifiedDictionaries returns correct schema shape
  it("D2: getVerifiedDictionaries returns all dictionary types with correct structure", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: All dictionary type keys must exist (even if empty arrays)
    expect(dictionaries).toHaveProperty("skill");
    expect(dictionaries).toHaveProperty("position");
    expect(dictionaries).toHaveProperty("domain");
    expect(dictionaries).toHaveProperty("city");
    expect(dictionaries).toHaveProperty("industry");
    expect(dictionaries).toHaveProperty("platform");
    expect(dictionaries).toHaveProperty("language");
    expect(dictionaries).toHaveProperty("reasons");

    // Business Rule: Skills and languages must be imported from yaml/json seed data
    expect(dictionaries.skill.length).toBeGreaterThan(80); // ~85 from yaml minimum
    expect(dictionaries.language.length).toBeGreaterThan(0); // from languages.json

    // Business Rule: All dictionary types return string[] (canonical names only)
    const sampleSkill = dictionaries.skill[0];
    expect(sampleSkill).toBeDefined();
    expect(typeof sampleSkill).toBe("string");

    if (dictionaries.language.length > 0) {
      expect(typeof dictionaries.language[0]).toBe("string");
    }
  });

  // Business Logic: addTerm creates new skill
  it("D3: addTerm creates new skill", async () => {
    const newSkillName = `test-skill-${Date.now()}`;

    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: newSkillName,
      complexity: 75,
      verified: true,
      createdBy: "test-user",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: Newly added skill must exist
    expect(dictionaries.skill).toContain(newSkillName);
  });

  // Business Logic: MERGE idempotency - ON CREATE SET should preserve FIRST values
  // When same canonicalName is added twice, database should keep first creation data
  it("D4: addTerm is idempotent - MERGE preserves first creation", async () => {
    const skillName = `idempotent-skill-${Date.now()}`;

    // First call: creates node with verified=true, createdBy=user1
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: 60,
      verified: true,
      createdBy: "user1",
    });

    // Second call: attempts to create with different values
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: 80,
      verified: false,
      createdBy: "user2",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: MERGE with ON CREATE SET keeps FIRST values
    // Second call should NOT update existing node, so skill appears (verified=true from first call)
    expect(dictionaries.skill).toContain(skillName);
  });

  // Business Logic: addTerm supports all dictionary types (position, domain, city, skill, etc.)
  // Each type creates corresponding label node (Position, WorkDomain, City, Skill, etc.)
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
    expect(dictionaries.position.includes(`test-position-${timestamp}`)).toBe(true);
    expect(dictionaries.domain.includes(`test-domain-${timestamp}`)).toBe(true);
    expect(dictionaries.city.includes(`test-city-${timestamp}`)).toBe(true);
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

    // Business Rule: Only verified terms should appear in dictionaries
    expect(dictionaries.skill).not.toContain(unverifiedSkillName); // Should NOT be returned
    expect(dictionaries.skill).toContain(verifiedSkillName); // Should be returned
  });

  // Business Logic: Verify that reasons from reasons.json are loaded correctly
  // Reasons are predefined transition types, not user-added dictionary terms
  it("D7: getVerifiedDictionaries returns all reasons with correct structure", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: reasons.json contains 15 predefined reasons
    expect(dictionaries.reasons.length).toBe(15);

    // Business Rule: Reasons are returned as reasonId strings
    const sampleReason = dictionaries.reasons[0];
    expect(sampleReason).toBeDefined();
    expect(typeof sampleReason).toBe("string");

    // Business Rule: Specific reason IDs from reasons.json must exist
    expect(dictionaries.reasons).toContain("position_changed");
    expect(dictionaries.reasons).toContain("started_working");
    expect(dictionaries.reasons).toContain("skill_learning");
    expect(dictionaries.reasons).toContain("goals_change");
  });

  // Business Logic: Reasons are used for filtering in search (excludedCreationReasons)
  // LLM needs all reasons for normalization when user specifies exclusion criteria
  it("D8: reasons contain all expected transition types for search filtering", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    const reasonIds = dictionaries.reasons;

    // Business Rule: All critical transition types must exist for search filtering
    const criticalReasons = [
      "position_changed",
      "location_changed",
      "company_changed",
      "industry_changed",
      "domain_changed",
      "work_format_changed",
      "started_working",
      "stopped_working",
      "skill_learning",
      "education_completed",
      "goals_change",
      "constraints_update",
      "milestone_achieved",
      "system_recommendation",
      "other",
    ];

    criticalReasons.forEach((reasonId) => {
      expect(reasonIds).toContain(reasonId);
    });
  });

  // Business Logic: Reasons are immutable (predefined from reasons.json)
  // Unlike skills/positions, reasons cannot be added via addTerm
  it("D9: reasons are read-only and match reasons.json exactly", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    // Business Rule: Exactly 15 reasons as defined in reasons.json
    expect(dictionaries.reasons).toHaveLength(15);

    // Business Rule: Order doesn't matter, but all keys from reasons.json must exist
    const expectedReasonIds = [
      "position_changed",
      "location_changed",
      "company_changed",
      "industry_changed",
      "domain_changed",
      "work_format_changed",
      "started_working",
      "stopped_working",
      "skill_learning",
      "education_completed",
      "goals_change",
      "constraints_update",
      "milestone_achieved",
      "system_recommendation",
      "other",
    ];

    const actualReasonIds = dictionaries.reasons.toSorted();
    expect(actualReasonIds).toEqual(expectedReasonIds.toSorted());
  });
});
