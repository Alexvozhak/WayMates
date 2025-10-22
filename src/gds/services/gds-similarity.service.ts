/**
 * GDS Similarity Service
 *
 * Implements Node Similarity algorithms (Jaccard/Overlap) for WayMates search.
 *
 * Usage:
 * - findSimilarByJaccard: Strict matching (current context in pipeline mode)
 * - findSimilarByOverlap: Soft matching (target context, explore modes)
 *
 * Metrics:
 * - Jaccard: |A ∩ B| / |A ∪ B| - penalizes extra skills/domains
 * - Overlap: |A ∩ B| / min(|A|, |B|) - more permissive
 *
 * Graph:
 * - Uses waymates-skills-graph projection (Context, Skill, WorkDomain nodes)
 * - Relationships: USES_SKILL, IN_WORK_DOMAIN (UNDIRECTED)
 *
 * Security:
 * - All queries use parameterized inputs (no SQL injection risk)
 * - Filters passed as Cypher parameters ($filterPosition, $filterIndustry, etc.)
 */

import type { Driver } from 'neo4j-driver';
import { int } from 'neo4j-driver';
import { withReadSession } from '../../neo4j.js';
import { GdsProjectionService } from './gds-projection.service.js';
import type { SimilarityResult, SimilarityFilters } from '../schemas.js';

/**
 * Maximum allowed value for topK parameter (bug #15 fix)
 *
 * Prevents excessive memory usage and performance degradation.
 * GDS algorithms scale O(N*K) where K=topK, so limiting to 10000
 * ensures reasonable performance even on large graphs.
 */
const MAX_TOP_K = 10000;

export class GdsSimilarityService {
  constructor(
    private driver: Driver,
    private projectionService: GdsProjectionService
  ) {}

  /**
   * Validate and parse match_score from GDS result
   *
   * @throws Error if score is NaN, Infinity, or out of [0.0, 1.0] range
   */
  private validateMatchScore(rawScore: unknown, contextId: string): number {
    const score = Number(rawScore);

    // Check for NaN, Infinity, -Infinity
    if (!Number.isFinite(score)) {
      throw new Error(
        `Invalid match_score from GDS for context ${contextId}: ${rawScore} (expected finite number)`
      );
    }

    // GDS similarity scores are ALWAYS in [0.0, 1.0]
    // If outside range, it indicates a GDS bug or data corruption
    if (score < 0.0 || score > 1.0) {
      throw new Error(
        `match_score out of range for context ${contextId}: ${score} (expected [0.0, 1.0])`
      );
    }

    return score;
  }

  /**
   * Validate and parse count value from query result
   *
   * @throws Error if count is NaN, Infinity, negative, or non-integer
   */
  private validateCount(rawCount: unknown, fieldName: string): number {
    const count = Number(rawCount);

    // Check for NaN, Infinity, -Infinity
    if (!Number.isFinite(count)) {
      throw new Error(
        `Invalid ${fieldName}: ${rawCount} (expected finite number)`
      );
    }

    // Must be non-negative integer
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `Invalid ${fieldName}: ${count} (expected non-negative integer)`
      );
    }

    return count;
  }

  /**
   * Find similar contexts using Overlap metric (soft matching)
   *
   * Use cases:
   * - Target context in pipeline mode (find achievers with SOME relevant skills)
   * - current-only explore mode (where can I go from here?)
   * - target-only explore mode (who reached this position?)
   *
   * Overlap metric: |A ∩ B| / min(|A|, |B|)
   * - More permissive than Jaccard
   * - Doesn't penalize candidates with extra skills
   * - Good for "find people with AT LEAST these skills"
   *
   * Implementation:
   * - Uses MATCH + WHERE to filter candidate contexts
   * - Collects filtered nodes into array
   * - Passes node collection to GDS targetNodeFilter (not string expression)
   * - All parameters properly parameterized (no SQL injection)
   *
   * @param searchContextId - Context ID to find similarities for
   * @param excludeUserId - User ID to exclude from results (usually current user)
   * @param filters - Optional filters (position, industry, country, etc.)
   * @param topK - Max number of results (default: 100)
   * @param similarityCutoff - Min similarity score (default: 0.1, range: 0.0-1.0)
   * @returns Array of similar contexts sorted by match_score DESC
   */
  async findSimilarByOverlap(
    searchContextId: string,
    excludeUserId: string,
    filters?: SimilarityFilters,
    topK: number = 100,
    similarityCutoff: number = 0.1
  ): Promise<SimilarityResult[]> {
    // Validate parameters (bug #2, #14)
    if (!searchContextId || searchContextId.trim() === '') {
      throw new Error('searchContextId is required and cannot be empty');
    }
    if (!excludeUserId || excludeUserId.trim() === '') {
      throw new Error('excludeUserId is required and cannot be empty');
    }
    if (topK < 1) {
      throw new Error(`topK must be >= 1, got: ${topK}`);
    }
    if (topK > MAX_TOP_K) {
      throw new Error(`topK must be <= ${MAX_TOP_K}, got: ${topK}`);
    }
    if (similarityCutoff < 0.0 || similarityCutoff > 1.0) {
      throw new Error(`similarityCutoff must be in [0.0, 1.0], got: ${similarityCutoff}`);
    }

    console.log(`🔍 [GDS Similarity] Finding similar contexts (OVERLAP)`);
    console.log(`   Search context: ${searchContextId}`);
    console.log(`   Exclude user: ${excludeUserId}`);
    console.log(`   Filters:`, filters);
    console.log(`   TopK: ${topK}, Cutoff: ${similarityCutoff}`);

    // 1. Ensure projection exists
    await this.projectionService.ensureSkillsGraphProjection();

    // 2. Validate searchContextId exists (bug #1 fix)
    const validateQuery = `
      MATCH (ctx:Context {context_id: $searchContextId})
      RETURN ctx.context_id AS context_id
    `;
    const validateResult = await withReadSession(this.driver, (tx) =>
      tx.run(validateQuery, { searchContextId })
    );
    if (validateResult.records.length === 0) {
      throw new Error(`Context ${searchContextId} not found`);
    }

    // 3. Count candidate contexts BEFORE running GDS (bug #12 fix: avoid empty targetNodes)
    const countQuery = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx <> searchCtx
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      RETURN count(candidateCtx) AS candidateCount
    `;

    const countResult = await withReadSession(this.driver, (tx) =>
      tx.run(countQuery, {
        searchContextId,
        filterPosition: filters?.position,
        filterIndustry: filters?.industry,
        filterCountryCode: filters?.country_code,
        filterCityName: filters?.city_name,
        filterCompanySize: filters?.company_size,
        filterWorkType: filters?.work_type,
      })
    );

    const candidateCount = this.validateCount(countResult.records[0]?.get('candidateCount') ?? 0, 'candidateCount');

    if (candidateCount === 0) {
      console.log(`   ⚠️ No candidate contexts match filters, returning empty results`);
      return []; // Early return - avoid GDS call with empty targetNodeFilter
    }

    console.log(`   📊 Found ${candidateCount} candidate contexts after filters`);

    // 4. Run GDS Filtered Node Similarity (Overlap) in SINGLE query
    // CRITICAL: GDS projection only includes Context, Skill, WorkDomain (NOT User!)
    // So we filter by properties on Context nodes, then filter by user_id AFTER GDS call
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx <> searchCtx
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      WITH searchCtx, collect(DISTINCT candidateCtx) AS targetNodes
      CALL gds.nodeSimilarity.filtered.stream('waymates-skills-graph', {
        sourceNodeFilter: searchCtx,
        targetNodeFilter: targetNodes,
        relationshipTypes: ['USES_SKILL', 'IN_WORK_DOMAIN'],
        similarityMetric: 'OVERLAP',
        topK: $topK,
        similarityCutoff: $similarityCutoff
      })
      YIELD node2, similarity
      WITH gds.util.asNode(node2) AS candidateContext, similarity
      MATCH (u:User)-[:HAS_CONTEXT]->(candidateContext)
      WHERE u.user_id <> $excludeUserId
      RETURN candidateContext.context_id AS context_id, similarity AS match_score
      ORDER BY match_score DESC
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, {
        searchContextId,
        excludeUserId,
        topK: int(topK),  // GDS requires Integer, not Double
        similarityCutoff,
        filterPosition: filters?.position,
        filterIndustry: filters?.industry,
        filterCountryCode: filters?.country_code,
        filterCityName: filters?.city_name,
        filterCompanySize: filters?.company_size,
        filterWorkType: filters?.work_type,
      })
    );

    console.log(`   ✅ Found ${result.records.length} similar contexts`);

    // NOTE (bug #3 fix): Projection is NOT dropped to avoid race conditions
    // in concurrent requests. Cleanup happens:
    // - In tests: afterEach hook calls dropAllProjections()
    // - In production: projection persists (will optimize with TTL in Q5 final phase)

    return result.records.map((rec) => {
      const contextId = rec.get('context_id') as string;
      const rawScore = rec.get('match_score');

      return {
        context_id: contextId,
        match_score: this.validateMatchScore(rawScore, contextId),
      };
    });
  }

  /**
   * Find similar contexts using Jaccard metric (strict matching)
   *
   * Use cases:
   * - Current context in pipeline mode (find people with SIMILAR skill sets)
   * - When we want to penalize candidates with too many extra skills
   *
   * Jaccard metric: |A ∩ B| / |A ∪ B|
   * - More strict than Overlap
   * - Penalizes candidates with many extra skills
   * - Good for "find people with EXACTLY these skills (and not much more)"
   *
   * Implementation:
   * - Uses MATCH + WHERE to filter candidate contexts
   * - Collects filtered nodes into array
   * - Passes node collection to GDS targetNodeFilter (not string expression)
   * - All parameters properly parameterized (no SQL injection)
   *
   * @param searchContextId - Context ID to find similarities for
   * @param excludeUserId - User ID to exclude from results (usually current user)
   * @param filters - Optional filters (position, industry, country, etc.)
   * @param topK - Max number of results (default: 100)
   * @param similarityCutoff - Min similarity score (default: 0.3, higher than Overlap)
   * @returns Array of similar contexts sorted by match_score DESC
   */
  async findSimilarByJaccard(
    searchContextId: string,
    excludeUserId: string,
    filters?: SimilarityFilters,
    topK: number = 100,
    similarityCutoff: number = 0.3
  ): Promise<SimilarityResult[]> {
    // Validate parameters (bug #2, #14)
    if (!searchContextId || searchContextId.trim() === '') {
      throw new Error('searchContextId is required and cannot be empty');
    }
    if (!excludeUserId || excludeUserId.trim() === '') {
      throw new Error('excludeUserId is required and cannot be empty');
    }
    if (topK < 1) {
      throw new Error(`topK must be >= 1, got: ${topK}`);
    }
    if (topK > MAX_TOP_K) {
      throw new Error(`topK must be <= ${MAX_TOP_K}, got: ${topK}`);
    }
    if (similarityCutoff < 0.0 || similarityCutoff > 1.0) {
      throw new Error(`similarityCutoff must be in [0.0, 1.0], got: ${similarityCutoff}`);
    }

    console.log(`🔍 [GDS Similarity] Finding similar contexts (JACCARD)`);
    console.log(`   Search context: ${searchContextId}`);
    console.log(`   Exclude user: ${excludeUserId}`);
    console.log(`   Filters:`, filters);
    console.log(`   TopK: ${topK}, Cutoff: ${similarityCutoff}`);

    // 1. Ensure projection exists
    await this.projectionService.ensureSkillsGraphProjection();

    // 2. Validate searchContextId exists (bug #1 fix)
    const validateQuery = `
      MATCH (ctx:Context {context_id: $searchContextId})
      RETURN ctx.context_id AS context_id
    `;
    const validateResult = await withReadSession(this.driver, (tx) =>
      tx.run(validateQuery, { searchContextId })
    );
    if (validateResult.records.length === 0) {
      throw new Error(`Context ${searchContextId} not found`);
    }

    // 3. Count candidate contexts BEFORE running GDS (bug #12 fix: avoid empty targetNodes)
    const countQuery = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx <> searchCtx
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      RETURN count(candidateCtx) AS candidateCount
    `;

    const countResult = await withReadSession(this.driver, (tx) =>
      tx.run(countQuery, {
        searchContextId,
        filterPosition: filters?.position,
        filterIndustry: filters?.industry,
        filterCountryCode: filters?.country_code,
        filterCityName: filters?.city_name,
        filterCompanySize: filters?.company_size,
        filterWorkType: filters?.work_type,
      })
    );

    const candidateCount = this.validateCount(countResult.records[0]?.get('candidateCount') ?? 0, 'candidateCount');

    if (candidateCount === 0) {
      console.log(`   ⚠️ No candidate contexts match filters, returning empty results`);
      return []; // Early return - avoid GDS call with empty targetNodeFilter
    }

    console.log(`   📊 Found ${candidateCount} candidate contexts after filters`);

    // 4. Run GDS Filtered Node Similarity (Jaccard) in SINGLE query
    // CRITICAL: GDS projection only includes Context, Skill, WorkDomain (NOT User!)
    // So we filter by properties on Context nodes, then filter by user_id AFTER GDS call
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx <> searchCtx
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      WITH searchCtx, collect(DISTINCT candidateCtx) AS targetNodes
      CALL gds.nodeSimilarity.filtered.stream('waymates-skills-graph', {
        sourceNodeFilter: searchCtx,
        targetNodeFilter: targetNodes,
        relationshipTypes: ['USES_SKILL', 'IN_WORK_DOMAIN'],
        similarityMetric: 'JACCARD',
        topK: $topK,
        similarityCutoff: $similarityCutoff
      })
      YIELD node2, similarity
      WITH gds.util.asNode(node2) AS candidateContext, similarity
      MATCH (u:User)-[:HAS_CONTEXT]->(candidateContext)
      WHERE u.user_id <> $excludeUserId
      RETURN candidateContext.context_id AS context_id, similarity AS match_score
      ORDER BY match_score DESC
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, {
        searchContextId,
        excludeUserId,
        topK: int(topK),  // GDS requires Integer, not Double
        similarityCutoff,
        filterPosition: filters?.position,
        filterIndustry: filters?.industry,
        filterCountryCode: filters?.country_code,
        filterCityName: filters?.city_name,
        filterCompanySize: filters?.company_size,
        filterWorkType: filters?.work_type,
      })
    );

    console.log(`   ✅ Found ${result.records.length} similar contexts`);

    // NOTE (bug #3 fix): Projection is NOT dropped to avoid race conditions
    // in concurrent requests. Cleanup happens:
    // - In tests: afterEach hook calls dropAllProjections()
    // - In production: projection persists (will optimize with TTL in Q5 final phase)

    return result.records.map((rec) => {
      const contextId = rec.get('context_id') as string;
      const rawScore = rec.get('match_score');

      return {
        context_id: contextId,
        match_score: this.validateMatchScore(rawScore, contextId),
      };
    });
  }

}
