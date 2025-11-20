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

  it("D1: getVerifiedDictionaries returns skills with complexity", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    console.log("[D1] Skills count:", dictionaries.skills.length);
    console.log("[D1] Sample skills:", dictionaries.skills.slice(0, 3));

    expect(dictionaries.skills.length).toBeGreaterThan(0);

    dictionaries.skills.forEach((skill) => {
      expect(skill).toHaveProperty("canonicalName");
      expect(skill).toHaveProperty("complexity");
      expect(typeof skill.canonicalName).toBe("string");
      expect(typeof skill.complexity).toBe("number");
      expect(skill.complexity).toBeGreaterThanOrEqual(0);
      expect(skill.complexity).toBeLessThanOrEqual(100);
    });

    const rustSkill = dictionaries.skills.find((s) => s.canonicalName === "rust");
    if (rustSkill) {
      console.log("[D1] Rust complexity:", rustSkill.complexity);
      expect(rustSkill.complexity).toBe(88);
    }

    console.log("[D1] Skills with complexity verified: ✅");
  });

  it("D2: getVerifiedDictionaries returns all dictionary types", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    console.log("[D2] Positions count:", dictionaries.positions.length);
    console.log("[D2] Domains count:", dictionaries.domains.length);
    console.log("[D2] Cities count:", dictionaries.cities.length);
    console.log("[D2] Industries count:", dictionaries.industries.length);
    console.log("[D2] Platforms count:", dictionaries.platforms.length);
    console.log("[D2] Languages count:", dictionaries.languages.length);

    expect(dictionaries.positions.length).toBeGreaterThan(0);
    expect(dictionaries.domains.length).toBeGreaterThan(0);

    console.log("[D2] All dictionary types present: ✅");
  });

  it("D3: addTerm creates new skill term", async () => {
    const newSkillName = `test-skill-${Date.now()}`;

    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: newSkillName,
      complexity: 75,
      verified: true,
      createdBy: "test-user",
    });

    console.log("[D3] Added skill:", newSkillName);

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();
    const addedSkill = dictionaries.skills.find((s) => s.canonicalName === newSkillName);

    expect(addedSkill).toBeDefined();
    expect(addedSkill?.canonicalName).toBe(newSkillName);
    expect(addedSkill?.complexity).toBe(75);

    console.log("[D3] Skill added successfully: ✅");
  });

  it("D4: addTerm is idempotent (MERGE behavior)", async () => {
    const skillName = `idempotent-skill-${Date.now()}`;

    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: 60,
      verified: true,
      createdBy: "user1",
    });
    await dictionariesManager.addTerm({
      type: "skill",
      canonicalName: skillName,
      complexity: 80,
      verified: false,
      createdBy: "user2",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();
    const skills = dictionaries.skills.filter((s) => s.canonicalName === skillName);

    expect(skills.length).toBe(1);

    console.log("[D4] Idempotent addTerm verified: ✅");
  });

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
    await dictionariesManager.addTerm({
      type: "industry",
      canonicalName: `test-industry-${timestamp}`,
      verified: true,
      createdBy: "test-user",
    });
    await dictionariesManager.addTerm({
      type: "platform",
      canonicalName: `test-platform-${timestamp}`,
      verified: true,
      createdBy: "test-user",
    });

    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    expect(dictionaries.positions.includes(`test-position-${timestamp}`)).toBe(true);
    expect(dictionaries.domains.includes(`test-domain-${timestamp}`)).toBe(true);
    expect(dictionaries.cities.includes(`test-city-${timestamp}`)).toBe(true);
    expect(dictionaries.industries.includes(`test-industry-${timestamp}`)).toBe(true);
    expect(dictionaries.platforms.includes(`test-platform-${timestamp}`)).toBe(true);

    console.log("[D5] All dictionary types support addTerm: ✅");
  });
});
