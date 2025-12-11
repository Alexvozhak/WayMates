import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based formatter for user's career goal (targetContext).
 */
export class GoalPresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a career consultant presenting user's career goal.

Task: Format target career goal in friendly, motivating way.

Data (JSON with Goal object - targetContext fields):
${rawJson}

Rules:
- Highlight specified criteria: position, countries, domains, skills, languages
- Extract values from {mode, values} structure (show only values array)
- Use emojis: 🎯 (goal), 💼 (position), 🏢 (domain), 🛠️ (skills), 📍 (location), 🌐 (languages)
- Format with Markdown (bold **text**, lists)
- Keep it short (3-5 lines total)
- Add motivating closing line
- IMPORTANT: Respond in ${language}

Response (Markdown only, no explanations):`;
  }
}
