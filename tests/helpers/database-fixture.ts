import type { Driver, Record } from "neo4j-driver";

const REFERENCE_DATA_LABELS = ["Language", "Skill", "SkillCategory", "Reason"] as const;

export class DatabaseFixture {
  static getReferenceDataLabels(): readonly string[] {
    return REFERENCE_DATA_LABELS;
  }

  private driver: Driver;

  constructor(driver: Driver) {
    this.driver = driver;
  }

  async cleanTestData(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(`
        MATCH (n)
        WHERE NOT n:Language
          AND NOT n:Skill
          AND NOT n:SkillCategory
          AND NOT n:Reason
        DETACH DELETE n
      `);
    } finally {
      await session.close();
    }
  }

  async cleanNodes(...labels: string[]): Promise<void> {
    if (labels.length === 0) {
      throw new Error("cleanNodes requires at least one label");
    }

    const session = this.driver.session();
    try {
      const whereClause = labels.map((label) => `n:${label}`).join(" OR ");

      await session.run(`
        MATCH (n)
        WHERE ${whereClause}
        DETACH DELETE n
      `);
    } finally {
      await session.close();
    }
  }

  async verifyReferenceData(): Promise<void> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (l:Language)
        WITH count(l) AS langCount
        MATCH (s:Skill)
        WITH langCount, count(s) AS skillCount
        MATCH (sc:SkillCategory)
        WITH langCount, skillCount, count(sc) AS categoryCount
        MATCH (r:Reason)
        RETURN langCount, skillCount, categoryCount, count(r) AS reasonCount
      `);

      const record = result.records[0];
      if (!record) {
        throw new Error("Failed to query reference data counts");
      }

      const counts = this.extractReferenceDataCounts(record);
      this.validateReferenceDataCounts(counts);

      console.log(
        `[DatabaseFixture] Reference data verified: ${counts.langCount} Languages, ${counts.skillCount} Skills, ${counts.categoryCount} Categories, ${counts.reasonCount} Reasons`,
      );
    } finally {
      await session.close();
    }
  }

  async verifyUserCount(expectedCount: number): Promise<void> {
    const session = this.driver.session();
    try {
      const result = await session.run("MATCH (u:User) RETURN count(u) AS count");
      const userCount = Number(result.records[0]?.get("count")) || 0;

      if (userCount !== expectedCount) {
        throw new Error(`Expected ${expectedCount} users, found ${userCount}`);
      }

      console.log(`[DatabaseFixture] User count verified: ${userCount} users`);
    } finally {
      await session.close();
    }
  }

  private extractReferenceDataCounts(record: Record): {
    langCount: number;
    skillCount: number;
    categoryCount: number;
    reasonCount: number;
  } {
    return {
      langCount: Number(record.get("langCount")) || 0,
      skillCount: Number(record.get("skillCount")) || 0,
      categoryCount: Number(record.get("categoryCount")) || 0,
      reasonCount: Number(record.get("reasonCount")) || 0,
    };
  }

  private validateReferenceDataCounts(counts: {
    langCount: number;
    skillCount: number;
    categoryCount: number;
    reasonCount: number;
  }): void {
    const { langCount, skillCount, categoryCount, reasonCount } = counts;

    if (langCount === 0 || skillCount === 0 || categoryCount === 0 || reasonCount === 0) {
      throw new Error(
        `Reference data missing! Run 'npm run db:test:init' before tests.\n` +
          `Found: ${langCount} Languages, ${skillCount} Skills, ${categoryCount} Categories, ${reasonCount} Reasons`,
      );
    }
  }
}
