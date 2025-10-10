import { readFileSync } from "fs";
import { QueryConfigSchema, validateSchema } from "../schemas-zod.js";
import type { QueryConfig } from "../schemas-zod.js";

export type Presets = Record<string, QueryConfig>;

export class PresetsManager {
  private presets: Presets = {};
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(): void {
    try {
      const jsonContent = readFileSync(this.configPath, "utf-8");
      const rawPresets = JSON.parse(jsonContent);
      this.presets = this.validatePresets(rawPresets);
    } catch (error) {
      throw new Error(`Failed to load presets: ${error}`);
    }
  }

  private ensureLoaded(): void {
    if (!this.presets || Object.keys(this.presets).length === 0) {
      throw new Error("Presets not loaded. Call load() first.");
    }
  }

  list(): string[] {
    this.ensureLoaded();
    return Object.keys(this.presets);
  }

  get(preset: string): QueryConfig {
    this.ensureLoaded();

    const config = this.presets[preset];
    if (!config) {
      throw new Error(
        `Unknown preset: ${preset}. Available: ${Object.keys(this.presets).join(", ")}`
      );
    }
    return config;
  }

  getAll(): Presets {
    this.ensureLoaded();
    return { ...this.presets };
  }

  // Методы для тестирования
  add(name: string, config: QueryConfig): void {
    this.presets[name] = config;
  }

  remove(name: string): void {
    delete this.presets[name];
  }

  private validatePresets(rawPresets: Record<string, unknown>): Presets {
    const validatedPresets: Presets = {};

    for (const [presetName, presetConfig] of Object.entries(rawPresets)) {
      try {
        validatedPresets[presetName] = validateSchema(
          presetConfig,
          QueryConfigSchema,
          "QueryConfig"
        );
      } catch (error) {
        throw new Error(
          `Invalid preset configuration for '${presetName}': ${error}`
        );
      }
    }

    return validatedPresets;
  }
}
