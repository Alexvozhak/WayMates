import { createNlpResponse } from "./converse-response.js";

import type { ConverseResponse } from "./converse-response.js";
import type { UserIntent } from "./intent-classifier.js";
import type { Locale, UserId } from "../../../shared/schemas.js";
import type { CoreClient } from "../../core-client.js";

type GuardType = "greeting" | "help" | "unknown" | "cancelNoActive" | "onboarding" | "goalNotSet" | "goalNotSetDelete";

const GUARD_MESSAGES: Record<Locale, Record<GuardType, string>> = {
  en: {
    greeting: `Hey! 👋 I help with career decisions.

I can find:
• Waymates — same position, same goal, going together
• Pathfinders — who already made your desired transition

• Quick search (~5 min) — by current position only
• Full history (~30 min) — candidates matched by your full career path

What works for you?`,
    help: `I can:
• Find similar people — by your current profile
• Find pathfinders — who made the transition you want
• Save your story — for better matching

Describe yourself or your goal.`,
    unknown: `Didn't get that. Try: "I'm a middle frontend developer in the UK" or "I want to become a tech lead".`,
    onboarding: `To find matches, I need to know who you are.

Tell me your role and level, like "senior QA in backend, working in Poland".`,
    cancelNoActive: "Nothing to cancel.",
    goalNotSet: "No goal set. Describe where you want to be.",
    goalNotSetDelete: "No goal to delete.",
  },
  ru: {
    greeting: `Привет! 👋 Помогаю с карьерными решениями.

Могу найти:
• Попутчиков — кто сейчас там же и хочет того же
• Проводников — кто уже прошёл твой путь к цели

• Быстрый поиск (~5 мин) — по текущей позиции
• Полная история (~30 мин) — кандидаты подобраны с учётом всего пути

Что выберешь?`,
    help: `Умею:
• Найти похожих — по твоему текущему профилю
• Найти проводников — кто уже сделал нужный переход
• Сохранить историю — для лучшего матчинга

Опиши себя или цель.`,
    unknown: `Не понял. Попробуй: "Я middle frontend разработчик в Германии" или "хочу стать тимлидом".`,
    onboarding: `Чтобы найти похожих, нужно знать кто ты.

Опиши роль и уровень, например "senior QA в backend, работаю в Польше".`,
    cancelNoActive: "Нечего отменять.",
    goalNotSet: "Цель не установлена. Опиши куда хочешь прийти.",
    goalNotSetDelete: "Нечего удалять.",
  },
};

export class FlowGuardChecker {
  constructor(private readonly coreClient: CoreClient) {}

  /* eslint-disable-next-line complexity -- guard conditions are linear and readable */
  async check(intent: UserIntent, userId: UserId, locale: Locale): Promise<ConverseResponse | null> {
    const msg = GUARD_MESSAGES[locale];

    // Greeting — friendly opener
    if (intent === "greeting") {
      return createNlpResponse(msg.greeting);
    }

    // Help
    if (intent === "help") {
      return createNlpResponse(msg.help);
    }

    // Unknown — unclear or garbage input
    if (intent === "unknown") {
      return createNlpResponse(msg.unknown);
    }

    // Cancel without active graph (active graph handled in ConverseTool)
    if (intent === "cancel") {
      return createNlpResponse(msg.cancelNoActive);
    }

    const state = await this.coreClient.client.user.getState.query({ userId });

    // Onboarding — no context
    if (!state.hasContext) {
      const isStart = intent === "startStory" || intent === "startAdhoc";
      if (!isStart) {
        return createNlpResponse(msg.onboarding);
      }
      return null;
    }

    // Goal guards
    if (intent === "getGoal" && !state.hasGoal) {
      return createNlpResponse(msg.goalNotSet);
    }
    if (intent === "deleteGoal" && !state.hasGoal) {
      return createNlpResponse(msg.goalNotSetDelete);
    }

    return null;
  }
}
