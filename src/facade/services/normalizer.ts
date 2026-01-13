import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

import {
  CONTEXT_FIELD_NAMES,
  contextFieldSchema,
  isClosedDictionary,
  newContextReasonSchema,
} from "../../../private/schemas.js";
import { getModel } from "../langGraph/shared-tools/models.js";
import { logger } from "../logger.js";
import { withReasoning } from "../utils/llm-schemas.js";

import type { DictionaryCache } from "./dictionaries-cache.js";
import type {
  AdhocContextBase,
  ClosedDictionaryType,
  DictionaryEntry,
  FieldFilter,
  SimpleDictionaryType,
  TargetContext,
  UserContext,
  UserId,
} from "../../../private/schemas.js";
import type { CoreClient } from "../core-client.js";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";

const fuzzyMatchBaseSchema = z.object({
  canonical: z.string().nullable().describe("Best matched canonical name from dictionary, or null if no match"),
  suggestions: z.array(z.string()).max(3).describe("Up to 3 closest matches from dictionary, ordered by relevance"),
});

const fuzzyMatchResultSchema = withReasoning(fuzzyMatchBaseSchema, "Step-by-step semantic analysis");
export type FuzzyMatchResult = z.infer<typeof fuzzyMatchResultSchema>;

// === Normalization Result Types ===
type NormalizeSuccess = { status: "success"; value: string };
type NormalizeSuggestions = {
  status: "suggestions";
  field: ClosedDictionaryType;
  original: string;
  suggestions: string[];
};
export type NormalizeResult = NormalizeSuccess | NormalizeSuggestions;

// Narrowed for cold-start: only role/position (not education_level)
export type RolePositionSuggestion = NormalizeSuggestions & { field: "role" | "position" };

const normalizeReasonsResultSchema = z.object({
  normalized: z.array(newContextReasonSchema).describe("Array of matched canonical reason IDs from dictionary"),
  rejected: z.array(z.string()).describe("Array of user inputs that couldn't be matched"),
});

const normalizeContextFieldsResultSchema = z.object({
  normalized: z.array(contextFieldSchema).describe("Array of matched canonical context field names from enum"),
  rejected: z.array(z.string()).describe("Array of user inputs that couldn't be matched"),
});

export type NormalizeReasonsResult = z.infer<typeof normalizeReasonsResultSchema>;
export type NormalizeContextFieldsResult = z.infer<typeof normalizeContextFieldsResultSchema>;

export type FuzzyModel = Runnable<BaseMessageLike[], FuzzyMatchResult>;

const defaultFuzzyModel: FuzzyModel = getModel("deterministic").withStructuredOutput(fuzzyMatchResultSchema);

export class Normalizer {
  constructor(
    private readonly dictionaryCache: DictionaryCache,
    private readonly coreClient: CoreClient,
    private readonly fuzzyModel: FuzzyModel = defaultFuzzyModel,
  ) {}

  /**
   * Normalize adhoc context by filtering to known dictionary values.
   * Does NOT add new terms — adhoc is for search, not profile creation.
   */
  async normalizeAdhocContext(context: AdhocContextBase, _userId: UserId): Promise<AdhocContextBase> {
    const [role, position, cityName, industry, skills, domains, educationLevel] = await Promise.all([
      this.filterToKnown("role", context.role),
      this.filterToKnown("position", context.position),
      this.filterToKnown("city", context.cityName),
      this.filterToKnown("industry", context.industry),
      this.filterArrayToKnown("skill", context.skills),
      this.filterArrayToKnown("domain", context.domains),
      this.filterToKnown("education_level", context.educationLevel),
    ]);

    return this.removeNullishFields({
      ...context,
      role,
      position,
      cityName,
      industry,
      skills,
      domains,
      educationLevel,
      countryCode: context.countryCode?.toUpperCase() ?? null,
      citizenships: context.citizenships?.map((c) => c.toUpperCase()) ?? null,
    });
  }

  async normalizeFullContext(context: UserContext, userId: UserId): Promise<UserContext> {
    const [role, position, cityName, industry, skills, domains, educationLevel] = await Promise.all([
      this.normalizeTerm("role", context.role, userId),
      this.normalizeTerm("position", context.position, userId),
      this.normalizeTerm("city", context.cityName, userId),
      this.normalizeTerm("industry", context.industry, userId),
      this.normalizeTerms("skill", context.skills, userId),
      this.normalizeTerms("domain", context.domains, userId),
      this.normalizeOptionalTerm("education_level", context.educationLevel, userId),
    ]);

    return {
      ...context,
      role,
      position,
      cityName,
      industry,
      skills,
      domains,
      educationLevel,
      countryCode: context.countryCode.toUpperCase(),
      citizenships: context.citizenships.map((c) => c.toUpperCase()),
    };
  }

  async normalizeTargetContext(context: TargetContext, userId: UserId): Promise<TargetContext> {
    const [role, position, skills, domains, industries, cities, educationLevels] = await Promise.all([
      this.normalizeTargetField("role", context.role, userId),
      this.normalizeTargetField("position", context.position, userId),
      this.normalizeTargetField("skill", context.skills, userId),
      this.normalizeTargetField("domain", context.domains, userId),
      this.normalizeTargetField("industry", context.industries, userId),
      this.normalizeTargetField("city", context.cities, userId),
      this.normalizeTargetField("education_level", context.educationLevels, userId),
    ]);

    return {
      role,
      position,
      skills,
      domains,
      industries,
      cities,
      educationLevels,
      languages: context.languages ?? null,
      countries: context.countries ?? null,
      citizenships: context.citizenships ?? null,
      salaryMin: context.salaryMin || null,
      salaryMax: context.salaryMax || null,
    };
  }

  async normalizeSkill(skill: string, userId: UserId): Promise<string> {
    return this.normalizeTerm("skill", skill, userId);
  }

  async normalizePlatform(platform: string, userId: UserId): Promise<string> {
    return this.normalizeTerm("platform", platform, userId);
  }

  async normalizeReasons(userInput: string[]): Promise<NormalizeReasonsResult> {
    if (userInput.length === 0) {
      return { normalized: [], rejected: [] };
    }

    const reasons = await this.dictionaryCache.getReasons();
    const dictEntries = reasons.map((r) => `"${r.canonicalName}"`).join(", ");

    const prompt = `You are a term normalization assistant for career transition reasons.

Dictionary: ${dictEntries}

Task: Normalize the following user inputs to canonical reason IDs from the dictionary above.
User inputs: ${JSON.stringify(userInput)}

Rules:
- Handle typos (e.g., "company chnage" → "company_changed")
- Handle natural language (e.g., "job changes" → "position_changed")
- Handle case variations (e.g., "COMPANY_CHANGED" → "company_changed")
- Return matched canonical IDs in "normalized" array
- Return unmatched user inputs in "rejected" array (if similarity < 0.7)
- NO hallucinations - only use provided dictionary

Return: { normalized: string[], rejected: string[] }`;

    const reasonsModel = getModel("deterministic").withStructuredOutput(normalizeReasonsResultSchema);
    const result = await reasonsModel.invoke([new HumanMessage(prompt)]);

    return result;
  }

  async normalizeContextFields(userInput: string[]): Promise<NormalizeContextFieldsResult> {
    if (userInput.length === 0) {
      return { normalized: [], rejected: [] };
    }

    const validFields = CONTEXT_FIELD_NAMES.map((f) => `"${f}"`).join(", ");

    const prompt = `You are a term normalization assistant for context field names.

Valid fields: ${validFields}

Task: Normalize the following user inputs to canonical context field names from the list above.
User inputs: ${JSON.stringify(userInput)}

Rules:
- Handle typos (e.g., "skilss" → "skills")
- Handle natural language (e.g., "birth year" → "birthYear", "country" → "countryCode")
- Handle case variations (e.g., "POSITION" → "position")
- Return matched canonical names in "normalized" array
- Return unmatched user inputs in "rejected" array (if similarity < 0.7)
- NO hallucinations - only use provided valid fields

Return: { normalized: string[], rejected: string[] }`;

    const fieldsModel = getModel("deterministic").withStructuredOutput(normalizeContextFieldsResultSchema);
    const result = await fieldsModel.invoke([new HumanMessage(prompt)]);

    return result;
  }

  /**
   * Normalize term with suggestions support for closed dictionaries.
   * - Closed (role, position, education_level): returns suggestions if no match
   * - Open (skill, domain, etc.): inserts new term if no match
   */
  async normalizeTermWithResult(type: SimpleDictionaryType, value: string, userId: UserId): Promise<NormalizeResult> {
    const dict = await this.dictionaryCache.getSimple(type);
    const normalized = value.toLowerCase();

    // Step 1: Exact match
    const exact = dict.get(normalized);
    if (exact) return { status: "success", value: exact.canonicalName };

    // Step 2: Fuzzy match via LLM
    const fuzzyResult = await this.invokeFuzzyModel(value, dict, type);

    if (fuzzyResult.canonical) {
      return { status: "success", value: fuzzyResult.canonical };
    }

    // Step 3: Closed dictionary — return suggestions, do NOT insert
    if (isClosedDictionary(type)) {
      return { status: "suggestions", field: type, suggestions: fuzzyResult.suggestions, original: value };
    }

    // Step 4: Open dictionary — insert new term
    await this.coreClient.client.dictionaries.addTerm.mutate({
      type,
      canonicalName: normalized,
      complexity: null,
      verified: false,
      createdBy: userId,
    });

    return { status: "success", value: normalized };
  }

  /**
   * Filter term to known value from dictionary.
   * Unlike normalizeTerm, does NOT add new terms — only matches existing.
   */
  private async filterToKnown(type: SimpleDictionaryType, value: string | null): Promise<string | null> {
    if (!value) return null;

    const dict = await this.dictionaryCache.getSimple(type);
    const normalized = value.toLowerCase();

    const exact = dict.get(normalized);
    return exact?.canonicalName ?? null;
  }

  /**
   * Filter terms array to only known values from dictionary.
   * Unlike normalizeTerms, does NOT add new terms — only filters.
   */
  private async filterArrayToKnown(type: SimpleDictionaryType, values: string[] | null): Promise<string[] | null> {
    if (!values || values.length === 0) return null;

    const dict = await this.dictionaryCache.getSimple(type);
    const known = values
      .map((v) => dict.get(v.toLowerCase())?.canonicalName)
      .filter((v): v is string => v !== undefined);

    return known.length > 0 ? known : null;
  }

  private async normalizeTargetField(
    type: SimpleDictionaryType,
    field: FieldFilter | string | string[] | null | undefined,
    userId: UserId,
  ): Promise<FieldFilter | null> {
    if (!field) return null;

    // Convert simple values to FieldFilter format
    const normalized = this.toFieldFilter(field);
    if (!normalized) return null;

    const values = await this.normalizeTerms(type, normalized.values, userId);
    return { mode: normalized.mode, values };
  }

  private toFieldFilter(field: FieldFilter | string | string[]): FieldFilter | null {
    if (typeof field === "string") {
      return { mode: "desired", values: [field] };
    }
    if (Array.isArray(field)) {
      return field.length > 0 ? { mode: "desired", values: field } : null;
    }
    if (field && typeof field === "object" && "mode" in field && "values" in field) {
      return field;
    }
    return null;
  }

  private async normalizeTerms(type: SimpleDictionaryType, values: string[], userId: UserId): Promise<string[]> {
    return Promise.all(values.map((v) => this.normalizeTerm(type, v, userId)));
  }

  private async normalizeOptionalTerm(
    type: SimpleDictionaryType,
    value: string | null | undefined,
    userId: UserId,
  ): Promise<string | null> {
    if (!value) return null;
    return this.normalizeTerm(type, value, userId);
  }

  private async normalizeTerm(type: SimpleDictionaryType, value: string, userId: UserId): Promise<string> {
    const result = await this.normalizeTermWithResult(type, value, userId);
    return result.status === "success" ? result.value : result.original.toLowerCase();
  }

  private async invokeFuzzyModel(
    value: string,
    dict: Map<string, DictionaryEntry>,
    type: SimpleDictionaryType,
  ): Promise<{ canonical: string | null; suggestions: string[] }> {
    const dictEntries = [...dict.values()].map((e) => `"${e.canonicalName}"`).join(", ");

    const typeHint = isClosedDictionary(type) ? this.getClosedDictionaryHint(type) : "";

    const prompt = `You are a term normalization assistant for career data.

Dictionary: ${dictEntries}

Task: Find the canonical name for "${value}" from the dictionary above.
${typeHint}
Rules:
- Handle typos, translations, synonyms, and case variations
- Return up to 3 closest matches in "suggestions" ordered by relevance
- Set canonical to the best SEMANTIC match, or null if no match
- ONLY use values from provided dictionary

In reasoning: analyze "${value}" ONLY against the ${type} dictionary above.
For each candidate: semantic relationship + match confidence.
If canonical=null: what synonym would enable the match?`;

    const result = await this.fuzzyModel.invoke([new HumanMessage(prompt)]);
    logger.info(
      {
        value,
        type,
        dictEntries,
        reasoning: result.reasoning,
        canonical: result.canonical,
        suggestions: result.suggestions,
      },
      "fuzzy match result",
    );

    const validSuggestions = result.suggestions
      .map((s) => dict.get(s.toLowerCase())?.canonicalName)
      .filter((s): s is string => s !== undefined);

    return {
      canonical: result.canonical ? (dict.get(result.canonical.toLowerCase())?.canonicalName ?? null) : null,
      suggestions: validSuggestions,
    };
  }

  private getClosedDictionaryHint(type: ClosedDictionaryType): string {
    switch (type) {
      case "position": {
        return `
IMPORTANT: "position" = CAREER PROGRESSION LEVEL (career stage), NOT job title.
Consider what career stage the input term implies and find semantic equivalent in dictionary.`;
      }
      case "role": {
        return `
IMPORTANT: "role" = PROFESSIONAL SPECIALIZATION (what the person does).
Job titles should map to the core profession type.`;
      }
    }
  }

  private removeNullishFields<T extends Record<string, unknown>>(obj: T): T {
    // Remove null, undefined, empty strings, and LLM's string representations of null
    // LLM sometimes returns "", "/null", "null", "/NULL" instead of proper null
    // eslint-disable-next-line unicorn/consistent-function-scoping -- intentionally scoped for readability
    const isNullish = (v: unknown): boolean => {
      if (v == null || v === "") return true;
      if (typeof v === "string") {
        const normalized = v.toLowerCase().trim();
        return normalized === "null" || normalized === "/null";
      }
      return false;
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.fromEntries loses type information, cast to original type is safe here
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => !isNullish(v))) as T;
  }
}
