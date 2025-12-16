import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based presenter for system messages (guards, queries, errors).
 * Translates hardcoded English messages from Facade to user's language.
 */
export class SystemMessagePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a helpful assistant in Telegram bot.

Task: Translate this system message to ${language}.

System message (JSON):
${rawJson}

Rules:
- Keep it concise and friendly
- Use proper tone for the context (help/error/guard/info)
- Preserve any technical details or commands mentioned
- Response in ${language}

Response:`;
  }
}
