import { addSimpleTermQuery, addSkillQuery, getVerifiedDictionariesQuery } from "../cypher/index.js";
import { dictionariesSchema } from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type { AddTermInput, Dictionaries } from "../shared/schemas.js";
import type { ManagedTransaction } from "neo4j-driver";

export class DictionariesManager {
  constructor(private db: DatabaseContext) {}

  async getVerifiedDictionaries(): Promise<Dictionaries> {
    return this.db.read((tx) => this.fetchDictionaries(tx));
  }

  async addTerm(input: AddTermInput): Promise<void> {
    const createdAt = new Date().toISOString();

    await this.db.write(async (tx) => {
      const query = input.type === "skill" ? addSkillQuery() : addSimpleTermQuery(input.type);
      const params =
        input.type === "skill"
          ? {
              canonicalName: input.canonicalName,
              verified: input.verified,
              createdAt,
              createdBy: input.createdBy,
              complexity: input.complexity ?? null,
            }
          : {
              canonicalName: input.canonicalName,
              verified: input.verified,
              createdAt,
              createdBy: input.createdBy,
            };

      await tx.run(query, params);
    });
  }

  private async fetchDictionaries(tx: ManagedTransaction): Promise<Dictionaries> {
    const result = await tx.run(getVerifiedDictionariesQuery());
    const record = result.records[0];

    if (!record) {
      return this.emptyDictionaries();
    }

    const rawData = record.get("dictionaries");
    return dictionariesSchema.parse(rawData);
  }

  private emptyDictionaries(): Dictionaries {
    return {
      skill: [],
      position: [],
      role: [],
      domain: [],
      city: [],
      industry: [],
      platform: [],
      language: [],
      reasons: [],
    };
  }
}
