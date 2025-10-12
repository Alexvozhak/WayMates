import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
} from "./schemas-zod.js";
import { SearchResultSchema, validateSchema } from "./schemas-zod.js";

export class SearchManager {
  constructor(
    public driver: Driver,
    private searchQueryBuilder: SearchQueryBuilder
  ) {}

  async searchCurrent(
    presetName: string,
    currentContext: UserContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const cypher = this.searchQueryBuilder.buildCurrentContextQuery(
      presetName,
      searchConstraints
    );
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(cypher, { currentContext, me: currentUserId })
      );
      return result.records.map((rec) =>
        validateSchema(rec.get("result"), SearchResultSchema, "SearchResult")
      );
    } finally {
      await session.close();
    }
  }

  async searchTarget(
    presetName: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const cypher = this.searchQueryBuilder.buildTargetContextQuery(
      presetName,
      searchConstraints
    );
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(cypher, { targetContext, me: currentUserId })
      );
      return result.records.map((rec) =>
        validateSchema(rec.get("result"), SearchResultSchema, "SearchResult")
      );
    } finally {
      await session.close();
    }
  }

  async searchPipeline(
    currentPreset: string,
    currentContext: UserContext,
    targetPreset: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const cypher = this.searchQueryBuilder.buildPipelineQuery(
      currentPreset,
      targetPreset,
      searchConstraints
    );
    const session = this.driver.session();
    try {
      const result = await session.executeRead((tx) =>
        tx.run(cypher, { currentContext, targetContext, me: currentUserId })
      );
      return result.records.map((rec) =>
        validateSchema(rec.get("result"), SearchResultSchema, "SearchResult")
      );
    } finally {
      await session.close();
    }
  }

  async searchTargetMode(
    presetName: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    return this.searchTarget(
      presetName,
      targetContext,
      currentUserId,
      searchConstraints
    );
  }
}
