import type { DictionaryType } from "../../shared/schemas.js";

export function getVerifiedDictionariesQuery(): string {
  return `
OPTIONAL MATCH (s:Skill {verified: true})
WITH collect({canonicalName: s.canonicalName, complexity: s.complexity}) AS skills
OPTIONAL MATCH (p:Position {verified: true})
WITH skills, collect(p.canonicalName) AS positions
OPTIONAL MATCH (d:WorkDomain {verified: true})
WITH skills, positions, collect(d.canonicalName) AS domains
OPTIONAL MATCH (c:City {verified: true})
WITH skills, positions, domains, collect(c.canonicalName) AS cities
OPTIONAL MATCH (i:Industry {verified: true})
WITH skills, positions, domains, cities, collect(i.canonicalName) AS industries
OPTIONAL MATCH (pl:Platform {verified: true})
WITH skills, positions, domains, cities, industries, collect(pl.canonicalName) AS platforms
OPTIONAL MATCH (l:Language {verified: true})
WITH skills, positions, domains, cities, industries, platforms, collect(l.canonicalName) AS languages
OPTIONAL MATCH (r:Reason)
WITH skills, positions, domains, cities, industries, platforms, languages,
     collect({reasonId: r.reasonId, description: r.description}) AS reasons
RETURN {
  skills: skills,
  positions: positions,
  domains: domains,
  cities: cities,
  industries: industries,
  platforms: platforms,
  languages: languages,
  reasons: reasons
} AS dictionaries
  `.trim();
}

export function addTermQuery(type: DictionaryType): string {
  const label = getLabelForType(type);
  const complexitySet = type === "skill" ? ",\n  t.complexity = $complexity" : "";

  return `
MERGE (t:${label} {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy${complexitySet}
RETURN t.canonicalName AS canonicalName
  `.trim();
}

function getLabelForType(type: DictionaryType): string {
  const labelMap: Record<DictionaryType, string> = {
    skill: "Skill",
    position: "Position",
    domain: "WorkDomain",
    city: "City",
    industry: "Industry",
    platform: "Platform",
    language: "Language",
  };

  return labelMap[type];
}
