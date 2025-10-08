import fs from "node:fs/promises";
import path from "node:path";

type QueryItem = {
  id: string;
  description?: string;
  query: {
    role: string;
    userDomains: string[];
    userSkills: string[];
    userRoleExp: number; // years
    desiredCountry?: string;
    desiredCity?: string;
    minCoverage?: number; // 0..1
    expTolerance?: number; // years
    requireDomain?: boolean;
    limit?: number;
    preset?: string;
  };
};

type ContextPeriod = { start: string; end: string | null };
type ContextEntry = {
  context_id: string;
  period?: ContextPeriod;
  role_started_at?: string;
  domains_covered?: string[];
  tech?: Record<string, string[] | undefined>;
  skills_hard?: string[];
  location?: { country?: string; city?: string };
};

type CandidateFile = {
  user_id: string;
  contexts: ContextEntry[];
};

type CandidateProfile = {
  user_id: string;
  skills: Set<string>;
  domains: Set<string>;
  locations: { countries: Set<string>; cities: Set<string> };
  totalExpYears: number;
};

async function readJsonFile<T = unknown>(inputPath: string): Promise<T> {
  const abs = path.resolve(inputPath);
  const raw = await fs.readFile(abs, "utf-8");
  return JSON.parse(raw) as T;
}

function parseYearMonth(
  s: string | undefined | null
): { y: number; m: number } | null {
  if (!s) return null;
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  if (!y || !mm || mm < 1 || mm > 12) return null;
  return { y, m: mm };
}

function monthsDiff(
  start: { y: number; m: number },
  end: { y: number; m: number }
): number {
  return (end.y - start.y) * 12 + (end.m - start.m);
}

function nowYearMonth(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function aggregateCandidate(c: CandidateFile): CandidateProfile {
  const skills = new Set<string>();
  const domains = new Set<string>();
  const countries = new Set<string>();
  const cities = new Set<string>();
  let totalMonths = 0;

  for (const ctx of c.contexts || []) {
    // Domains
    for (const d of ctx.domains_covered || []) {
      if (d) domains.add(d.toLowerCase());
    }
    // Tech skills: flatten all arrays in tech
    if (ctx.tech) {
      for (const v of Object.values(ctx.tech)) {
        if (Array.isArray(v)) {
          for (const s of v) if (s) skills.add(s.toLowerCase());
        }
      }
    }
    for (const s of ctx.skills_hard || []) {
      if (s) skills.add(s.toLowerCase());
    }
    // Locations
    if (ctx.location) {
      if (ctx.location.country)
        countries.add(ctx.location.country.toLowerCase());
      if (ctx.location.city) cities.add(ctx.location.city.toLowerCase());
    }
    // Experience months
    const p = ctx.period;
    const start = parseYearMonth(p?.start ?? ctx.role_started_at ?? undefined);
    const end = parseYearMonth(p?.end ?? undefined) ?? nowYearMonth();
    if (start && end) {
      const diff = monthsDiff(start, end);
      if (diff > 0) totalMonths += diff;
    }
  }

  return {
    user_id: c.user_id,
    skills,
    domains,
    locations: { countries, cities },
    totalExpYears: Math.round((totalMonths / 12) * 10) / 10, // one decimal
  };
}

function intersectCount(a: Set<string>, b: Set<string> | string[]): number {
  const bb = Array.isArray(b) ? new Set(b) : b;
  let k = 0;
  for (const x of a) if (bb.has(x)) k++;
  return k;
}

function toSetLower(a: string[] | undefined | null): Set<string> {
  const s = new Set<string>();
  for (const x of a || []) if (x) s.add(x.toLowerCase());
  return s;
}

type Ranked = {
  user_id: string;
  matchedSkills: number;
  coverage: number; // 0..1
  domainMatches: number;
  expDelta: number;
  locCity: boolean;
  locCountry: boolean;
  score: number;
  domainsHit: string[];
  candidateExp: number;
};

function rankCandidates(
  query: QueryItem["query"],
  profiles: CandidateProfile[]
): Ranked[] {
  const qSkills = toSetLower(query.userSkills || []);
  const qDomains = toSetLower(query.userDomains || []);
  const desiredCountry = query.desiredCountry?.toLowerCase();
  const desiredCity = query.desiredCity?.toLowerCase();
  const minCoverage = query.minCoverage ?? 0.7;
  const tolerance = query.expTolerance ?? 1;
  const requireDomain = !!query.requireDomain;
  const emptySkills = qSkills.size === 0;

  const ranked: Ranked[] = [];

  for (const p of profiles) {
    const matchedSkills = intersectCount(qSkills, p.skills);
    const coverage = emptySkills
      ? 0
      : qSkills.size > 0
        ? matchedSkills / qSkills.size
        : 0;
    const domainMatches =
      qDomains.size > 0 ? intersectCount(qDomains, p.domains) : 0;
    const expDelta = Math.abs(p.totalExpYears - (query.userRoleExp ?? 0));
    const locCountry = desiredCountry
      ? p.locations.countries.has(desiredCountry)
      : false;
    const locCity = desiredCity ? p.locations.cities.has(desiredCity) : false;

    // Filtering according to rules
    if (!emptySkills && qSkills.size > 0 && coverage < minCoverage) continue;
    if (requireDomain && qDomains.size > 0 && domainMatches === 0) continue;
    if (expDelta > tolerance) continue;

    // Score for ordering
    const coverageScore = emptySkills ? 0 : coverage; // 0..1
    const domainBonus = Math.min(0.1, 0.05 * domainMatches); // up to +0.1
    const locBonus = (locCountry ? 0.05 : 0) + (locCity ? 0.1 : 0);
    const expPenalty = 0.2 * (expDelta / tolerance); // up to -0.2 when at edge
    const score = coverageScore + domainBonus + locBonus - expPenalty;

    const domainsHit: string[] = [];
    if (qDomains.size > 0 && p.domains.size > 0) {
      for (const d of p.domains) if (qDomains.has(d)) domainsHit.push(d);
    }

    ranked.push({
      user_id: p.user_id,
      matchedSkills,
      coverage: emptySkills ? 0 : coverage,
      domainMatches,
      expDelta,
      locCity,
      locCountry,
      score,
      domainsHit,
      candidateExp: p.totalExpYears,
    });
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.coverage - a.coverage ||
      a.expDelta - b.expDelta ||
      b.domainMatches - a.domainMatches
  );
  return ranked;
}

function pct(n: number) {
  return Math.round(n * 100);
}

function formatJustification(q: QueryItem["query"], r: Ranked): string {
  const parts: string[] = [];
  if ((q.userSkills?.length || 0) > 0) {
    parts.push(
      `Пересечение навыков ${pct(r.coverage)}% (${r.matchedSkills}/${q.userSkills.length})`
    );
  }
  parts.push(
    `опыт ${r.candidateExp.toFixed(1)}г (Δ ${r.expDelta.toFixed(1)} ≤ ${q.expTolerance ?? 1})`
  );
  if ((q.userDomains?.length || 0) > 0) {
    if (r.domainsHit.length > 0)
      parts.push(`совпадение домена: ${r.domainsHit.join(", ")}`);
  }
  if (q.desiredCity && (r.locCity || r.locCountry)) {
    if (r.locCity) parts.push(`локация совпадает (город + страна)`);
    else if (r.locCountry) parts.push(`совпадает страна`);
  }
  return parts.join(", ");
}

async function main() {
  const baseDir = path.resolve("data/contexts/generated");
  const entries = await fs.readdir(baseDir);
  const jsonFiles = entries.filter(
    (f) => f.endsWith(".json") && f !== "query_contexts.json"
  );

  // Load candidates
  const candidates: CandidateFile[] = [];
  for (const f of jsonFiles) {
    const p = path.join(baseDir, f);
    try {
      const data = await readJsonFile<CandidateFile>(p);
      if (data && data.user_id && Array.isArray(data.contexts)) {
        candidates.push(data);
      }
    } catch {
      // skip invalid
    }
  }
  const profiles = candidates.map(aggregateCandidate);

  // Load queries
  const queriesPath = path.join(baseDir, "query_contexts.json");
  const queries = (await readJsonFile<QueryItem[]>(queriesPath)).map((q) => ({
    id: q.id,
    description: q.description,
    query: q.query,
  }));

  const output: Record<
    string,
    { gold_ids: string[]; justifications: string[] }
  > = {};

  for (const q of queries) {
    const ranked = rankCandidates(q.query, profiles);
    const top = ranked.slice(0, 10);
    output[q.id] = {
      gold_ids: top.map((r) => r.user_id),
      justifications: top.map((r) => formatJustification(q.query, r)),
    };
  }

  // Ensure directory and write file
  const outDir = path.resolve("data/gold");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "gold_labels.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");

  // Print to stdout as well
  console.log(JSON.stringify(output));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
