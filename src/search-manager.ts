import type { Driver } from "neo4j-driver";
import { QueryOrchestrator } from "./orcestrator/query-orchestrator.js";
import type {
  UserContext,
  TargetContext,
  SearchResult,
  SearchConstraints,
} from "./schemas-zod.js";
import { SearchResultSchema, validateSchema } from "./schemas-zod.js";

// SearchManager is a facade over QueryOrchestrator and Neo4j Driver
export class SearchManager {
  constructor(
    public driver: Driver,
    private orchestrator: QueryOrchestrator
  ) {}

  async searchCurrent(
    presetName: string,
    currentContext: UserContext,
    currentUserId: string,
    searchConstraints: SearchConstraints
  ): Promise<SearchResult[]> {
    const cypher = this.orchestrator.buildCurrentContextQuery(
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
    const cypher = this.orchestrator.buildTargetContextQuery(
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
    const cypher = this.orchestrator.buildPipelineQuery(
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

  // Alias for target-only
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
