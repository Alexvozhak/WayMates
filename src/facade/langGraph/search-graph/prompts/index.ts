// Re-export all prompts from submodules
export {
  buildAdhocClarificationPrompt,
  buildAdhocExtractionPrompt,
  buildGoalClarificationPrompt,
  buildGoalExtractionPrompt,
} from "./extraction.js";
export { buildUserIntentPrompt } from "./classification.js";
export { ADVISOR_SYSTEM_PROMPT } from "./advisor.js";
