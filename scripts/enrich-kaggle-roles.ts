#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "node:fs";

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
  role?: string;
};

type EnrichedPerson = {
  personId: string;
  contexts: EnrichedContext[];
};

const KNOWN_ROLES = [
  "developer",
  "qa",
  "devops",
  "sysadmin",
  "analyst",
  "data-engineer",
  "data-scientist",
  "architect",
  "secops",
  "designer",
  "dba",
] as const;

type Role = (typeof KNOWN_ROLES)[number];

function inferRole(position: string): Role {
  const pos = position.toLowerCase();

  // DBA - database administrators
  if (
    pos.includes("dba") ||
    pos.includes("database admin") ||
    pos.includes("database performance admin") ||
    (pos.includes("database") && pos.includes("manager"))
  ) {
    return "dba";
  }

  // QA - testers, quality
  if (
    pos.includes("qa") ||
    pos.includes("quality") ||
    pos.includes("tester") ||
    pos.includes("testing") ||
    pos.includes("test engineer")
  ) {
    return "qa";
  }

  // DevOps / SRE
  if (
    pos.includes("devops") ||
    pos.includes("sre") ||
    pos.includes("site reliability") ||
    pos.includes("platform engineer") ||
    pos.includes("release engineer")
  ) {
    return "devops";
  }

  // Sysadmin - network, infrastructure, support engineers
  if (
    pos.includes("sysadmin") ||
    pos.includes("system admin") ||
    pos.includes("systems admin") ||
    pos.includes("network admin") ||
    pos.includes("network engineer") ||
    pos.includes("network tech") ||
    pos.includes("lan engineer") ||
    pos.includes("systems engineer") ||
    pos.includes("system engineer") ||
    pos.includes("infrastructure") ||
    pos.includes("it admin") ||
    pos.includes("help desk") ||
    pos.includes("desktop support") ||
    pos.includes("technical support") ||
    pos.includes("support engineer") ||
    pos.includes("support tech") ||
    pos.includes("field tech") ||
    pos.includes("it specialist") ||
    pos.includes("computer operator") ||
    pos.includes("onsite tech") ||
    pos.includes("install tech") ||
    pos.includes("premise tech")
  ) {
    return "sysadmin";
  }

  // Security
  if (
    pos.includes("security") ||
    pos.includes("infosec") ||
    pos.includes("cybersec") ||
    pos.includes("information assurance") ||
    pos.includes("incident responder")
  ) {
    return "secops";
  }

  // Data Scientist / ML
  if (
    pos.includes("data scientist") ||
    pos.includes("machine learn") ||
    pos.includes("ml engineer") ||
    pos.includes("ai engineer")
  ) {
    return "data-scientist";
  }

  // Data Engineer / ETL / BI
  if (
    pos.includes("data engineer") ||
    pos.includes("etl") ||
    pos.includes("data pipeline") ||
    pos.includes("business intelligence") ||
    pos.includes("bi lead") ||
    pos.includes("bi developer") ||
    pos.includes("warehouse") ||
    pos.includes("data specialist")
  ) {
    return "data-engineer";
  }

  // Architect
  if (pos.includes("architect") && !pos.includes("software architect")) {
    return "architect";
  }

  // Analyst
  if (pos.includes("analyst") && !pos.includes("developer")) {
    return "analyst";
  }

  // Designer
  if (pos.includes("designer") || pos.includes("ux ") || pos.includes("ui design") || pos.includes("web design")) {
    return "designer";
  }

  // Database Developer / SQL Developer → data-engineer (they write code/queries)
  if (
    pos.includes("database developer") ||
    pos.includes("database engineer") ||
    pos.includes("database application") ||
    pos.includes("sql developer") ||
    pos.includes("sql server developer") ||
    pos.includes("ssrs developer") ||
    pos.includes("ssis developer") ||
    pos.includes("ssas developer") ||
    pos.includes("database consultant")
  ) {
    return "data-engineer";
  }

  // QA - additional patterns
  if (pos === "qe" || pos.includes("software development engineer in test")) {
    return "qa";
  }

  // Sysadmin - additional patterns (technicians, network specialists, support)
  if (
    pos.includes("technician") ||
    pos.includes("network specialist") ||
    pos.includes("network consultant") ||
    pos.includes("network design") ||
    pos.includes("information technology specialist") ||
    pos.includes("support services specialist") ||
    pos.includes("systems information specialist") ||
    pos.includes("level 3 engineer") ||
    pos.includes("l3 engineer") ||
    pos.includes("desktop enterprise support")
  ) {
    return "sysadmin";
  }

  // Default: developer (programmers, software engineers, web developers, etc.)
  return "developer";
}

function main() {
  console.log("[Enrich] Adding roles to Kaggle data...\n");

  const data: EnrichedPerson[] = JSON.parse(readFileSync("data/kaggle-enriched.json", "utf-8"));

  const stats: Record<string, number> = {};
  let totalContexts = 0;

  for (const person of data) {
    for (const ctx of person.contexts) {
      const role = inferRole(ctx.position);
      ctx.role = role;
      stats[role] = (stats[role] || 0) + 1;
      totalContexts++;
    }
  }

  writeFileSync("data/kaggle-enriched.json", JSON.stringify(data, null, 2));

  console.log(`✅ Enriched ${totalContexts} contexts\n`);
  console.log("Role distribution:");
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([role, count]) => {
      const pct = ((count / totalContexts) * 100).toFixed(1);
      console.log(`  ${role}: ${count} (${pct}%)`);
    });
}

main();
