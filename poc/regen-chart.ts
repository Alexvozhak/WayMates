import fs from "node:fs";
import { transformToTrajectories } from "../src/chart/services/data-transformer.js";
import { calculateAllOverlapSummaries, calculateSimilarity } from "../src/chart/services/overlap-calculator.js";
import { generateChartHtmlV2 } from "../src/chart/templates/chart-html-v2.js";
import { DEFAULT_FIELDS } from "../src/chart/config/aspect-configs.js";

import type { ScoredMatchedCandidate, UserContext } from "../src/shared/schemas.js";
import type { ChartPageDataV2 } from "../src/chart/templates/chart-html-v2.js";

// Create demo fixtures inline
const userContexts: UserContext[] = [
  {
    contextId: "u1",
    createdAt: "2023-01-15T00:00:00Z",
    position: "junior",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "u2",
    createdAt: "2023-07-01T00:00:00Z",
    position: "middle",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "u3",
    createdAt: "2024-01-15T00:00:00Z",
    position: "senior",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
];

const cand1Contexts: UserContext[] = [
  {
    contextId: "c1-1",
    createdAt: "2023-02-15T00:00:00Z",
    position: "junior",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "c1-2",
    createdAt: "2023-08-01T00:00:00Z",
    position: "middle",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "c1-3",
    createdAt: "2024-02-01T00:00:00Z",
    position: "senior",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "c1-4",
    createdAt: "2024-09-01T00:00:00Z",
    position: "lead",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["react"],
    companySize: "startup",
    countryCode: "de",
  },
];

const cand2Contexts: UserContext[] = [
  {
    contextId: "c2-1",
    createdAt: "2023-03-01T00:00:00Z",
    position: "junior",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["vue"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "c2-2",
    createdAt: "2023-09-15T00:00:00Z",
    position: "middle",
    domains: ["frontend"],
    cityName: "berlin",
    industry: "tech",
    skills: ["vue"],
    companySize: "startup",
    countryCode: "de",
  },
  {
    contextId: "c2-3",
    createdAt: "2024-03-15T00:00:00Z",
    position: "senior",
    domains: ["frontend"],
    cityName: "munich",
    industry: "tech",
    skills: ["vue"],
    companySize: "enterprise",
    countryCode: "de",
  },
];

const candidates: ScoredMatchedCandidate[] = [
  {
    userId: "cand1",
    matchedContext: cand1Contexts[2]!,
    timeSinceMatchedMonths: 6,
    contextMatchScore: 92,
    candidateType: "pathfinder",
    path: cand1Contexts,
    dtwMetrics: { shapeSimilarity: 0.95, tempoSimilarity: 0.88, stabilityScore: 0.91 },
    dtwTotal: 2.74,
  },
  {
    userId: "cand2",
    matchedContext: cand2Contexts[2]!,
    timeSinceMatchedMonths: 3,
    contextMatchScore: 78,
    candidateType: "waymate",
    path: cand2Contexts,
    dtwMetrics: { shapeSimilarity: 0.82, tempoSimilarity: 0.75, stabilityScore: 0.68 },
    dtwTotal: 2.25,
  },
];

const trajectories = transformToTrajectories(userContexts, candidates, "en", true);
const metrics = candidates.map((c, i) => calculateSimilarity(trajectories[i + 1]!, c));
const overlapSummaries = calculateAllOverlapSummaries(trajectories[0]!, trajectories.slice(1), DEFAULT_FIELDS);
const allTimestamps = trajectories.flatMap((t) => t.points.map((p) => p.timestamp));
const timeRange = { minTime: Math.min(...allTimestamps), maxTime: Math.max(...allTimestamps) };

const chartData: ChartPageDataV2 = {
  trajectories,
  fields: DEFAULT_FIELDS,
  selectedFields: DEFAULT_FIELDS,
  metrics,
  overlapSummaries,
  timeRange,
  locale: "en",
};

const html = generateChartHtmlV2(chartData);
fs.writeFileSync("poc/chart-output-v2.html", html);
console.log("Generated: poc/chart-output-v2.html (" + (html.length / 1024).toFixed(1) + " KB)");
