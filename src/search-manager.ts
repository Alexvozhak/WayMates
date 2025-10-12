import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
} from "./schemas-zod.js";
import { SearchResultSchema } from "./schemas-zod.js";
import { withReadSession } from "./neo4j.js";

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
    const result = await withReadSession(this.driver, (session) =>
      session.run(cypher, { currentContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
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
    const result = await withReadSession(this.driver, (session) =>
      session.run(cypher, { targetContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
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
    const result = await withReadSession(this.driver, (session) =>
      session.run(cypher, { currentContext, targetContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
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
