import type { Driver } from "neo4j-driver";
import { SearchQueryBuilder } from "./orcestrator/search-query-builder.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
  CurrentOnlyResult,
  CurrentOnlyParams,
} from "./schemas-zod.js";
import { CurrentOnlyResultSchema } from "./schemas-zod.js";
import { SearchResultSchema } from "./schemas-zod.js";
import { withReadSession } from "./neo4j.js";
import { SelectivityService } from "./services/selectivity.service.js";
import { isPresetName, PRESETS } from "./orcestrator/presets.js";

export class SearchManager {
  constructor(
    private driver: Driver,
    private builder: SearchQueryBuilder,
    private selectivity: SelectivityService
  ) {}

  async searchCurrentContext(
    currentPreset: string,
    currentContext: UserContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      PRESETS[currentPreset]!.strictFields,
      currentContext
    );
    const flexibleFields = PRESETS[currentPreset]!.flexibleFields;
    const cypher = this.builder.constructCurrentContextQuery(
      orderedStrictFields,
      flexibleFields,
      searchConstraints
    );
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, { currentContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
  }

  async searchTargetContext(
    targetPreset: string,
    targetContext: TargetContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    if (!isPresetName(targetPreset)) {
      throw new Error(`Invalid preset name: ${targetPreset}`);
    }
    const { strictFields, flexibleFields } = PRESETS[targetPreset]!;
    const orderedStrictFields = await this.selectivity.rankStrictFields(
      strictFields,
      targetContext
    );
    const cypher = this.builder.constructTargetContextQuery(
      orderedStrictFields,
      flexibleFields,
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
    if (!isPresetName(currentPreset)) {
      throw new Error(`Invalid preset name: ${currentPreset}`);
    }
    if (!isPresetName(targetPreset)) {
      throw new Error(`Invalid preset name: ${targetPreset}`);
    }
    const { flexibleFields: currentFF } = PRESETS[currentPreset]!;
    const { flexibleFields: targetFF, strictFields: targetSF } =
      PRESETS[targetPreset]!;
    const orderedCurrentFF = await this.selectivity.rankStrictFields(
      PRESETS[currentPreset]!.strictFields,
      currentContext
    );

    const cypher = this.builder.constructPipelineQuery(
      orderedCurrentFF,
      currentFF,
      targetSF,
      targetFF,
      searchConstraints
    );
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, { currentContext, targetContext, me: currentUserId })
    );
    return result.records.map((rec) =>
      SearchResultSchema.parse(rec.get("result"))
    );
  }

  async searchInCurrentOnlyMode(
    params: CurrentOnlyParams
  ): Promise<CurrentOnlyResult[]> {
    const cypher = this.builder.buildCurrentBatchesQuery(params);
    const result = await withReadSession(this.driver, (tx) =>
      tx.run(cypher, {
        currentContext: params.currentContext,
        me: params.currentUserId,
        reasonsToTrack: params.reasonsToTrack,
      })
    );
    return result.records.map((rec) => {
      const period = rec.get("period");
      return CurrentOnlyResultSchema.parse({
        period: period,
        results: rec.get("results"),
      });
    });
  }
}
