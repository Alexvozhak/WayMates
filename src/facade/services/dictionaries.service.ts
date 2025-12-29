import { config } from "../env.js";

import type { DictionaryCache } from "./dictionaries-cache.js";
import type { DictionaryEntry, DictionaryType, SimpleDictionaryType } from "../../shared/schemas.js";

const DICTIONARY_LABELS: Record<SimpleDictionaryType, string> = {
  skill: "SKILLS",
  domain: "DOMAINS",
  role: "ROLES",
  position: "POSITIONS",
  industry: "INDUSTRIES",
  city: "CITIES",
  platform: "PLATFORMS",
  language: "LANGUAGES",
  education_level: "EDUCATION_LEVELS",
};

export class DictionariesService {
  private readonly maxSkills: number;

  constructor(private readonly cache: DictionaryCache) {
    this.maxSkills = config.DICT_HINTS_MAX_SKILLS;
  }

  getSimple(type: SimpleDictionaryType): Promise<Map<string, DictionaryEntry>> {
    return this.cache.getSimple(type);
  }

  getReasons(): Promise<DictionaryEntry[]> {
    return this.cache.getReasons();
  }

  invalidate(type?: DictionaryType): Promise<void> {
    return this.cache.invalidate(type);
  }

  async getPositionOrder(): Promise<string[]> {
    const positions = await this.cache.getSimple("position");
    return [...positions.values()]
      .filter((e): e is typeof e & { order: number } => e.order !== null)
      .toSorted((a, b) => a.order - b.order)
      .map((e) => e.canonicalName);
  }

  async buildHints(types: DictionaryType[]): Promise<string> {
    const hints: string[] = [];

    for (const type of types) {
      const hint = await this.buildSingleHint(type);
      if (hint) hints.push(hint);
    }

    return hints.length > 0 ? `\n${hints.join("\n")}\n` : "";
  }

  private async buildSingleHint(type: DictionaryType): Promise<string | null> {
    if (type === "reasons") {
      const reasons = await this.cache.getReasons();
      if (reasons.length === 0) return null;
      const formatted = reasons.map((r) => `${r.canonicalName} (${r.description})`).join(", ");
      return `KNOWN REASONS: ${formatted}`;
    }

    const dict = await this.cache.getSimple(type);
    if (dict.size === 0) return null;

    const label = DICTIONARY_LABELS[type];
    let values = [...dict.values()].map((e) => e.canonicalName);

    if (type === "skill") {
      values = values.slice(0, this.maxSkills);
    }

    return `KNOWN ${label}: ${values.join(", ")}`;
  }
}
