import { DTW_MIN_TRAJECTORY_LENGTH } from "../config/scoring.js";
import {
  buildPathfinderSearchQuery,
  buildReversePathfinderSearchQuery,
  buildWaymatesSearchQuery,
  userCurrentContextQuery,
} from "../cypher/index.js";
import {
  CONTEXT_FIELD_NAMES,
  matchedCandidateWithPathSchema,
  pathfinderCandidateLightSchema,
  userContextSchema,
  waymateCandidateLightSchema,
} from "../shared/schemas.js";

import type { DatabaseContext } from "./database-context.js";
import type { GoalsManager } from "./goals-manager.js";
import type { PathCollectorService, TrajectoryData } from "./path-collector.service.js";
import type { SelectivityService } from "./selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type {
  AdhocContextBase,
  ContextField,
  DTWMetrics,
  MatchedCandidateWithPath,
  PathfinderCandidate,
  PathfinderSearchParams,
  TargetSearchParams,
  UserContext,
  WaymateCandidate,
  WaymateCandidateLight,
  WaymatesSearchParams,
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

  /**
   * Unified waymates search (merged adhoc + byUser).
   * Always returns path/trails for candidates.
   * DTW applied only in profile mode with sufficient user trajectory.
   */
  async searchWaymates(params: WaymatesSearchParams): Promise<WaymateCandidate[]> {
    const referenceContext = params.referenceContext ?? (await this.resolveContext(params.userId));

    if (!referenceContext) {
      return []; // Cold start user - no context
    }

    const isProfileMode = !params.referenceContext;

    // Step 1: Search candidates (without path)
    // Always search ALL contexts of candidates (filterByCurrentContext = false)
    // We want to find people who HAD similar context, not only those who CURRENTLY have it
    const candidates = await this.searchByContext({ ...params, referenceContext }, false);

    if (candidates.length === 0) {
      return [];
    }

    // Step 2: Collect paths for candidates (+ user if profile mode)
    const candidateIds = candidates.map((c) => c.userId);
    const userIdsToCollect = isProfileMode ? [params.userId, ...candidateIds] : candidateIds;
    const trajectoriesMap = await this.pathCollector.collectTrajectories(userIdsToCollect);

    // Step 3: Get user trajectory for DTW (profile mode only)
    const userData = isProfileMode ? trajectoriesMap.get(params.userId) : null;
    const canApplyDTW = userData && userData.path.length >= DTW_MIN_TRAJECTORY_LENGTH;

    // Step 4: Enrich candidates with path (and DTW if applicable)
    const enrichedCandidates = candidates
      .filter((c) => c.userId !== params.userId)
      .map((c) => this.enrichCandidateWithPath(c, trajectoriesMap, canApplyDTW ? userData.path : null));

    // Step 5: Sort and apply pathLimit
    return enrichedCandidates
      .toSorted((a, b) => {
        const scoreA = (a.dtwTotal ?? 0) + a.contextMatchScore;
        const scoreB = (b.dtwTotal ?? 0) + b.contextMatchScore;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  async reverseSearchPathfinders(params: TargetSearchParams): Promise<MatchedCandidateWithPath[]> {
    const query = buildReversePathfinderSearchQuery(params);

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

  /**
   * Search pathfinders: people who went FROM our context TO our goal.
   * Proof of transition - shows that the career path is possible.
   * Uses Light Cypher query + PathCollectorService (unified with waymates).
   */
  async searchPathfinders(params: PathfinderSearchParams): Promise<PathfinderCandidate[]> {
    const strictFields = computeStrictFields(params.excludedContextFields);
    const query = buildPathfinderSearchQuery(params, strictFields);

    const queryParams = {
      userId: params.userId,
      referenceContext: params.referenceContext,
      ...params.targetContext,
      excludedCreationReasons: params.excludedCreationReasons,
      targetRecencyMonths: params.targetRecencyMonths,
      referenceRecencyMonths: params.referenceRecencyMonths,
      limit: params.limit,
    };

    // Step 1: Get light candidates (without path/trails)
    const lightCandidates = await this.db.read(async (tx) => {
      const result = await tx.run(query, queryParams);
      return result.records.map((record) => pathfinderCandidateLightSchema.parse(record.toObject()));
    });

    if (lightCandidates.length === 0) {
      return [];
    }

    // Step 2: Collect paths for candidates
    const candidateIds = lightCandidates.map((c) => c.userId);
    const trajectoriesMap = await this.pathCollector.collectTrajectories(candidateIds);

    // Step 3: Enrich with path/trails and optionally DTW
    const userTrajectory = params.userTrajectory;
    const canApplyDTW = userTrajectory && userTrajectory.length >= DTW_MIN_TRAJECTORY_LENGTH;

    const enriched: PathfinderCandidate[] = lightCandidates.map((c) => {
      const trajectoryData = trajectoriesMap.get(c.userId);
      const base: PathfinderCandidate = {
        ...c,
        path: trajectoryData?.path ?? [],
        trails: trajectoryData?.trails ?? [],
      };

      // DTW enrichment if applicable
      if (canApplyDTW && trajectoryData) {
        const dtw = this.computeDTW(userTrajectory, trajectoryData.path);
        if (dtw) {
          return { ...base, ...dtw };
        }
      }

      return base;
    });

    // Step 4: Sort and slice
    return enriched
      .toSorted((a, b) => {
        const scoreA = (a.dtwTotal ?? 0) + a.contextMatchScore;
        const scoreB = (b.dtwTotal ?? 0) + b.contextMatchScore;
        return scoreB - scoreA;
      })
      .slice(0, params.pathLimit);
  }

  /**
   * Compute DTW metrics if candidate path is sufficient length.
   * Returns null if path too short.
   */
  private computeDTW(
    userPath: UserContext[],
    candidatePath: UserContext[],
  ): { dtwMetrics: DTWMetrics; dtwTotal: number } | null {
    if (candidatePath.length < DTW_MIN_TRAJECTORY_LENGTH) {
      return null;
    }

    const dtwMetrics = this.trajectorySimilarity.computeDTWMetrics(userPath, candidatePath);
    const dtwTotal = dtwMetrics.shapeSimilarity + dtwMetrics.tempoSimilarity + dtwMetrics.alignmentScore;

    return { dtwMetrics, dtwTotal };
  }

  private async searchByContext(
    params: WaymatesSearchParams & { referenceContext: AdhocContextBase },
    filterByCurrentContext = false,
  ): Promise<WaymateCandidateLight[]> {
    const {
      referenceContext,
      userId,
      excludedContextFields,
      excludedCreationReasons,
      recencyThresholdMonths,
      limit: limit,
    } = params;

    const strictFields = computeStrictFields(excludedContextFields);

    const goal = await this.goalsManager.getUserGoal(userId);

    // Extract goal positions for Cypher parameter (null if no goal or no position filter)
    const goalPositions = goal?.targetContext.position?.mode === "desired" ? goal.targetContext.position.values : null;

    const rankedStrictFields = await this.selectivity.rankStrictFields(strictFields, referenceContext);

    const query = buildWaymatesSearchQuery(
      goalPositions,
      rankedStrictFields,
      {
        userId,
        limit,
        excludedContextFields,
        ...(recencyThresholdMonths != null && { recencyThresholdMonths }),
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

      return result.records.map((record) => waymateCandidateLightSchema.parse(record.toObject()));
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

  /**
   * Enrich light candidate with path/trails (always) and DTW metrics (if userPath provided)
   */
  private enrichCandidateWithPath(
    candidate: WaymateCandidateLight,
    trajectoriesMap: Map<string, TrajectoryData>,
    userPath: UserContext[] | null,
  ): WaymateCandidate {
    const trajectoryData = trajectoriesMap.get(candidate.userId);

    // Base enrichment: add path/trails (empty arrays if not found)
    const enriched: WaymateCandidate = {
      ...candidate,
      path: trajectoryData?.path ?? [],
      trails: trajectoryData?.trails ?? [],
    };

    // DTW enrichment: only if userPath provided
    if (userPath && trajectoryData) {
      const dtw = this.computeDTW(userPath, trajectoryData.path);
      if (dtw) {
        enriched.dtwMetrics = dtw.dtwMetrics;
        enriched.dtwTotal = dtw.dtwTotal;
      }
    }

    return enriched;
  }
}
