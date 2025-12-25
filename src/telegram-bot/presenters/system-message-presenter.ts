import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based presenter for system messages (guards, queries, errors).
 * Translates full English messages from Facade to user's language.
 */
export class SystemMessagePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    const text = rawJson.startsWith('"') ? JSON.parse(rawJson) : rawJson;
    return `Translate to ${language}. Output ONLY the translated text.

${text}`;
  }
}
