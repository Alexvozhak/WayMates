import currentPresetsJson from "../../config/current-presets.json" with { type: "json" };
import targetPresetsJson from "../../config/target-presets.json" with { type: "json" };
import { CurrentPresetsSchema, TargetPresetsSchema } from "../schemas-zod.js";

export const CURRENT_PRESETS = CurrentPresetsSchema.parse(currentPresetsJson);
export const TARGET_PRESETS = TargetPresetsSchema.parse(targetPresetsJson);

export type CurrentPresetName = keyof typeof currentPresetsJson;
export type TargetPresetName = keyof typeof targetPresetsJson;

export const isCurrentPresetName = (name: string): name is CurrentPresetName => {
  return Object.keys(CURRENT_PRESETS).includes(name);
};

export const isTargetPresetName = (name: string): name is TargetPresetName => {
  return Object.keys(TARGET_PRESETS).includes(name);
};
