import { describe, expect, test } from "vitest";
import { join } from "path";
import { PresetsManager } from "../../../src/orcestrator/preset-manager.js";

const PRESETS_PATH = join(process.cwd(), "config", "presets.json");

describe("PresetsManager", () => {
  test("throws when accessing presets before load", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    expect(() => manager.list()).toThrow("Presets not loaded");
  });

  test("load reads and validates production presets", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();

    const available = manager.list();
    expect(available.length).toBeGreaterThan(0);
    expect(available).toContain("BALANCED");

    const balanced = manager.get("BALANCED");
    expect(balanced.strictFields.length).toBeGreaterThan(0);
    expect(balanced.flexibleFields.length).toBeGreaterThan(0);
  });

  test("getAll returns a new object snapshot", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();

    const firstSnapshot = manager.getAll();
    const secondSnapshot = manager.getAll();

    expect(firstSnapshot).not.toBe(secondSnapshot);
    expect(Object.keys(firstSnapshot)).toEqual(Object.keys(secondSnapshot));
  });

  test("get throws for unknown preset", () => {
    const manager = new PresetsManager(PRESETS_PATH);
    manager.load();
    expect(() => manager.get("UNKNOWN")).toThrow("Unknown preset");
  });
});
