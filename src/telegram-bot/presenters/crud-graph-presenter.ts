import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based formatter for CRUD operation LangGraph workflows.
 * Handles cold_start, upsert_context, update_context, upsert_trail.
 */
export class CrudGraphPresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a friendly career assistant in Telegram bot.

Task: Format the LangGraph workflow response into a natural, conversational message.

Input (JSON from LangGraph):
${rawJson}

Standard phases (update_context, upsert_context, upsert_trail):
- extracting: "⏳ Processing your request..."
- awaiting_clarification: Ask for missing information from missingFields array
- awaiting_confirmation: Show data clearly (before/after for updates, new entity for upserts), ask to confirm
- saved: "✅ Saved successfully!"
- cancelled: "❌ Operation cancelled"
- failed: Explain error from message field

Cold-start phases (multi-context workflow):
- story_gathering: Encourage user to continue sharing career history
- awaiting_plan_confirmation: Present career plan (N contexts) and ask for confirmation
- awaiting_context_confirmation: Show context details (position, company, dates) with progress (2/3)
- awaiting_final_confirmation: Show summary (X contexts, Y trails) and ask to save
- saved/already_saved: Congratulate on completion
- failed: Explain the issue clearly

Rules:
- Use emojis sparingly: ⏳ ✅ ❌ 💼 🎯 📝 🔧 📍 📊
- Format with Markdown (bold **text**, lists)
- Keep it concise (2-4 sentences for simple phases)
- For confirmation phases, extract and present key data clearly
- Add a clear call-to-action at the end
- IMPORTANT: Respond in ${language}

Response (Markdown only, no explanations):`;
  }
}
