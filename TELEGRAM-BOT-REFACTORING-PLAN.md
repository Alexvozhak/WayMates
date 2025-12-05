# План рефакторинга Telegram Bot

> **Статус**: В разработке
> **Дата**: 2025-12-05
> **Источник**: Ревью-документ cheerful-kindling-pixel.md (Части 6-23)

---

## Scope

Полный рефакторинг бота по 18 частям (6-23) из ревью-документа:
- P0: Graceful shutdown + Voice Buffer
- P1: Core fixes (Input Guard, NLP, DRY, process.env, voice handler)
- P2: Features (Story-first, typing indicator, /token)
- P3-P4: Architecture + Polish

**Out of scope**: U1 (Observability), U2 (Tests) - отдельная задача.

---

## Зависимости и блокеры

| Часть | Зависит от | Статус |
|-------|------------|--------|
| Часть 8 (Story-first) | Часть 12 (SessionData), Facade hasStory | ⏳ |
| Часть 10 (/token) | Часть 12 (SessionData.token) | ⏳ |
| Часть 6 (Input Guard) | — | ✅ Ready |
| Часть 7 (NLP Structured) | — | ✅ Ready |

---

## Фазы реализации

### Phase 0: Facade Prerequisites
- [ ] Добавить `hasStory` в `TelegramRegisterResult`
- [ ] Изменить `registerViaTelegram` для вызова `isColdStartCompleted`

### Phase 1: Foundation (P0)
- [ ] Часть 12: SessionData structure (types.ts)
- [ ] Часть 19: Graceful shutdown (index.ts)
- [ ] Часть 15: Fix ctx.message mutation (bot.ts, handlers)
- [ ] Часть 23: Voice Buffer (whisper.ts) - serverless-ready

### Phase 2: Core Fixes (P1)
- [ ] Часть 6: Input Guard (bot.ts text handler)
- [ ] Часть 7: NLP withStructuredOutput (nlp-parser.ts)
- [ ] Часть 13: DRY pendingAction helpers (pending-actions.ts)
- [ ] Часть 16: process.env через ctx.services (whisper.ts)
- [ ] Часть 17: Extract voice handler (handlers/voice.ts)
- [ ] Часть 20: Atomic counter для jsonrpc id (mcp-client.ts)

### Phase 3: Features (P2)
- [ ] Часть 8: Story-first onboarding (hasStory guard)
- [ ] Часть 9: Typing indicator (callTool, whisper, handlers)
- [ ] Часть 10: /token command (handlers/token.ts)

### Phase 4: Architecture (P3)
- [ ] Часть 14: DRY getTextOrError helper
- [ ] Часть 18: Retry с exponential backoff (mcp-client.ts)
- [ ] Часть 22: Formatters split (formatters/*.ts)

### Phase 5: Polish (P3)
- [ ] Часть 11: i18n (i18n.ts)
- [ ] Часть 21: Structured logging (pino)

---

## Решения

### Edit Callback
**Выбор**: Вариант 2 (статический)
- 14 строк vs 33 строки
- Facade уже stateful (LangGraph)
- User flow идентичен

---

## Детальный план по фазам

### Phase 0: Facade Prerequisites

#### 0.1 Добавить hasStory в TelegramRegisterResult
**Файл**: `src/facade/mcp-server/auth.service.ts`

```typescript
// Строка 22-27: Добавить hasStory в тип
export type TelegramRegisterResult = {
  userId: string;
  token: Token;
  sessionId: SessionId;
  isNewUser: boolean;
  hasStory: boolean;  // ← ДОБАВИТЬ
};
```

#### 0.2 Изменить registerViaTelegram
**Файл**: `src/facade/mcp-server/auth.service.ts`

```typescript
// Строка 74-88: Для существующего пользователя
async registerViaTelegram(info: TelegramUserInfo): Promise<TelegramRegisterResult> {
  const existing = await postgresService.findUserByTelegramId(info.telegramUserId);

  if (existing) {
    const userId = userIdSchema.parse(existing.userId);
    const hasStory = await postgresService.isColdStartCompleted(userId);  // ← ДОБАВИТЬ
    const sessionId = await this.sessionMiddleware.createWithSingleActiveSession(userId);
    await postgresService.updateLastAuthAt(userId);

    return {
      userId: existing.userId,
      token: existing.token,
      sessionId,
      isNewUser: false,
      hasStory,  // ← ДОБАВИТЬ
    };
  }

  // Строка 90-108: Для нового пользователя
  // ... существующий код ...
  return {
    userId,
    token,
    sessionId,
    isNewUser: true,
    hasStory: false,  // ← ДОБАВИТЬ (новый пользователь)
  };
}
```

---

### Phase 1: Foundation (P0)

#### 1.1 Часть 12: SessionData structure
**Файл**: `src/telegram-bot/types.ts`

**До**:
```typescript
export type SessionStorage = Map<number, string>;
```

**После**:
```typescript
export type SessionData = {
  sessionId: string;
  hasStory: boolean;
  token: string;
};

export type SessionStorage = Map<number, SessionData>;
```

**Затронутые файлы** (нужно обновить):
- `mcp-client.ts`: `ctx.sessions.get/set` теперь работает с SessionData
- `bot.ts`: middleware передаёт SessionData

#### 1.2 Часть 19: Graceful shutdown
**Файл**: `src/telegram-bot/index.ts`

**Добавить после создания бота**:
```typescript
process.on("SIGTERM", () => bot.stop());
process.on("SIGINT", () => bot.stop());
```

#### 1.3 Часть 15: Fix ctx.message mutation
**Файлы**: `src/telegram-bot/bot.ts`, `handlers/story.ts`, `handlers/search.ts`

**bot.ts voice handler (строки 63-68)** - удалить мутацию:
```typescript
// БЫЛО:
ctx.message = { ...ctx.message, text };
await handleStory(ctx);

// СТАНЕТ:
await handleStory(ctx, text);
```

**handlers/story.ts** - добавить параметр:
```typescript
export async function handleStory(ctx: BotContext, textOverride?: string): Promise<void> {
  const message = textOverride ?? ctx.message?.text?.replace("/story", "").trim();
  // ...
}
```

**handlers/search.ts** - аналогично:
```typescript
export async function handleSearch(ctx: BotContext, textOverride?: string): Promise<void> {
  const query = textOverride ?? ctx.message?.text?.replace("/search", "").trim();
  // ...
}
```

#### 1.4 Часть 23: Voice Buffer
**Файл**: `src/telegram-bot/services/whisper.ts`

**Полная замена** (убираем tmpdir, используем Buffer + OpenAI toFile):
```typescript
import OpenAI, { toFile } from "openai";
import { WhisperError } from "../errors.js";
import type { BotContext } from "../types.js";

export async function transcribeVoice(ctx: BotContext, fileId: string): Promise<string> {
  await ctx.replyWithChatAction("typing");
  const openai = ctx.services.openaiClient;
  const fileUrl = await getFileUrl(ctx, fileId);

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new WhisperError(`Failed to download voice: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = await toFile(buffer, "voice.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ru",
    });

    return transcription.text;
  } catch (error) {
    if (error instanceof WhisperError) throw error;
    throw new WhisperError("Failed to transcribe voice message", error instanceof Error ? error : undefined);
  }
}

async function getFileUrl(ctx: BotContext, fileId: string): Promise<string> {
  const file = await ctx.api.getFile(fileId);
  if (!file.file_path) {
    throw new WhisperError("File path not found in Telegram response");
  }
  return `https://api.telegram.org/file/bot${ctx.services.botToken}/${file.file_path}`;
}
```

**Требует**: Добавить `botToken` и `openaiClient` в BotServices (1.1).

---

### Phase 2: Core Fixes (P1)

#### 2.1 Часть 6: Input Guard
**Файл**: `src/telegram-bot/bot.ts`

**Добавить после callbacks, ДО voice handler**:
```typescript
bot.on("message:text", async (ctx) => {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const pendingAction = ctx.pendingActions.get(telegramUserId);

  if (pendingAction) {
    ctx.pendingActions.delete(telegramUserId);

    if (pendingAction === "story") {
      await handleStory(ctx);
    } else if (pendingAction === "search") {
      await handleSearch(ctx);
    }
    return;
  }

  await ctx.reply(
    "⚠️ Сначала выберите действие:\n\n" +
    "/story — Рассказать карьерную историю\n" +
    "/search — Найти карьерные пути"
  );
});
```

#### 2.2 Часть 7: NLP withStructuredOutput
**Файл**: `src/telegram-bot/services/nlp-parser.ts`

**Полная замена**:
```typescript
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { NlpParseError } from "../errors.js";

const searchParamsSchema = z.object({
  position: z.string().min(1),
  organization: z.string().optional(),
  location: z.string().optional(),
  domain: z.string().optional(),
  skills: z.array(z.string()).default([]),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export async function parseSearchQuery(apiKey: string, query: string): Promise<SearchParams> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0, openAIApiKey: apiKey });
  const structuredLlm = llm.withStructuredOutput(searchParamsSchema);

  try {
    return await structuredLlm.invoke(`Extract search parameters from: ${query}`);
  } catch (error) {
    throw new NlpParseError("Failed to parse search query", error instanceof Error ? error : undefined);
  }
}
```

#### 2.3 Часть 13: DRY pendingAction helpers
**Новый файл**: `src/telegram-bot/services/pending-actions.ts`

```typescript
import type { BotContext, PendingAction } from "../types.js";

export function setPendingAction(ctx: BotContext, action: PendingAction): void {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId) {
    ctx.pendingActions.set(telegramUserId, action);
  }
}

export function clearPendingAction(ctx: BotContext): void {
  const telegramUserId = ctx.from?.id;
  if (telegramUserId) {
    ctx.pendingActions.delete(telegramUserId);
  }
}

export function getPendingAction(ctx: BotContext): PendingAction | undefined {
  const telegramUserId = ctx.from?.id;
  return telegramUserId ? ctx.pendingActions.get(telegramUserId) : undefined;
}
```

**Обновить**: story.ts, search.ts, bot.ts (использовать helpers).

#### 2.4 Часть 16: process.env через ctx.services
**Файл**: `src/telegram-bot/types.ts`

```typescript
export type BotServices = {
  facadeMcpUrl: string;
  openaiApiKey: string;
  openaiClient: OpenAI;  // singleton
  botToken: string;      // для whisper
};
```

**Файл**: `src/telegram-bot/index.ts` - создать singleton:
```typescript
import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const bot = createBot(env.TELEGRAM_BOT_TOKEN, {
  facadeMcpUrl: env.FACADE_MCP_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  openaiClient,
  botToken: env.TELEGRAM_BOT_TOKEN,
});
```

#### 2.5 Часть 17: Extract voice handler
**Новый файл**: `src/telegram-bot/handlers/voice.ts`

```typescript
import { transcribeVoice } from "../services/whisper.js";
import { getPendingAction, clearPendingAction } from "../services/pending-actions.js";
import { handleStory } from "./story.js";
import { handleSearch } from "./search.js";
import type { BotContext } from "../types.js";

export async function handleVoice(ctx: BotContext): Promise<void> {
  const pendingAction = getPendingAction(ctx);

  if (!pendingAction) {
    await ctx.reply(
      "⚠️ Сначала выберите действие:\n\n" +
      "/story — Рассказать карьерную историю\n" +
      "/search — Найти карьерные пути"
    );
    return;
  }

  const text = await transcribeVoice(ctx, ctx.message.voice.file_id);
  clearPendingAction(ctx);

  if (pendingAction === "story") {
    await handleStory(ctx, text);
  } else if (pendingAction === "search") {
    await handleSearch(ctx, text);
  }
}
```

**bot.ts**: Заменить inline handler на:
```typescript
import { handleVoice } from "./handlers/voice.js";
bot.on("message:voice", handleVoice);
```

#### 2.6 Часть 20: Atomic counter
**Файл**: `src/telegram-bot/services/mcp-client.ts`

```typescript
let requestId = 0;

async function sendMcpRequest(...) {
  const response = await fetch(facadeUrl, {
    // ...
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++requestId,  // ← atomic counter вместо Math.random()
      // ...
    }),
  });
}
```

---

### Phase 3: Features (P2)

#### 3.1 Часть 8: Story-first onboarding
**Файл**: `src/telegram-bot/bot.ts`

**Добавить middleware после services middleware**:
```typescript
bot.use(async (ctx, next) => {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) {
    await next();
    return;
  }

  const session = ctx.sessions.get(telegramUserId);
  const command = ctx.message?.text?.split(' ')[0];
  const storyRequiredCommands = ['/goal', '/context', '/trail'];

  if (storyRequiredCommands.includes(command ?? '') && !session?.hasStory) {
    await ctx.reply(
      "⚠️ Сначала расскажите свою карьерную историю!\n\n" +
      "Используйте /story чтобы начать."
    );
    return;
  }

  await next();
});
```

**callbacks.ts**: Обновить hasStory при COMPLETED:
```typescript
export async function handleApproveCallback(ctx: BotContext): Promise<void> {
  // ... existing ...
  if (data?.phase === "COMPLETED") {
    const telegramUserId = ctx.from?.id;
    if (telegramUserId) {
      const session = ctx.sessions.get(telegramUserId);
      if (session) {
        ctx.sessions.set(telegramUserId, { ...session, hasStory: true });
      }
    }
  }
}
```

#### 3.2 Часть 9: Typing indicator
**Файлы**: `mcp-client.ts`, `search.ts`

```typescript
// mcp-client.ts - callTool
export async function callTool(ctx: BotContext, ...) {
  await ctx.replyWithChatAction("typing");  // ← добавить
  // ...
}

// search.ts - перед parseSearchQuery
await ctx.replyWithChatAction("typing");
const searchParams = await parseSearchQuery(...);
```

#### 3.3 Часть 10: /token command
**Новый файл**: `src/telegram-bot/handlers/token.ts`

```typescript
import type { BotContext } from "../types.js";

export async function handleToken(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const session = ctx.sessions.get(telegramUserId);
  if (!session?.token) {
    await ctx.reply("⚠️ Токен недоступен. Используйте /start для регистрации.");
    return;
  }

  await ctx.reply(
    "🔑 Ваш токен для LibreChat:\n\n" +
    `\`${session.token}\`\n\n` +
    "Нажмите на токен чтобы скопировать.\n" +
    "Используйте его в LibreChat: /link <token>",
    { parse_mode: "Markdown" }
  );
}
```

**bot.ts**:
```typescript
import { handleToken } from "./handlers/token.js";
bot.command("token", handleToken);
```

---

### Phase 4: Architecture (P3)

#### 4.1 Часть 14: DRY getTextOrError
**Файл**: `src/telegram-bot/services/mcp-utils.ts`

```typescript
export function getTextOrError(result: McpToolResult, errorMessage: string): string {
  const text = extractTextContent(result);
  if (!text) {
    throw new McpClientError(errorMessage);
  }
  return text;
}
```

#### 4.2 Часть 18: Retry с exponential backoff
**Файл**: `src/telegram-bot/services/mcp-client.ts`

```typescript
async function sendMcpRequestWithRetry(
  facadeUrl: string,
  toolName: string,
  params: Record<string, unknown>,
  maxRetries = 3
): Promise<McpToolResult> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await sendMcpRequest(facadeUrl, toolName, params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message.includes("HTTP error 4")) {
        throw lastError;  // Не retry на 4xx
      }

      const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new McpClientError(`Failed after ${maxRetries} retries`, lastError);
}
```

#### 4.3 Часть 22: Formatters split
**Новые файлы**:
- `src/telegram-bot/formatters/story.ts`
- `src/telegram-bot/formatters/search.ts`

Вынести форматирующие функции из handlers:
- `formatColdStartResult`, `formatExtractedData`, `formatSingleContext` → `formatters/story.ts`
- `formatSearchResult`, `formatSearchResultItem` → `formatters/search.ts`

---

### Phase 5: Polish (P3)

#### 5.1 Часть 11: i18n
**Новый файл**: `src/telegram-bot/i18n.ts`

```typescript
type Locale = "ru" | "en";

const messages = {
  ru: {
    welcome: "👋 Добро пожаловать в WayMates!",
    storyPrompt: "📝 Расскажите о своей карьерной истории:",
    // ...
  },
  en: {
    welcome: "👋 Welcome to WayMates!",
    storyPrompt: "📝 Tell me about your career history:",
    // ...
  },
} as const;

export function t(ctx: BotContext, key: keyof typeof messages.ru): string {
  const lang = ctx.from?.language_code;
  const locale: Locale = lang?.startsWith("ru") ? "ru" : "en";
  return messages[locale][key];
}
```

#### 5.2 Часть 21: Structured logging
**Установка**: `npm install pino`

**Новый файл**: `src/telegram-bot/logger.ts`

```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
});
```

Заменить `console.log/error` на `logger.info/error`.

---

## Edit Callback (Вариант 2)

**Файл**: `src/telegram-bot/handlers/callbacks.ts`

```typescript
export async function handleEditCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramUserId = ctx.from?.id;
  if (telegramUserId) {
    ctx.pendingActions.set(telegramUserId, "story");
  }
  await ctx.editMessageText("✏️ Введите изменения к вашей карьерной истории:");
}
```

---

## Файлы для изменения (сводка)

| Фаза | Файл | Изменение |
|------|------|-----------|
| 0 | auth.service.ts | hasStory в TelegramRegisterResult |
| 1 | types.ts | SessionData structure |
| 1 | index.ts | graceful shutdown + OpenAI singleton |
| 1 | bot.ts | fix ctx mutation, import voice |
| 1 | whisper.ts | Buffer approach |
| 1 | story.ts, search.ts | textOverride param |
| 2 | bot.ts | text handler (Input Guard) |
| 2 | nlp-parser.ts | withStructuredOutput |
| 2 | pending-actions.ts | NEW: helpers |
| 2 | voice.ts | NEW: extracted handler |
| 2 | mcp-client.ts | atomic counter |
| 3 | bot.ts | hasStory guard middleware |
| 3 | callbacks.ts | hasStory update + edit fix |
| 3 | mcp-client.ts, search.ts | typing indicator |
| 3 | token.ts | NEW: /token handler |
| 4 | mcp-utils.ts | getTextOrError helper |
| 4 | mcp-client.ts | retry with backoff |
| 4 | formatters/*.ts | NEW: split formatters |
| 5 | i18n.ts | NEW: localization |
| 5 | logger.ts | NEW: pino logging |

---

## Quality Gates

После КАЖДОЙ фазы:
```bash
npm run lint
npx tsc --noEmit
```

После Phase 1-3 - тестировать бота вручную.
