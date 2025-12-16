import { BasePresenter } from "./base-presenter.js";

/**
 * LLM-based formatter for /start command welcome messages.
 * Generates personalized greetings based on user's story status.
 */
export class WelcomePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a career assistant for WayMates platform.

User just started conversation. Greet them warmly and explain:
- Platform helps find career paths based on similar professionals
- Just send a message describing your career goal or current position

Input (JSON with user context):
${rawJson}

Rules:
- Explain that user can simply write their career questions or goals in natural language
- No commands needed - just conversational messages
- If userName is present: use it in greeting naturally
- IMPORTANT: Respond in ${language}
- Tone: friendly, concise (3-4 sentences)
- Format: Plain text, use emojis sparingly (💼 🎯 📊)

Response (plain text only, no explanations):`;
  }
}
