import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

import { CONTEXT_FIELD_NAMES, contextFieldSchema, newContextReasonSchema } from "../../shared/schemas.js";
import { getModel } from "../langGraph/shared-tools/models.js";

import type { DictionariesCache } from "./dictionaries-cache.js";
import type {
  AdhocUserContext,
  FieldFilter,
  SimpleDictionaryType,
  TargetContext,
  UserContext,
  UserId,
} from "../../shared/schemas.js";
import type { CoreClient } from "../core-client.js";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";

const fuzzyMatchResultSchema = z.object({
  canonical: z.string().nullable().describe("Matched canonical name from dictionary, or null if no match"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence level of the match"),
  reasoning: z.string().describe("Brief explanation of the matching decision"),
});

export type FuzzyMatchResult = z.infer<typeof fuzzyMatchResultSchema>;

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
    private readonly cache: DictionariesCache,
    private readonly coreClient: CoreClient,
    private readonly fuzzyModel: FuzzyModel = defaultFuzzyModel,
  ) {}

  async normalizeAdhocContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext> {
    const [position, cityName, industry, skills, domains] = await Promise.all([
      this.normalizeOptionalTerm("position", context.position, userId),
      this.normalizeOptionalTerm("city", context.cityName, userId),
      this.normalizeOptionalTerm("industry", context.industry, userId),
      this.normalizeOptionalTerms("skill", context.skills, userId),
      this.normalizeOptionalTerms("domain", context.domains, userId),
    ]);

    return this.removeUndefinedFields({ position, cityName, industry, skills, domains });
  }

  async normalizeFullContext(context: UserContext, userId: UserId): Promise<UserContext> {
    const [position, cityName, industry, skills, domains] = await Promise.all([
      this.normalizeTerm("position", context.position, userId),
      this.normalizeTerm("city", context.cityName, userId),
      this.normalizeTerm("industry", context.industry, userId),
      this.normalizeTerms("skill", context.skills, userId),
      this.normalizeTerms("domain", context.domains, userId),
    ]);

    return { ...context, position, cityName, industry, skills, domains };
  }

  async normalizeTargetContext(context: TargetContext, userId: UserId): Promise<TargetContext> {
    const [position, skills, domains] = await Promise.all([
      this.normalizeTargetField("position", context.position, userId),
      this.normalizeTargetField("skill", context.skills, userId),
      this.normalizeTargetField("domain", context.domains, userId),
    ]);

    return this.removeUndefinedFields({ position, skills, domains });
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

    const dict = await this.cache.getReasons();
    const dictEntries = [...dict.values()].map((name) => `"${name}"`).join(", ");

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

  private async normalizeTargetField(
    type: SimpleDictionaryType,
    field: FieldFilter | undefined,
    userId: UserId,
  ): Promise<FieldFilter | undefined> {
    if (!field) return undefined;

    const values = await this.normalizeTerms(type, field.values, userId);
    return { mode: field.mode, values };
  }

  private async normalizeTerms(type: SimpleDictionaryType, values: string[], userId: UserId): Promise<string[]> {
    return Promise.all(values.map((v) => this.normalizeTerm(type, v, userId)));
  }

  private async normalizeOptionalTerm(
    type: SimpleDictionaryType,
    value: string | undefined,
    userId: UserId,
  ): Promise<string | undefined> {
    if (!value) return undefined;
    return this.normalizeTerm(type, value, userId);
  }

  private async normalizeOptionalTerms(
    type: SimpleDictionaryType,
    values: string[] | undefined,
    userId: UserId,
  ): Promise<string[] | undefined> {
    if (!values) return undefined;
    return this.normalizeTerms(type, values, userId);
  }

  private async normalizeTerm(type: SimpleDictionaryType, value: string, userId: UserId): Promise<string> {
    const dict = await this.cache.getSimple(type);
    const normalized = value.toLowerCase();

    // Step 1: Exact match
    const exact = dict.get(normalized);
    if (exact) return exact;

    // Step 2: Fuzzy match via LLM
    if (dict.size > 0) {
      const fuzzy = await this.invokeFuzzyModel(value, dict);
      if (fuzzy) return fuzzy;
    }

    // Step 3: Insert new term
    await this.coreClient.client.dictionaries.addTerm.mutate({
      type,
      canonicalName: normalized,
      complexity: null,
      verified: false,
      createdBy: userId,
    });

    return normalized;
  }

  private async invokeFuzzyModel(value: string, dict: Map<string, string>): Promise<string | null> {
    const dictEntries = [...dict.values()].map((name) => `"${name}"`).join(", ");
    const prompt = `You are a term normalization assistant for career data.

Dictionary: ${dictEntries}

Task: Find the canonical name for "${value}" from the dictionary above.
Rules:
- Handle typos (e.g., "Pyton" → "python")
- Handle translation (e.g., "питон" → "python")
- Handle case variations (e.g., "PYTHON" → "python")
- If no good match (similarity < 0.7), return null
- NO hallucinations - only use provided dictionary`;

    const result = await this.fuzzyModel.invoke([new HumanMessage(prompt)]);

    if (!result.canonical) return null;

    return dict.get(result.canonical.toLowerCase()) ?? null;
  }

  private removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Object.fromEntries loses type information, cast to original type is safe here
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;
  }
}
