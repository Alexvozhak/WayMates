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

export class GdsSimilarityService {
  constructor(
    private driver: Driver,
    private projectionService: GdsProjectionService
  ) {}

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
    // Validate parameters (bug #2)
    if (!excludeUserId || excludeUserId.trim() === '') {
      throw new Error('excludeUserId is required and cannot be empty');
    }
    if (topK < 1) {
      throw new Error(`topK must be >= 1, got: ${topK}`);
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

    // 3. Run GDS Filtered Node Similarity (Overlap)
    // Note: targetNodeFilter requires a collection of nodes, not a WHERE expression
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx.user_id <> $excludeUserId
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      WITH searchCtx, collect(candidateCtx) AS targetNodes
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
      RETURN candidateContext.context_id AS context_id, similarity AS match_score
      ORDER BY match_score DESC
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, {
        searchContextId,
        excludeUserId,
        topK: int(topK),  // GDS requires Integer, not Double
        similarityCutoff,
        // Optional filter parameters
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

    return result.records.map((rec) => ({
      context_id: rec.get('context_id'),
      match_score: Number(rec.get('match_score')),
    }));
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
    // Validate parameters (bug #2)
    if (!excludeUserId || excludeUserId.trim() === '') {
      throw new Error('excludeUserId is required and cannot be empty');
    }
    if (topK < 1) {
      throw new Error(`topK must be >= 1, got: ${topK}`);
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

    // 3. Run GDS Filtered Node Similarity (Jaccard)
    // Note: targetNodeFilter requires a collection of nodes, not a WHERE expression
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      MATCH (candidateCtx:Context)
      WHERE candidateCtx.user_id <> $excludeUserId
        ${filters?.position ? 'AND candidateCtx.position = $filterPosition' : ''}
        ${filters?.industry ? 'AND candidateCtx.industry = $filterIndustry' : ''}
        ${filters?.country_code ? 'AND candidateCtx.country_code = $filterCountryCode' : ''}
        ${filters?.city_name ? 'AND candidateCtx.city_name = $filterCityName' : ''}
        ${filters?.company_size ? 'AND candidateCtx.company_size = $filterCompanySize' : ''}
        ${filters?.work_type ? 'AND candidateCtx.work_type = $filterWorkType' : ''}
      WITH searchCtx, collect(candidateCtx) AS targetNodes
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
      RETURN candidateContext.context_id AS context_id, similarity AS match_score
      ORDER BY match_score DESC
    `;

    const result = await withReadSession(this.driver, (tx) =>
      tx.run(query, {
        searchContextId,
        excludeUserId,
        topK: int(topK),  // GDS requires Integer, not Double
        similarityCutoff,
        // Optional filter parameters
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

    return result.records.map((rec) => ({
      context_id: rec.get('context_id'),
      match_score: Number(rec.get('match_score')),
    }));
  }

}
