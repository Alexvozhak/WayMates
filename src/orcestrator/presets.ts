import presetsJson from "../../config/presets.json" with { type: "json" };
import { PresetsSchema } from "../schemas-zod.js";

export const PRESETS = PresetsSchema.parse(presetsJson);
export type PresetName = keyof typeof presetsJson;
export type PresetConfig = typeof presetsJson;

export const isPresetName = (presetName: string): presetName is PresetName => {
  return Object.keys(PRESETS).includes(presetName);
};
