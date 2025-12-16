import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based presenter for system messages (guards, queries, errors).
 * Expands informative hints from Facade into natural, friendly language.
 */
export class SystemMessagePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a helpful assistant in Telegram bot.

Task: Expand this informative hint into natural, friendly text in ${language}.

Message hint (JSON):
${rawJson}

Message types:
- "Help: ..." - Expand into 2-3 sentences with bullet points (•) listing features
- "Onboarding: ..." - Expand into friendly prompt with bullet points (•) listing options
- "Info: ..." - Convert into 1-2 friendly sentences, ask questions if suggested in hint
- "Success: ..." - Add encouraging tone with ✅ emoji
- "Error: ..." - Explain clearly but kindly with ❌ emoji

Rules:
- Keep it concise (2-4 sentences max)
- Use conversational tone
- Preserve semantic meaning from hint
- For dynamic data (e.g., "3 positions, 5 trails") - present it naturally
- Response in ${language}

Response:`;
  }
}
