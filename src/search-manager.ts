import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
  BatchResult,
  CurrentOnlyParams,
} from "./schemas-zod.js";
import { BatchResultSchema } from "./schemas-zod.js";
import { SearchResultSchema } from "./schemas-zod.js";
import { withReadSession } from "./neo4j.js";

export class SearchManager {
  constructor(
    private driver: Driver,
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
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, { currentContext, me: currentUserId })
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
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, { targetContext, me: currentUserId })
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
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, { currentContext, targetContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
  }

  async searchCurrentWithBatches(
    params: CurrentOnlyParams
  ): Promise<BatchResult[]> {
    const cypher = this.searchQueryBuilder.buildCurrentBatchesQuery(params);
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, {
        currentContext: params.currentContext,
        me: params.currentUserId,
        reasonsToTrack: params.reasonsToTrack,
      })
    );
    return result.records.map((rec) => {
      const period = rec.get("period");
      return BatchResultSchema.parse({
        period: period, // Final batch has period = -1
        results: rec.get("results"),
      });
    });
  }
}
