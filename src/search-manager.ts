import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
  BatchedResearchResult,
  CurrentOnlyParams,
} from "./schemas-zod.js";
import { BatchedResearchResultSchema } from "./schemas-zod.js";
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

  async searchCurrentWithBatches(
    params: CurrentOnlyParams
  ): Promise<BatchedResearchResult[]> {
    const cypher = this.searchQueryBuilder.buildCurrentBatchesQuery(params);
    const result = await withReadSession(this.driver, (session) =>
      session.run(cypher, {
        currentContext: params.currentContext,
        me: params.currentUserId,
        reasonsToTrack: params.reasonsToTrack,
      })
    );
    return result.records.map((rec) =>
      BatchedResearchResultSchema.parse(rec.get("result"))
    );
  }
}
