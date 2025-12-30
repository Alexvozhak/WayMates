import { buildPathfinderSearchQuery } from "../src/cypher/queries/search.js";
import { CONTEXT_FIELD_NAMES, type ContextField, type PathfinderSearchParams } from "../src/shared/schemas.js";

function computeStrictFields(excludedFields: ContextField[]): ContextField[] {
  return CONTEXT_FIELD_NAMES.filter(
    (field): field is ContextField => field !== "skills" && !excludedFields.includes(field),
  );
}

const params: PathfinderSearchParams = {
  userId: "test-user",
  referenceContext: {
    position: "middle",
    role: "developer",
    domains: ["backend"],
    industry: "energy",
    countryCode: "US",
    skills: [],
    languages: [],
    citizenships: [],
    birthYear: null,
    companySize: null,
    cityName: null,
    educationLevel: null,
  },
  targetContext: {
    position: { mode: "desired", values: ["senior"] },
    role: { mode: "desired", values: ["developer"] },
    domains: null,
    skills: null,
    countries: null,
    languages: null,
    industries: null,
    cities: null,
    citizenships: null,
    educationLevels: null,
  },
  userTrajectory: undefined,
  excludedContextFields: [],
  excludedCreationReasons: [],
  referenceRecencyMonths: null,
  targetRecencyMonths: null,
  limit: 100,
  pathLimit: 20,
};

const strictFields = computeStrictFields(params.excludedContextFields);
const query = buildPathfinderSearchQuery(params, strictFields);

console.log("=== GENERATED QUERY ===");
console.log(query);
console.log("\n=== STRICT FIELDS ===");
console.log(strictFields);
