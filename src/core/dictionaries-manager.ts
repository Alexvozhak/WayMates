import { addTermQuery, getVerifiedDictionariesQuery } from "../cypher/queries/dictionaries.js";
import { dictionariesSchema } from "../shared/schemas.js";

import type { DatabaseContext } from "../database-context.js";
import type { Dictionaries, DictionaryType } from "../shared/schemas.js";
import type { ManagedTransaction } from "neo4j-driver";

export class DictionariesManager {
  constructor(private db: DatabaseContext) {}

  async getVerifiedDictionaries(): Promise<Dictionaries> {
    return this.db.read((tx) => this.fetchDictionaries(tx));
  }

  async addTerm(
    type: DictionaryType,
    canonicalName: string,
    verified: boolean,
    createdBy: string,
  ): Promise<void> {
    const createdAt = new Date().toISOString();

    await this.db.write(async (tx) => {
      await tx.run(addTermQuery(type), {
        canonicalName,
        verified,
        createdAt,
        createdBy,
      });
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
      skills: [],
      positions: [],
      domains: [],
      cities: [],
      industries: [],
      platforms: [],
      languages: [],
    };
  }
}
