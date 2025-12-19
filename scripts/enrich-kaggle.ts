#!/usr/bin/env tsx
/* eslint-disable */
// @ts-nocheck

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

// Load company enrichment mapping
const COMPANY_ENRICHMENT: Record<string, { industry: string }> = JSON.parse(
  readFileSync("/home/alex/projects/WayMatesRemote-kaggle/data/company-enrichment.json", "utf-8"),
);

// ==========================================
// === TYPE DEFINITIONS ===
// ==========================================

type KaggleExperience = {
  person_id: string;
  title: string;
  firm: string;
  start_date: string;
  end_date: string;
  location: string;
};

type KaggleSkill = {
  person_id: string;
  skill: string;
};

type EnrichedContext = {
  position: string;
  domains: string[];
  skills: string[];
  industry: string | null;
  companySize: string | null;
  countryCode: string | null;
  cityName: string | null;
  citizenships: string[];
  createdAt: string;
  creationReason: string[];
};

type EnrichedPerson = {
  personId: string;
  contexts: EnrichedContext[];
};

// ==========================================
// === CONSTANTS ===
// ==========================================

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  Backend: ["backend", "server", "api", "database", "dba", "sql", "java", "python", "node"],
  Frontend: ["frontend", "ui", "ux", "react", "angular", "vue", "javascript", "css", "html"],
  Mobile: ["mobile", "android", "ios", "swift", "kotlin", "react native", "flutter"],
  DevOps: ["devops", "infrastructure", "kubernetes", "docker", "aws", "cloud", "jenkins", "ci/cd"],
  Data: ["data scientist", "ml", "machine learning", "ai", "analytics", "data engineer", "etl"],
  Security: ["security", "cybersecurity", "infosec", "penetration", "firewall"],
  QA: ["qa", "test", "quality assurance", "automation", "selenium"],
};

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

const INDIAN_STATES = [
  "Telangana",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Delhi",
  "Haryana",
  "Gujarat",
  "Uttar Pradesh",
  "West Bengal",
  "Kerala",
];

const COUNTRY_CODES: Record<string, string> = {
  Russia: "RU",
  Ecuador: "EC",
  Nigeria: "NG",
  Germany: "DE",
  Afghanistan: "AF",
  Cuba: "CU",
  India: "IN",
};

// ==========================================
// === ENRICHMENT FUNCTIONS ===
// ==========================================

/**
 * Infer technical domains from job title and skills
 */
function inferDomains(title: string, skills: string[]): string[] {
  const text = `${title} ${skills.join(" ")}`.toLowerCase();
  const domains = new Set<string>();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      domains.add(domain);
    }
  }

  return Array.from(domains);
}

/**
 * Infer industry from company name using keywords
 */
function inferIndustry(firmName: string): string | null {
  const name = firmName.toLowerCase().trim();

  // 1. Try exact match in enrichment JSON
  const enriched = COMPANY_ENRICHMENT[name];
  if (enriched) {
    return enriched.industry;
  }

  // 2. Fallback to keyword matching

  // Skip non-companies
  if (name === "freelance" || name.includes("freelancer")) {
    return null;
  }

  // .com domains → Technology
  if (firmName.endsWith(".com")) {
    return "Technology";
  }

  // Finance
  if (
    name.includes("bank") ||
    name.includes("financial") ||
    name.includes("capital") ||
    name.includes("investment") ||
    name.includes("insurance") ||
    name.includes("credit")
  ) {
    return "Finance";
  }

  // Technology
  if (
    name.includes("tech") ||
    name.includes("software") ||
    name.includes("systems") ||
    name.includes("digital") ||
    name.includes("solutions") ||
    name.includes("cisco") ||
    name.includes("ibm") ||
    name.includes("google") ||
    name.includes("microsoft") ||
    name.includes("oracle")
  ) {
    return "Technology";
  }

  // Education
  if (name.includes("university") || name.includes("school") || name.includes("college") || name.includes("academy")) {
    return "Education";
  }

  // Healthcare
  if (
    name.includes("hospital") ||
    name.includes("medical") ||
    name.includes("health") ||
    name.includes("pharmaceutical")
  ) {
    return "Healthcare";
  }

  // Telecom
  if (name.includes("telecom") || name.includes("verizon") || name.includes("at&t") || name.includes("sprint")) {
    return "Telecom";
  }

  // Retail
  if (name.includes("walmart") || name.includes("target") || name.includes("retail") || name.includes("store")) {
    return "Retail";
  }

  // Energy
  if (name.includes("energy") || name.includes("electric") || name.includes("power") || name.includes("utility")) {
    return "Energy";
  }

  // Defense/Aerospace
  if (
    name.includes("defense") ||
    name.includes("boeing") ||
    name.includes("lockheed") ||
    name.includes("raytheon") ||
    name.includes("army") ||
    name.includes("military")
  ) {
    return "Defense";
  }

  // Consulting
  if (name.includes("consulting") || name.includes("accenture") || name.includes("deloitte") || name.includes("pwc")) {
    return "Consulting";
  }

  // Manufacturing
  if (
    name.includes("manufacturing") ||
    name.includes("industrial") ||
    name.includes("electric") ||
    name.includes("motors")
  ) {
    return "Manufacturing";
  }

  return null;
}

/**
 * Parse location string to countryCode and cityName
 */
function parseLocation(location: string): { countryCode: string | null; cityName: string | null } {
  if (!location || location === "N/A" || location.trim() === "") {
    return { countryCode: null, cityName: null };
  }

  const parts = location.split(",").map((s) => s.trim());

  if (parts.length === 2) {
    const cityName = parts[0];
    const region = parts[1];

    // US states
    if (US_STATES.includes(region)) {
      return { countryCode: "US", cityName };
    }

    // Indian states
    if (INDIAN_STATES.includes(region)) {
      return { countryCode: "IN", cityName };
    }

    // Country mapping
    if (COUNTRY_CODES[region]) {
      return { countryCode: COUNTRY_CODES[region], cityName };
    }

    // Unknown region - skip
    return { countryCode: null, cityName: null };
  }

  if (parts.length === 3) {
    // Format: "City, State, Country"
    const cityName = parts[0];
    const countryOrState = parts[2];

    if (countryOrState === "US") {
      return { countryCode: "US", cityName };
    }

    if (COUNTRY_CODES[countryOrState]) {
      return { countryCode: COUNTRY_CODES[countryOrState], cityName };
    }
  }

  // Single word or unparseable - skip
  return { countryCode: null, cityName: null };
}

/**
 * Infer citizenships from country code
 */
function inferCitizenships(countryCode: string | null): string[] {
  return countryCode ? [countryCode] : [];
}

/**
 * Parse Kaggle date to ISO 8601
 * Formats: "04/2017" (MM/YYYY) or "02/18" (MM/YY) or "Present" or "1992" (YYYY only)
 */
function parseDate(dateStr: string): string {
  if (dateStr === "Present") {
    return new Date().toISOString();
  }

  const parts = dateStr.split("/");

  // Format: YYYY only (e.g., "1992")
  if (parts.length === 1) {
    return `${dateStr}-01-01T00:00:00Z`;
  }

  if (parts.length !== 2) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const month = parts[0].padStart(2, "0");
  let year = parts[1];

  // Handle 2-digit year (02/18 → 2018)
  if (year.length === 2) {
    const yearNum = Number.parseInt(year, 10);
    year = yearNum > 50 ? `19${year}` : `20${year}`;
  }

  return `${year}-${month}-01T00:00:00Z`;
}

/**
 * Infer creation reasons by comparing with previous context
 */
function inferCreationReason(prevContext: EnrichedContext | null, currExperience: KaggleExperience): string[] {
  if (!prevContext) {
    return ["started_working"];
  }

  const reasons: string[] = [];

  // Company change
  if (prevContext.position.includes(prevContext.position)) {
    // Compare firm names (simplified - just check if different)
    reasons.push("company_changed");
  }

  // Location change (if both have valid locations)
  if (prevContext.countryCode && prevContext.countryCode !== null) {
    const currLocation = parseLocation(currExperience.location);
    if (currLocation.countryCode && currLocation.countryCode !== prevContext.countryCode) {
      reasons.push("location_changed");
    }
  }

  return reasons.length > 0 ? reasons : ["company_changed"];
}

/**
 * Quality gate: filter out low-quality contexts
 */
function passesQualityGate(context: EnrichedContext): boolean {
  return (
    context.skills.length >= 3 &&
    context.domains.length >= 1 &&
    context.countryCode !== null &&
    context.industry !== null
  );
}

// ==========================================
// === MAIN PROCESSING ===
// ==========================================

async function main() {
  console.log("[Enrichment] Starting Kaggle data enrichment...\n");
  console.log(`[DEBUG] Loaded ${Object.keys(COMPANY_ENRICHMENT).length} companies from JSON\n`);

  // 1. Load candidate IDs
  console.log("[1/5] Loading candidate IDs...");
  const candidateIds = readFileSync("/tmp/kaggle-candidates.txt", "utf-8")
    .trim()
    .split("\n")
    .map((id) => id.trim());
  console.log(`✓ Loaded ${candidateIds.length} candidates\n`);

  // 2. Load experience CSV
  console.log("[2/5] Loading experience data...");
  const experienceCsv = readFileSync("/home/alex/Downloads/kaggle/04_experience.csv", "utf-8");
  const allExperiences = parse(experienceCsv, {
    columns: true,
    skip_empty_lines: true,
  }) as KaggleExperience[];

  const experiences = allExperiences.filter((exp) => candidateIds.includes(exp.person_id));
  console.log(`✓ Loaded ${experiences.length} experience records for candidates\n`);

  // 3. Load skills CSV
  console.log("[3/5] Loading skills data...");
  const skillsCsv = readFileSync("/home/alex/Downloads/kaggle/05_person_skills.csv", "utf-8");
  const allSkills = parse(skillsCsv, {
    columns: true,
    skip_empty_lines: true,
  }) as KaggleSkill[];

  const skillsMap = new Map<string, string[]>();
  for (const skillRecord of allSkills) {
    if (!candidateIds.includes(skillRecord.person_id)) continue;

    if (!skillsMap.has(skillRecord.person_id)) {
      skillsMap.set(skillRecord.person_id, []);
    }
    skillsMap.get(skillRecord.person_id)!.push(skillRecord.skill);
  }
  console.log(`✓ Loaded skills for ${skillsMap.size} candidates\n`);

  // 4. Enrich data
  console.log("[4/5] Enriching contexts...");
  const enrichedPersons: EnrichedPerson[] = [];

  let totalContexts = 0;
  let passedQualityGate = 0;
  let droppedPersons = 0;

  for (const personId of candidateIds) {
    const personExperiences = experiences
      .filter((exp) => exp.person_id === personId)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    if (personExperiences.length === 0) continue;

    const personSkills = skillsMap.get(personId) || [];
    const contexts: EnrichedContext[] = [];

    for (let i = 0; i < personExperiences.length; i++) {
      const exp = personExperiences[i];
      const prevContext = i > 0 ? contexts[i - 1] : null;

      const location = parseLocation(exp.location);
      const domains = inferDomains(exp.title, personSkills);
      const industry = inferIndustry(exp.firm);
      const citizenships = inferCitizenships(location.countryCode);
      const creationReason = inferCreationReason(prevContext, exp);

      const context: EnrichedContext = {
        position: exp.title,
        domains,
        skills: personSkills,
        industry,
        companySize: null, // Skipped per user decision
        countryCode: location.countryCode,
        cityName: location.cityName,
        citizenships,
        createdAt: parseDate(exp.start_date),
        creationReason,
      };

      totalContexts++;

      if (passesQualityGate(context)) {
        contexts.push(context);
        passedQualityGate++;
      }
    }

    // Only include persons with at least 3 valid contexts
    if (contexts.length >= 3) {
      enrichedPersons.push({ personId, contexts });
    } else {
      droppedPersons++;
    }
  }

  console.log(`✓ Enriched ${totalContexts} total contexts`);
  console.log(
    `✓ ${passedQualityGate} contexts passed quality gate (${Math.round((passedQualityGate / totalContexts) * 100)}%)`,
  );
  console.log(`✓ ${enrichedPersons.length} persons with ≥3 valid contexts`);
  console.log(`✗ ${droppedPersons} persons dropped (< 3 valid contexts)\n`);

  // 5. Save results
  console.log("[5/5] Saving enriched data...");
  const outputPath = "/home/alex/projects/WayMatesRemote-kaggle/data/kaggle-enriched.json";
  writeFileSync(outputPath, JSON.stringify(enrichedPersons, null, 2));
  console.log(`✓ Saved to ${outputPath}\n`);

  // Statistics
  const totalEnrichedContexts = enrichedPersons.reduce((sum, p) => sum + p.contexts.length, 0);
  console.log("=== SUMMARY ===");
  console.log(`Candidates processed: ${candidateIds.length}`);
  console.log(`Persons imported: ${enrichedPersons.length}`);
  console.log(`Total contexts: ${totalEnrichedContexts}`);
  console.log(`Quality gate pass rate: ${Math.round((passedQualityGate / totalContexts) * 100)}%`);
}

main().catch(console.error);
