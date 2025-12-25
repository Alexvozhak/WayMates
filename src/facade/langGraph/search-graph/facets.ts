import { config } from "../../env.js";

import type {
  CandidateFacets,
  FacetField,
  FacetValue,
  MatchedCandidateWithPath,
  ScoredMatchedCandidate,
} from "../../../shared/schemas.js";

type CandidateWithContext = MatchedCandidateWithPath | ScoredMatchedCandidate;

type FacetableField = FacetField | "citizenships";

function countByField(candidates: CandidateWithContext[], field: FacetableField): FacetValue[] {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const fieldValue = candidate.matchedContext[field];
    const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue].filter(Boolean);

    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([value, count]) => ({ value, count })).toSorted((a, b) => b.count - a.count);
}

export function computeFacets(candidates: CandidateWithContext[]): CandidateFacets {
  return {
    totalCount: candidates.length,
    countries: countByField(candidates, "countryCode"),
    positions: countByField(candidates, "position"),
    roles: countByField(candidates, "role"),
    industries: countByField(candidates, "industry"),
    citizenships: countByField(candidates, "citizenships"),
  };
}

export function shouldUseFacets(candidates: CandidateWithContext[]): boolean {
  if (candidates.length > config.FACETS_MAX_CANDIDATES) {
    return true;
  }

  const sizeKB = JSON.stringify(candidates).length / 1024;
  return sizeKB > config.FACETS_MAX_JSON_SIZE_KB;
}
