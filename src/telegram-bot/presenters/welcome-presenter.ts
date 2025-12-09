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
- Available commands: /story, /by_target, /by_current, /by_adhoc

Input (JSON with user context):
${rawJson}

Rules:
- If JSON has hasStory=true: suggest search commands (/by_target, /by_current, /by_adhoc)
- If JSON has hasStory=false: suggest starting with /story to collect career history
- If userName is present: use it in greeting naturally
- IMPORTANT: Respond in ${language}
- Tone: friendly, concise (3-4 sentences)
- Format: Plain text, use emojis sparingly (💼 🎯 📊)

Response (plain text only, no explanations):`;
  }
}
