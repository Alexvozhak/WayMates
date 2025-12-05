import type { BotContext } from "./types.js";

type Locale = "ru" | "en";

const messages = {
  ru: {
    welcome: "👋 Добро пожаловать в WayMates!",
    storyPrompt:
      "📝 Расскажите о своей карьерной истории:\n\n" +
      "Например:\n" +
      "Работал backend разработчиком в Яндексе с 2020 по 2023, писал на Python и Go. " +
      "Потом перешёл в стартап на позицию Tech Lead...\n\n" +
      "💬 Вы можете отправить текст или голосовое сообщение.",
    searchPrompt:
      "🔍 Поиск карьерных путей\n\n" +
      "Использование:\n" +
      "/search <описание позиции>\n\n" +
      "Примеры:\n" +
      "/search Senior ML Engineer в Google\n" +
      "/search Backend разработчик Python удалёнка\n" +
      "/search Tech Lead стартап Москва\n\n" +
      "💬 Вы можете отправить текст или голосовое сообщение.",
    actionRequired:
      "⚠️ Сначала выберите действие:\n\n" +
      "/story — Рассказать карьерную историю\n" +
      "/search — Найти карьерные пути",
    storyRequired: "⚠️ Сначала расскажите свою карьерную историю!\n\n" + "Используйте /story чтобы начать.",
    tokenUnavailable: "⚠️ Токен недоступен. Используйте /start для регистрации.",
    accountsLinked: "✅ Аккаунты успешно привязаны! Теперь вы можете использовать бота.",
    linkAlreadyExists: "❌ Этот Telegram аккаунт уже привязан к другому пользователю",
    searchingPaths: "🔍 Анализирую запрос и ищу подходящие карьерные пути...",
    errorGeneric: "❌ An unexpected error occurred. Please try again later.",
  },
  en: {
    welcome: "👋 Welcome to WayMates!",
    storyPrompt:
      "📝 Tell me about your career history:\n\n" +
      "For example:\n" +
      "Worked as a backend developer at Yandex from 2020 to 2023, wrote Python and Go. " +
      "Then moved to a startup as Tech Lead...\n\n" +
      "💬 You can send text or voice message.",
    searchPrompt:
      "🔍 Career path search\n\n" +
      "Usage:\n" +
      "/search <position description>\n\n" +
      "Examples:\n" +
      "/search Senior ML Engineer at Google\n" +
      "/search Backend Python developer remote\n" +
      "/search Tech Lead startup Moscow\n\n" +
      "💬 You can send text or voice message.",
    actionRequired:
      "⚠️ Please choose an action first:\n\n" + "/story — Share your career history\n" + "/search — Find career paths",
    storyRequired: "⚠️ Please share your career history first!\n\n" + "Use /story to begin.",
    tokenUnavailable: "⚠️ Token unavailable. Use /start to register.",
    accountsLinked: "✅ Accounts linked successfully! You can now use the bot.",
    linkAlreadyExists: "❌ This Telegram account is already linked to another user",
    searchingPaths: "🔍 Analyzing query and searching for suitable career paths...",
    errorGeneric: "❌ An unexpected error occurred. Please try again later.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["ru"];

export function t(ctx: BotContext, key: MessageKey): string {
  const lang = ctx.from?.language_code;
  const locale: Locale = lang?.startsWith("ru") ? "ru" : "en";
  return messages[locale][key];
}

export function getLocale(ctx: BotContext): Locale {
  const lang = ctx.from?.language_code;
  return lang?.startsWith("ru") ? "ru" : "en";
}
