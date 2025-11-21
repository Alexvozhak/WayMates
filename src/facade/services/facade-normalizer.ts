import type { DictionariesCache } from "./dictionaries-cache.js";
import type { LLMFuzzyMatcher } from "./llm-fuzzy-matcher.js";
import type {
  AdhocUserContext,
  SimpleDictionaryType,
  TargetContext,
  UserId,
} from "../../shared/schemas.js";
import type { CoreTRPCClient } from "../core-client/core-trpc-client.js";

export class FacadeNormalizer {
  constructor(
    private readonly cache: DictionariesCache,
    private readonly coreClient: CoreTRPCClient,
    private readonly llm: LLMFuzzyMatcher,
  ) {}

  // eslint-disable-next-line complexity
  async normalizeUserContext(context: AdhocUserContext, userId: UserId): Promise<AdhocUserContext> {
    const normalized: AdhocUserContext = {};

    const [position, cityName, industry] = await Promise.all([
      context.position ? this.normalizeTerm("position", context.position, userId) : undefined,
      context.cityName ? this.normalizeTerm("city", context.cityName, userId) : undefined,
      context.industry ? this.normalizeTerm("industry", context.industry, userId) : undefined,
    ]);

    if (position) normalized.position = position;
    if (cityName) normalized.cityName = cityName;
    if (industry) normalized.industry = industry;

    if (context.skills) {
      normalized.skills = await this.normalizeTerms("skill", context.skills, userId);
    }
    if (context.domains) {
      normalized.domains = await this.normalizeTerms("domain", context.domains, userId);
    }

    return normalized;
  }

  async normalizeTargetContext(context: TargetContext, userId: UserId): Promise<TargetContext> {
    const normalized: TargetContext = { ...context };

    if (context.position) {
      const normalizedValues = await this.normalizeTerms(
        "position",
        context.position.values,
        userId,
      );
      normalized.position = { mode: context.position.mode, values: normalizedValues };
    }
    if (context.skills) {
      const normalizedValues = await this.normalizeTerms("skill", context.skills.values, userId);
      normalized.skills = { mode: context.skills.mode, values: normalizedValues };
    }
    if (context.domains) {
      const normalizedValues = await this.normalizeTerms("domain", context.domains.values, userId);
      normalized.domains = { mode: context.domains.mode, values: normalizedValues };
    }

    return normalized;
  }

  /**
   * 2-tier normalization: exact match → fuzzy match (LLM) → create unverified term
   * New skills created with complexity=null (admin verifies asynchronously)
   */
  private async normalizeTerm(
    type: SimpleDictionaryType,
    value: string,
    userId: UserId,
  ): Promise<string> {
    const dict = await this.cache.getSimple(type);

    const exact = dict.get(value.toLowerCase());
    if (exact) {
      return exact;
    }

    const fuzzy = await this.llm.fuzzyMatch(type, value, dict);
    if (fuzzy) {
      return fuzzy;
    }

    await this.coreClient.client.dictionaries.addTerm.mutate({
      type,
      canonicalName: value,
      complexity: type === "skill" ? null : undefined,
      verified: false,
      createdBy: userId,
    });

    return value;
  }

  private async normalizeTerms(
    type: SimpleDictionaryType,
    values: string[],
    userId: UserId,
  ): Promise<string[]> {
    return Promise.all(values.map((v) => this.normalizeTerm(type, v, userId)));
  }
}
