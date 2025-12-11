import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

import {
  adhocUserContextSchema,
  contextFieldSchema,
  fieldFilterSchema,
  makeNullable,
  newContextReasonSchema,
  targetContextSchema,
} from "../../shared/schemas.js";
import { NlpParseError } from "../errors.js";

import type { TargetContext } from "../../shared/schemas.js";
import type { ZodObject, ZodRawShape } from "zod";

export type TargetNlpResult = z.infer<typeof targetNlpSchema>;
export type AdhocNlpResult = z.infer<typeof adhocNlpSchema>;
export type CurrentNlpResult = z.infer<typeof currentNlpSchema>;

const targetNlpSchema = z.object({
  targetContext: z
    .object({
      position: fieldFilterSchema.optional(),
      countries: fieldFilterSchema.optional(),
      domains: fieldFilterSchema.optional(),
      skills: fieldFilterSchema.optional(),
      languages: fieldFilterSchema.optional(),
    })
    .optional(),
  excludedCreationReasons: z.array(newContextReasonSchema).optional(),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const adhocNlpSchema = z.object({
  referenceContext: adhocUserContextSchema.optional(),
  excludedContextFields: z.array(contextFieldSchema).optional(),
  excludedCreationReasons: z.array(newContextReasonSchema).optional(),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  pathLimit: z.number().min(1).max(100).optional(),
});

const currentNlpSchema = z.object({
  excludedContextFields: z.array(contextFieldSchema).optional(),
  excludedCreationReasons: z.array(newContextReasonSchema).optional(),
  recencyThresholdMonths: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  pathLimit: z.number().min(1).max(100).optional(),
});

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function processValue(value: unknown): unknown {
  if (value == null) {
    return undefined;
  }
  // Remove empty strings — LLM sometimes returns "" instead of null
  if (value === "") {
    return undefined;
  }
  if (isNonNullObject(value)) {
    const cleaned = removeNullFields(value);
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return value;
}

function removeNullFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const processed = processValue(value);
    if (processed !== undefined) {
      result[key] = processed;
    }
  }
  return result;
}

async function invokeLlmStructured<T extends ZodObject<ZodRawShape>>(
  apiKey: string,
  baseUrl: string | undefined,
  schema: T,
  prompt: string,
  options?: { allowEmpty?: boolean },
): Promise<z.infer<T>> {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: apiKey,
    ...(baseUrl && { configuration: { baseURL: baseUrl } }),
  });
  const nullableSchema = makeNullable(schema);
  const structuredLlm = llm.withStructuredOutput(nullableSchema);

  const result = await structuredLlm.invoke(prompt);
  const cleaned = removeNullFields(result);

  if (Object.keys(cleaned).length === 0 && !options?.allowEmpty) {
    throw new NlpParseError("LLM returned empty result after cleaning null fields");
  }

  return schema.parse(cleaned);
}

export async function parseTargetQuery(apiKey: string, query: string, baseUrl?: string): Promise<TargetNlpResult> {
  const prompt = `Extract target job search parameters from user query.

Return JSON with nested structure:
- targetContext: object with position/countries/domains/skills/languages
  Each field is: { mode: "desired" | "undesired", values: ["value1", "value2"] } or null
  Use "undesired" only for explicit exclusions ("except", "not", "excluding")
  Countries/Languages: ISO codes (RU, US / en, ru)
- excludedCreationReasons: array or null, e.g. "except layoffs" → ["fired"]
- recencyThresholdMonths: number or null, e.g. "last year" → 12
- limit: number or null, e.g. "top 5" → 5

Query: ${query}`;

  const result = await invokeLlmStructured(apiKey, baseUrl, targetNlpSchema, prompt);

  if (!result.targetContext) {
    throw new NlpParseError("Could not recognize search criteria. Please specify position, country, skills or domain.");
  }

  if (Object.keys(result.targetContext).length === 0) {
    throw new NlpParseError("Could not recognize search criteria. Please specify position, country, skills or domain.");
  }

  return result;
}

export async function parseAdhocQuery(apiKey: string, query: string, baseUrl?: string): Promise<AdhocNlpResult> {
  const prompt = `Extract career search parameters from user description.

Return JSON with:
- referenceContext: object with user's career context fields:
  position, skills (array), domains (array), industry, countryCode (ISO), cityName,
  companySize, birthYear, educationLevel, languages (array of ISO codes),
  citizenships (array), salaryExact/salaryMin/salaryMax
  Return only fields mentioned by user (null for missing)
- excludedContextFields: array of fields to exclude or null
- excludedCreationReasons: array of reasons to exclude or null
- recencyThresholdMonths: number or null
- limit: number or null
- pathLimit: number or null

Query: ${query}`;

  const result = await invokeLlmStructured(apiKey, baseUrl, adhocNlpSchema, prompt);

  if (!result.referenceContext) {
    throw new NlpParseError("Could not recognize profile for search. Please specify position, skills or experience.");
  }

  if (Object.keys(result.referenceContext).length === 0) {
    throw new NlpParseError("Could not recognize profile for search. Please specify position, skills or experience.");
  }

  return result;
}

export async function parseCurrentQuery(apiKey: string, query: string, baseUrl?: string): Promise<CurrentNlpResult> {
  const prompt = `Extract search filter parameters from user query for searching careers based on user's current context (context fetched from DB automatically).

Return JSON with:
- excludedContextFields: array of fields to exclude from comparison or null
  Valid values: "position", "skills", "domains", "industry", "countryCode", "cityName",
  "companySize", "birthYear", "educationLevel", "languages", "citizenships",
  "salaryExact", "salaryMin", "salaryMax"
  WARNING: Cannot exclude "skills" (required for ranking)
- excludedCreationReasons: array of reasons to exclude or null
  Valid values: "promotion", "fired", "changed_company", "changed_role", "sabbatical"
- recencyThresholdMonths: number or null (e.g., "last 2 years" → 24)
- limit: number or null (e.g., "top 10" → 10, max 100)
- pathLimit: number or null (final result limit after trajectory analysis, max 100)

Query: ${query}`;

  return invokeLlmStructured(apiKey, baseUrl, currentNlpSchema, prompt, { allowEmpty: true });
}

export async function parseGoalQuery(apiKey: string, query: string, baseUrl?: string): Promise<TargetContext> {
  const prompt = `Extract target career goal from user message.

Return JSON with targetContext fields:
- position: { mode: "desired", values: ["position name"] } or null
- countries: { mode: "desired", values: ["RU", "US"] } or null (ISO codes)
- domains: { mode: "desired", values: ["domain1", "domain2"] } or null
- skills: { mode: "desired", values: ["skill1", "skill2"] } or null
- languages: { mode: "desired", values: ["en", "ru"] } or null (ISO codes)

Examples:
- "Хочу стать Senior Backend в финтехе" → position: {mode:"desired", values:["Senior Backend Developer"]}, domains: {mode:"desired", values:["финтех"]}
- "Want to work in US with Python" → countries: {mode:"desired", values:["US"]}, skills: {mode:"desired", values:["Python"]}

Query: ${query}`;

  const result = await invokeLlmStructured(apiKey, baseUrl, targetContextSchema, prompt);

  if (Object.keys(result).length === 0) {
    throw new NlpParseError("Could not recognize career goal. Please specify position, location, skills or domain.");
  }

  return result;
}
