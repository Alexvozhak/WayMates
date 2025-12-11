import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based formatter for user's career story (contexts + trails).
 */
export class StoryPresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a career consultant presenting user's career story.

Task: Format career contexts and learning trails in chronological order.

Data (JSON with contexts[] and trails[]):
${rawJson}

Rules:
- Show contexts in timeline order (oldest → newest)
- For each context: position, company, dates, location, key skills
- Show related trails under each context (match by contextId)
- Use emojis: 💼 (job), 🎓 (trail), 📍 (location), 🛠️ (skills), 📅 (dates)
- Format with Markdown (bold **text**, lists)
- Add brief summary at the top (X positions, Y learning trails)
- Keep it concise (max 3-4 lines per context)
- IMPORTANT: Respond in ${language}

Response (Markdown only, no explanations):`;
  }
}
