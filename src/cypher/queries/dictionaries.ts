import type { SimpleDictionaryType } from "../../shared/schemas.js";

export function getVerifiedDictionariesQuery(): string {
  return `
OPTIONAL MATCH (s:Skill {verified: true})
WITH collect(s.canonicalName) AS skills
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
     collect(r.canonicalName) AS reasons
RETURN {
  skill: skills,
  position: positions,
  domain: domains,
  city: cities,
  industry: industries,
  platform: platforms,
  language: languages,
  reasons: reasons
} AS dictionaries
  `.trim();
}

export function addSimpleTermQuery(type: SimpleDictionaryType): string {
  const label = getLabelForSimpleType(type);

  return `
MERGE (t:${label} {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy
RETURN t.canonicalName AS canonicalName
  `.trim();
}

export function addSkillQuery(): string {
  return `
MERGE (t:Skill {canonicalName: $canonicalName})
ON CREATE SET
  t.verified = $verified,
  t.createdAt = $createdAt,
  t.createdBy = $createdBy,
  t.complexity = $complexity
RETURN t.canonicalName AS canonicalName
  `.trim();
}

function getLabelForSimpleType(type: SimpleDictionaryType): string {
  const labelMap: Record<SimpleDictionaryType, string> = {
    position: "Position",
    domain: "WorkDomain",
    city: "City",
    industry: "Industry",
    platform: "Platform",
    language: "Language",
    skill: "Skill",
  };

  return labelMap[type];
}
