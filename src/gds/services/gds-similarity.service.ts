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
 * ⚠️ SQL Injection Risk (Q3):
 * - targetNodeFilter uses string concatenation (NOT parameterized)
 * - Accepted risk for MVP, will fix in final cleanup phase
 */

import type { Driver } from 'neo4j-driver';
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
   * ⚠️ SQL Injection Risk: filters are NOT parameterized (Q3 decision)
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

    // 2. Build target filter (⚠️ SQL injection risk - accepted for MVP)
    const targetFilter = this.buildTargetFilter(excludeUserId, filters);
    console.log(`   Target filter: ${targetFilter}`);

    // 3. Validate searchContextId exists (bug #1)
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

    // 4. Run GDS Filtered Node Similarity (Overlap)
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      CALL gds.nodeSimilarity.filtered.stream('waymates-skills-graph', {
        sourceNodeFilter: searchCtx,
        targetNodeFilter: '${targetFilter}',
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
      tx.run(query, { searchContextId, topK, similarityCutoff })
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
   * ⚠️ SQL Injection Risk: filters are NOT parameterized (Q3 decision)
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

    // 2. Build target filter (⚠️ SQL injection risk - accepted for MVP)
    const targetFilter = this.buildTargetFilter(excludeUserId, filters);
    console.log(`   Target filter: ${targetFilter}`);

    // 3. Validate searchContextId exists (bug #1)
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

    // 4. Run GDS Filtered Node Similarity (Jaccard)
    const query = `
      MATCH (searchCtx:Context {context_id: $searchContextId})
      CALL gds.nodeSimilarity.filtered.stream('waymates-skills-graph', {
        sourceNodeFilter: searchCtx,
        targetNodeFilter: '${targetFilter}',
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
      tx.run(query, { searchContextId, topK, similarityCutoff })
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
   * Build target node filter for GDS Filtered Node Similarity
   *
   * ⚠️ SECURITY WARNING (Q3):
   * This method uses string concatenation, NOT parameterized queries.
   * This is a known SQL injection vulnerability.
   * Accepted for MVP, will fix in final cleanup phase.
   *
   * UPDATED (bug #7 fix): Added escapeString() to prevent Cypher syntax errors
   * when filter values contain single quotes (e.g., "Software Engineer's Assistant").
   *
   * Filter format: Cypher WHERE-like expression as string
   * Example: "n:Context AND n.user_id <> 'user123' AND n.position = 'Engineer'"
   *
   * @param excludeUserId - User ID to exclude
   * @param filters - Optional strict filters
   * @returns String filter for GDS targetNodeFilter
   */
  private buildTargetFilter(
    excludeUserId: string,
    filters?: SimilarityFilters
  ): string {
    // Escape single quotes to prevent Cypher syntax errors (bug #7 fix)
    const escapeString = (str: string): string => str.replace(/'/g, "\\'");

    const conditions: string[] = [
      'n:Context', // Must be a Context node
      `n.user_id <> '${escapeString(excludeUserId)}'`, // ⚠️ SQL injection risk remains
    ];

    if (filters?.position) {
      conditions.push(`n.position = '${escapeString(filters.position)}'`);
    }
    if (filters?.industry) {
      conditions.push(`n.industry = '${escapeString(filters.industry)}'`);
    }
    if (filters?.country_code) {
      conditions.push(`n.country_code = '${escapeString(filters.country_code)}'`);
    }
    if (filters?.city_name) {
      conditions.push(`n.city_name = '${escapeString(filters.city_name)}'`);
    }
    if (filters?.company_size) {
      conditions.push(`n.company_size = '${escapeString(filters.company_size)}'`);
    }
    if (filters?.work_type) {
      conditions.push(`n.work_type = '${escapeString(filters.work_type)}'`);
    }

    return conditions.join(' AND ');
  }
}
