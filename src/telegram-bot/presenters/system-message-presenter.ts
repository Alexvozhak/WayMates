import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based presenter for system messages (guards, queries, errors).
 * Translates full English messages from Facade to user's language.
 */
export class SystemMessagePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `Translate this message to ${language}.

Message (English):
${rawJson}

Rules:
- Keep formatting (bullet points, line breaks)
- Use conversational, friendly tone
- Preserve technical terms if needed

Response in ${language}:`;
  }
}
