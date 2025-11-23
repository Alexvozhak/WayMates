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

  it("D1: getVerifiedDictionaries returns skills", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    console.log("[D1] Skills count:", dictionaries.skill.length);
    console.log("[D1] Sample skills:", dictionaries.skill.slice(0, 3));

    expect(dictionaries.skill.length).toBeGreaterThan(0);

    dictionaries.skill.forEach((skill) => {
      expect(typeof skill).toBe("string");
    });

    expect(dictionaries.skill).toContain("rust");

    console.log("[D1] Skills verified: ✅");
  });

  it("D2: getVerifiedDictionaries returns all dictionary types", async () => {
    const dictionaries = await dictionariesManager.getVerifiedDictionaries();

    console.log("[D2] Positions count:", dictionaries.position.length);
    console.log("[D2] Domains count:", dictionaries.domain.length);
    console.log("[D2] Cities count:", dictionaries.city.length);
    console.log("[D2] Industries count:", dictionaries.industry.length);
    console.log("[D2] Platforms count:", dictionaries.platform.length);
    console.log("[D2] Languages count:", dictionaries.language.length);

    expect(dictionaries.position.length).toBeGreaterThan(0);
    expect(dictionaries.domain.length).toBeGreaterThan(0);

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

    expect(dictionaries.skill).toContain(newSkillName);

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
    const matchCount = dictionaries.skill.filter((s) => s === skillName).length;

    expect(matchCount).toBe(1);

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

    expect(dictionaries.position.includes(`test-position-${timestamp}`)).toBe(true);
    expect(dictionaries.domain.includes(`test-domain-${timestamp}`)).toBe(true);
    expect(dictionaries.city.includes(`test-city-${timestamp}`)).toBe(true);
    expect(dictionaries.industry.includes(`test-industry-${timestamp}`)).toBe(true);
    expect(dictionaries.platform.includes(`test-platform-${timestamp}`)).toBe(true);

    console.log("[D5] All dictionary types support addTerm: ✅");
  });
});
