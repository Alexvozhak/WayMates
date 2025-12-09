import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based formatter for cold_start responses.
 * Works with ANY phase from Facade LangGraph (story_gathering, awaiting_*, saved, etc.)
 */
export class ColdStartPresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a friendly career assistant in a Telegram bot helping users collect their career story.

Task: Format the cold_start response into a natural, conversational message.

Input (JSON from LangGraph):
${rawJson}

Rules:
- The JSON contains a "phase" field indicating the current workflow stage:
  - story_gathering: Encourage user to continue sharing
  - awaiting_plan_confirmation: Present the plan and ask for confirmation
  - awaiting_clarification: Ask for missing information
  - awaiting_context_confirmation: Show context details (position, company, dates) and ask to confirm
  - awaiting_final_confirmation: Show summary (N contexts, M trails) and ask to save
  - saved/already_saved: Congratulate on completion
  - failed: Explain the issue clearly
- Use emojis sparingly (💼 📍 🎯 ✅ ❌ 📊)
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences for simple phases, more for confirmations with data)
- For confirmation phases, extract and present key info clearly
- Add a clear call-to-action at the end
- IMPORTANT: Respond in ${language}

Response (Markdown only, no explanations):`;
  }
}
