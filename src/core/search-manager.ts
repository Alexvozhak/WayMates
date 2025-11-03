import type { DatabaseContext } from "../database-context.js";
import type { SelectivityService } from "../services/selectivity.service.js";
import type { TrajectorySimilarityService } from "./trajectory-similarity.service.js";
import type { PathCollectorService } from "./path-collector.service.js";
import type {
  AdHocSearchParams,
  SavedCurrentSearchParams,
  TrajectorySearchParams,
  TargetOnlySearchParams,
  BasicSearchResult,
  TrajectorySearchResult,
  TargetOnlySearchResult,
  UserContext,
  DTWMetrics,
  CandidateBasic,
  CandidateWithDTW,
} from "./schemas.js";

interface ResolvedContext {
  context: UserContext;
  hasTrajectory: boolean;
}

interface CandidateWithPath extends CandidateBasic {
  trajectory: UserContext[];
}

interface CandidateWithScores extends CandidateWithPath {
  path_score: number;
}

export class SearchManager {
  constructor(
    private db: DatabaseContext,
    private selectivity: SelectivityService,
    private trajectorySimilarity: TrajectorySimilarityService,
    private pathCollector: PathCollectorService
  ) {}

  async searchAdHoc(
    params: AdHocSearchParams
  ): Promise<BasicSearchResult> {
    const context = params.adhocContext;
    const hasTrajectory = false;

    const candidates = await this.executeCoreSearch(
      context,
      hasTrajectory,
      undefined,
      params
    );

    return {
      candidates,
      total_count: candidates.length,
      search_mode: "ad_hoc",
    };
  }

  async searchSavedCurrent(
    params: SavedCurrentSearchParams
  ): Promise<BasicSearchResult> {
    const resolved = await this.resolveContext(params.userId);

    const candidates = await this.executeCoreSearch(
      resolved.context,
      resolved.hasTrajectory,
      params.userId,
      params
    );

    return {
      candidates,
      total_count: candidates.length,
      search_mode: "saved_current",
    };
  }

  async searchTrajectory(
    params: TrajectorySearchParams
  ): Promise<TrajectorySearchResult> {
    const resolved = await this.resolveContext(params.userId);

    if (!resolved.hasTrajectory) {
      throw new Error(
        "searchTrajectory requires user with trajectory (previous_context_id !== null)"
      );
    }

    const candidates = await this.executeCoreSearchWithDTW(
      resolved.context,
      params.userId,
      params
    );

    return {
      candidates,
      total_count: candidates.length,
      search_mode: "trajectory",
    };
  }

  async searchTargetOnly(
    params: TargetOnlySearchParams
  ): Promise<TargetOnlySearchResult> {
    let candidates = await this.matchCandidatesByTarget(
      params.targetContext,
      params.strictFields,
      params.recencyThresholdMonths
    );

    candidates = await this.buildPathsToTarget(candidates);

    candidates = this.filterPaths(
      candidates,
      params.excludedCreationReasons
    );

    const rankedCandidates = candidates.map((c) => {
      const pathScore = 1 / (c.trajectory.length + 1);
      const totalScore = pathScore;

      return {
        user_id: c.user_id,
        matched_context: c.matched_context,
        skills_penalty: 0,
        total_score: totalScore,
        candidate_type: null,
        time_since_matched_months: c.time_since_matched_months,
      };
    }).sort((a, b) => b.total_score - a.total_score);

    return {
      candidates: rankedCandidates,
      total_count: rankedCandidates.length,
      search_mode: "target_only",
    };
  }

  private async resolveContext(userId: string): Promise<ResolvedContext> {
    return this.db.read(async (tx) => {
      const result = await tx.run(
        `
        MATCH (u:User {user_id: $userId})-[:HAS_CONTEXT]->(c:Context {context_id: u.current_context_id})
        OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
        OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
        OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
        OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
        OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
        OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)
        WITH c, p, wd, s, i, ci, co
        RETURN c {
          .context_id,
          .previous_context_id,
          .next_context_id,
          .created_at,
          .creation_reason,
          .birth_year,
          .citizenships,
          position: p.name,
          domains: collect(DISTINCT wd.name),
          skills: collect(DISTINCT s.name),
          industry: i.name,
          company_size: c.company_size,
          country_code: co.name,
          city_name: ci.name
        } AS context
        `,
        { userId }
      );

      const record = result.records[0];
      if (!record) {
        throw new Error(`resolveContext: user ${userId} not found`);
      }

      const context = record.get("context") as UserContext;
      const hasTrajectory = context.previous_context_id !== null;

      return { context, hasTrajectory };
    });
  }

  private filterPaths(
    candidates: CandidateWithPath[],
    excludedReasons?: string[]
  ): CandidateWithPath[] {
    if (!excludedReasons || excludedReasons.length === 0) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      return !candidate.trajectory.some((ctx) =>
        ctx.creation_reason.some((reason) => excludedReasons.includes(reason))
      );
    });
  }

  private filterTarget(
    candidates: CandidateWithPath[],
    targetContext?: any
  ): CandidateWithPath[] {
    if (!targetContext) {
      return candidates;
    }

    return candidates.filter((candidate) => {
      const ctx = candidate.matched_context;

      for (const field of Object.keys(targetContext)) {
        const constraint = targetContext[field];
        if (!constraint) continue;

        const included = constraint.included || [];
        const excluded = constraint.excluded || [];

        const value = ctx[field as keyof UserContext];

        if (excluded.length > 0) {
          if (Array.isArray(value)) {
            if (value.some((v) => excluded.includes(v))) return false;
          } else {
            if (excluded.includes(value)) return false;
          }
        }

        if (included.length > 0) {
          if (Array.isArray(value)) {
            if (!value.some((v) => included.includes(v))) return false;
          } else {
            if (!included.includes(value)) return false;
          }
        }
      }

      return true;
    });
  }

  private rankResults(
    candidates: CandidateWithScores[],
    dtwScores?: Map<string, number>
  ): CandidateBasic[] {
    return candidates
      .map((c) => {
        const dtwScore = dtwScores?.get(c.user_id) || 0;
        const pathScore = c.path_score;
        const skillPenalty = c.skills_penalty;

        const totalScore = dtwScores
          ? 0.5 * dtwScore + 0.3 * pathScore - 0.2 * skillPenalty
          : 0.6 * pathScore - 0.4 * skillPenalty;

        return {
          user_id: c.user_id,
          matched_context: c.matched_context,
          skills_penalty: c.skills_penalty,
          total_score: totalScore,
          candidate_type: c.candidate_type,
          time_since_matched_months: c.time_since_matched_months,
        };
      })
      .sort((a, b) => b.total_score - a.total_score);
  }

  private async executeCoreSearch(
    referenceContext: UserContext,
    hasTrajectory: boolean,
    userId: string | undefined,
    params: AdHocSearchParams | SavedCurrentSearchParams
  ): Promise<CandidateBasic[]> {
    let candidates = await this.matchCandidates(
      referenceContext,
      params.strictFields,
      params.recencyThresholdMonths
    );

    candidates = await this.buildPathsForCandidates(candidates);

    candidates = this.filterPaths(
      candidates,
      params.excludedCreationReasons
    );

    candidates = this.filterTarget(candidates, params.targetContext);

    let candidatesWithScores = await this.scoreSkillsPenalty(
      candidates,
      params.requiredSkills || referenceContext.skills
    );

    if (userId) {
      candidatesWithScores = await this.applyGoalFilter(
        candidatesWithScores,
        userId
      );
    }

    candidatesWithScores = candidatesWithScores.map((c) => {
      const pathScore = 1 / (c.trajectory.length + 1);
      return Object.assign({}, c, { path_score: pathScore });
    });

    return this.rankResults(candidatesWithScores, undefined);
  }

  private async executeCoreSearchWithDTW(
    referenceContext: UserContext,
    userId: string,
    params: TrajectorySearchParams
  ): Promise<CandidateWithDTW[]> {
    let candidates = await this.matchCandidates(
      referenceContext,
      params.strictFields,
      params.recencyThresholdMonths
    );

    candidates = await this.buildPathsForCandidates(candidates);

    candidates = this.filterPaths(
      candidates,
      params.excludedCreationReasons
    );

    candidates = this.filterTarget(candidates, params.targetContext);

    let candidatesWithScores = await this.scoreSkillsPenalty(
      candidates,
      params.requiredSkills || referenceContext.skills
    );

    candidatesWithScores = await this.applyGoalFilter(
      candidatesWithScores,
      userId
    );

    const userTrajectory = await this.pathCollector.collectUserTrajectory(userId);

    const candidatesWithDTW: CandidateWithDTW[] = [];

    for (const candidate of candidatesWithScores) {
      const dtwMetrics = await this.trajectorySimilarity.computeDTWMetrics(
        userTrajectory,
        candidate.trajectory
      );

      const dtwTotal =
        dtwMetrics.shape_similarity +
        dtwMetrics.tempo_similarity +
        dtwMetrics.stability;

      const totalScore =
        0.5 * dtwTotal +
        0.3 * (1 / (candidate.trajectory.length + 1)) -
        0.2 * candidate.skills_penalty;

      candidatesWithDTW.push({
        user_id: candidate.user_id,
        matched_context: candidate.matched_context,
        trajectory: candidate.trajectory,
        dtw_metrics: dtwMetrics,
        dtw_total: dtwTotal,
        skills_penalty: candidate.skills_penalty,
        total_score: totalScore,
        candidate_type: candidate.candidate_type,
      });
    }

    return candidatesWithDTW.sort((a, b) => b.total_score - a.total_score);
  }

  private async matchCandidates(
    referenceContext: UserContext,
    strictFields: string[],
    recencyThresholdMonths?: number
  ): Promise<CandidateBasic[]> {
    return this.db.read(async (tx) => {
      const whereConditions: string[] = [];
      const params: Record<string, any> = {};

      for (const field of strictFields) {
        if (field === "position" && referenceContext.position) {
          whereConditions.push("p.name = $position");
          params.position = referenceContext.position;
        } else if (field === "country_code" && referenceContext.country_code) {
          whereConditions.push("co.name = $country_code");
          params.country_code = referenceContext.country_code;
        } else if (field === "skills" && referenceContext.skills.length > 0) {
          whereConditions.push("ALL(skill IN $requiredSkills WHERE skill IN skills)");
          params.requiredSkills = referenceContext.skills;
        }
      }

      if (recencyThresholdMonths) {
        whereConditions.push(
          "duration.inMonths(datetime(c.created_at), datetime()).months <= $recencyThreshold"
        );
        params.recencyThreshold = recencyThresholdMonths;
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      const query = `
        MATCH (u:User)-[:HAS_CONTEXT]->(c:Context)
        OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
        OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
        OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
        OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
        OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
        OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)
        WITH u, c, p, wd, s, i, ci, co,
             collect(DISTINCT s.name) AS skills
        ${whereClause}
        WITH u, c, p, wd, i, ci, co, skills
        RETURN u.user_id AS user_id,
               c {
                 .context_id,
                 .previous_context_id,
                 .next_context_id,
                 .created_at,
                 .creation_reason,
                 .birth_year,
                 .citizenships,
                 .company_size,
                 position: p.name,
                 domains: collect(DISTINCT wd.name),
                 skills: skills,
                 industry: i.name,
                 country_code: co.name,
                 city_name: ci.name
               } AS matched_context,
               duration.inMonths(datetime(c.created_at), datetime()).months AS time_since_matched_months
        LIMIT 100
      `;

      const result = await tx.run(query, params);

      return result.records.map((rec) => ({
        user_id: rec.get("user_id"),
        matched_context: rec.get("matched_context"),
        skills_penalty: 0,
        total_score: 0,
        candidate_type: null,
        time_since_matched_months: rec.get("time_since_matched_months"),
      }));
    });
  }

  private async buildPathsForCandidates(
    candidates: CandidateBasic[]
  ): Promise<CandidateWithPath[]> {
    const result: CandidateWithPath[] = [];

    for (const candidate of candidates) {
      const trajectory = await this.pathCollector.collectBackwardPath(
        candidate.user_id,
        candidate.matched_context.context_id
      );

      result.push(
        Object.assign({}, candidate, { trajectory })
      );
    }

    return result;
  }

  private async scoreSkillsPenalty(
    candidates: CandidateWithPath[],
    requiredSkills: string[]
  ): Promise<CandidateWithPath[]> {
    return this.db.read(async (tx) => {
      const result: CandidateWithPath[] = [];

      for (const candidate of candidates) {
        const candidateSkills = candidate.matched_context.skills;
        const extraSkills = candidateSkills.filter(
          (skill) => !requiredSkills.includes(skill)
        );

        if (extraSkills.length === 0) {
          result.push(
            Object.assign({}, candidate, { skills_penalty: 0 })
          );
          continue;
        }

        const categoryQuery = `
          UNWIND $skills AS skillName
          OPTIONAL MATCH (s:Skill {name: skillName})-[:IN_CATEGORY]->(sc:SkillCategory)
          RETURN skillName,
                 COALESCE(s.weight, sc.weight, 5.0) AS weight,
                 COALESCE(sc.penalty_multiplier, 1.0) AS penalty_multiplier
        `;

        const catResult = await tx.run(categoryQuery, { skills: extraSkills });

        let totalPenalty = 0;
        for (const rec of catResult.records) {
          const weight = rec.get("weight");
          const penaltyMult = rec.get("penalty_multiplier");
          totalPenalty += weight * penaltyMult;
        }

        const normalizedPenalty = Math.min(totalPenalty / 100, 1.0);

        result.push(
          Object.assign({}, candidate, { skills_penalty: normalizedPenalty })
        );
      }

      return result;
    });
  }

  private async applyGoalFilter(
    candidates: CandidateWithPath[],
    userId: string
  ): Promise<CandidateWithPath[]> {
    return this.db.read(async (tx) => {
      const goalQuery = `
        MATCH (u:User {user_id: $userId})
        OPTIONAL MATCH (u)-[:HAS_GOAL]->(g:Goal)
        RETURN g.target_context_id AS target_context_id
      `;

      const goalResult = await tx.run(goalQuery, { userId });
      const goalRecord = goalResult.records[0];

      if (!goalRecord) {
        return candidates;
      }

      const targetContextId = goalRecord.get("target_context_id");

      if (!targetContextId) {
        return candidates.map((c) =>
          Object.assign({}, c, { candidate_type: null })
        );
      }

      return candidates.map((c) => {
        let candidateType: "pathfinder" | "waymate" | null = null;

        if (c.matched_context.context_id === targetContextId) {
          candidateType = "pathfinder";
        } else {
          candidateType = null;
        }

        return Object.assign({}, c, { candidate_type: candidateType });
      });
    });
  }

  private async matchCandidatesByTarget(
    targetContext: any,
    strictFields: string[],
    recencyThresholdMonths?: number
  ): Promise<CandidateBasic[]> {
    return this.db.read(async (tx) => {
      const whereConditions: string[] = [];
      const params: Record<string, any> = {};

      for (const field of Object.keys(targetContext)) {
        const constraint = targetContext[field];
        if (!constraint) continue;

        const included = constraint.included || [];
        const excluded = constraint.excluded || [];

        if (field === "position" && included.length > 0) {
          whereConditions.push("p.name IN $targetPositions");
          params.targetPositions = included;
        } else if (field === "country_code" && included.length > 0) {
          whereConditions.push("co.name IN $targetCountries");
          params.targetCountries = included;
        }
      }

      if (recencyThresholdMonths) {
        whereConditions.push(
          "duration.inMonths(datetime(c.created_at), datetime()).months <= $recencyThreshold"
        );
        params.recencyThreshold = recencyThresholdMonths;
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      const query = `
        MATCH (u:User)-[:HAS_CONTEXT]->(c:Context {context_id: u.current_context_id})
        OPTIONAL MATCH (c)-[:HAS_POSITION]->(p:Position)
        OPTIONAL MATCH (c)-[:IN_WORK_DOMAIN]->(wd:WorkDomain)
        OPTIONAL MATCH (c)-[:USES_SKILL]->(s:Skill)
        OPTIONAL MATCH (c)-[:IN_INDUSTRY]->(i:Industry)
        OPTIONAL MATCH (c)-[:IN_CITY]->(ci:City)
        OPTIONAL MATCH (c)-[:IN_COUNTRY]->(co:Country)
        WITH u, c, p, wd, s, i, ci, co,
             collect(DISTINCT s.name) AS skills
        ${whereClause}
        WITH u, c, p, wd, i, ci, co, skills
        RETURN u.user_id AS user_id,
               c {
                 .context_id,
                 .previous_context_id,
                 .next_context_id,
                 .created_at,
                 .creation_reason,
                 .birth_year,
                 .citizenships,
                 .company_size,
                 position: p.name,
                 domains: collect(DISTINCT wd.name),
                 skills: skills,
                 industry: i.name,
                 country_code: co.name,
                 city_name: ci.name
               } AS matched_context,
               duration.inMonths(datetime(c.created_at), datetime()).months AS time_since_matched_months
        LIMIT 100
      `;

      const result = await tx.run(query, params);

      return result.records.map((rec) => ({
        user_id: rec.get("user_id"),
        matched_context: rec.get("matched_context"),
        skills_penalty: 0,
        total_score: 0,
        candidate_type: null,
        time_since_matched_months: rec.get("time_since_matched_months"),
      }));
    });
  }

  private async buildPathsToTarget(
    candidates: CandidateBasic[]
  ): Promise<CandidateWithPath[]> {
    const result: CandidateWithPath[] = [];

    for (const candidate of candidates) {
      const trajectory = await this.pathCollector.collectUserTrajectory(
        candidate.user_id
      );

      result.push(
        Object.assign({}, candidate, { trajectory })
      );
    }

    return result;
  }
}
