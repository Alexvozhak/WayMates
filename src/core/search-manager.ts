import { buildCurrentSearchQuery, buildTargetSearchWithPathsQuery, userCurrentContextQuery } from "../cypher/index.js";
import {
  CONTEXT_FIELD_NAMES,
  matchedCandidateWithPathSchema,
  scoredMatchedCandidateSchema,
  userContextSchema,
} from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type { GoalsManager } from "./goals-manager.js";
import type { PathCollectorService } from "./path-collector.service.js";
import type { SelectivityService } from "./selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type {
  AdhocSearchParams,
  ContextField,
  MatchedCandidateWithPath,
  ScoredMatchedCandidate,
  TargetSearchParams,
  UserContext,
  UserSearchParams,
} from "../shared/schemas.js";

/**
 * Compute strict fields for WHERE clause
 *
 * IMPORTANT: Skills are NEVER in WHERE clause - they are scored via penalties only.
 * This allows finding candidates with different skills (penalty-based scoring) rather than
 * requiring exact skill match (which would exclude too many candidates).
 */
function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => field !== "skills" && !excludedFields.includes(field),
  );
}

export class SearchManager {
  constructor(
    private db: DatabaseContext,
    private selectivity: SelectivityService,
    private trajectorySimilarity: TrajectorySimilarityService,
    private pathCollector: PathCollectorService,
    private goalsManager: GoalsManager,
  ) {}

  async searchAdhoc(params: AdhocSearchParams): Promise<ScoredMatchedCandidate[]> {
    return this.searchByContext(params, false);
  }

  async searchByUser(params: UserSearchParams): Promise<ScoredMatchedCandidate[]> {
    const context = await this.resolveContext(params.userId);

    // Cold start user - return empty results gracefully
    if (!context) {
      return [];
    }

    const hasTrajectory = context.previousContextId !== null;

    return hasTrajectory
      ? this.executeCoreSearchWithDTW(params, context)
      : this.searchByContext(
          {
            ...params,
            referenceContext: context,
          },
          true,
        );
  }

  async searchByTarget(params: TargetSearchParams): Promise<MatchedCandidateWithPath[]> {
    const query = buildTargetSearchWithPathsQuery(params);

    const queryParams = {
      userId: params.userId,
      ...params.targetContext,
      excludedCreationReasons: params.excludedCreationReasons,
      recencyThresholdMonths: params.recencyThresholdMonths,
      limit: params.limit,
    };

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map((record) => matchedCandidateWithPathSchema.parse(record.toObject()));
    });
  }

  private async searchByContext(
    params: AdhocSearchParams,
    filterByCurrentContext = false,
  ): Promise<ScoredMatchedCandidate[]> {
    const { referenceContext, userId, excludedContextFields, excludedCreationReasons, recencyThresholdMonths, limit } =
      params;

    const strictFields = computeStrictFields(excludedContextFields);

    const goal = await this.goalsManager.getUserGoal(userId);

    // Extract goal positions for Cypher parameter (null if no goal or no position filter)
    const goalPositions =
      goal?.targetCriteria.position?.mode === "desired" ? goal.targetCriteria.position.values : null;

    const rankedStrictFields = await this.selectivity.rankStrictFields(strictFields, referenceContext);

    const query = buildCurrentSearchQuery(
      goalPositions,
      rankedStrictFields,
      {
        userId,
        limit,
        excludedContextFields,
        ...(recencyThresholdMonths !== undefined && { recencyThresholdMonths }),
      },
      filterByCurrentContext,
    );

    const queryParams = {
      userId,
      referenceContext,
      excludedCreationReasons: excludedCreationReasons ?? [],
      recencyThresholdMonths,
      limit,
      goalPositions,
    };

    return this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);

      return result.records.map((record) => scoredMatchedCandidateSchema.parse(record.toObject()));
    });
  }

  private async resolveContext(userId: string): Promise<UserContext | null> {
    const query = userCurrentContextQuery();

    return this.db.read(async (tx) => {
      const result = await tx.run(query, { userId });

      const record = result.records[0];
      if (!record) {
        return null; // Cold start user - no context yet (normal case)
      }

      return userContextSchema.parse(record.get("context"));
    });
  }

  private async executeCoreSearchWithDTW(
    params: UserSearchParams,
    referenceContext: UserContext,
  ): Promise<ScoredMatchedCandidate[]> {
    // Step 1: Search candidates (without DTW)
    const topCandidates = await this.searchByContext(
      {
        ...params,
        referenceContext,
      },
      true,
    );

    // Step 2: Collect paths for user + candidates
    const candidateIds = topCandidates.map((c) => c.userId);
    const pathsMap = await this.pathCollector.collectTrajectories([params.userId, ...candidateIds]);

    const userPath = pathsMap.get(params.userId);
    if (!userPath || userPath.length < 3) {
      // Insufficient trajectory (< 3 contexts) - return candidates without DTW (pathLimit ignored)
      return topCandidates;
    }

    // Step 3: Enrich candidates with DTW metrics (filter out null)
    const enrichedCandidates: ScoredMatchedCandidate[] = [];
    for (const candidate of topCandidates) {
      const enriched = this.enrichCandidateWithDTW(candidate, userPath, pathsMap, params.userId);
      if (enriched) {
        enrichedCandidates.push(enriched);
      }
    }

    // Step 4: Apply pathLimit AFTER DTW analysis
    return enrichedCandidates
      .toSorted((a, b) => {
        const scoreA = (a.dtwTotal || 0) + a.contextMatchScore;
        const scoreB = (b.dtwTotal || 0) + b.contextMatchScore;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  private enrichCandidateWithDTW(
    candidate: ScoredMatchedCandidate,
    userPath: UserContext[],
    pathsMap: Map<string, UserContext[]>,
    userId: string,
  ): ScoredMatchedCandidate | null {
    if (candidate.userId === userId) {
      return null;
    }

    const path = pathsMap.get(candidate.userId);
    if (!path || path.length < 3) {
      // Skip candidates with insufficient trajectory (< 3 contexts)
      return null;
    }

    const dtwMetrics = this.trajectorySimilarity.computeDTWMetrics(userPath, path);

    const dtwTotal = dtwMetrics.shapeSimilarity + dtwMetrics.tempoSimilarity + dtwMetrics.stabilityScore;

    return {
      ...candidate,
      path,
      dtwMetrics,
      dtwTotal,
    };
  }
}
