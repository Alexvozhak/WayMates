# Telegram Bot — Обсуждение Рефакторинга

> **Дата**: 2025-12-08
> **Тема**: Ответы на вопросы по REFACTOR-PLAN.md и дальнейшие шаги

---

## 1. Что Реализовано из REFACTOR-PLAN.md?

### ✅ Выполнено Полностью

| Фаза | Задача | Статус |
|------|--------|--------|
| Фаза 1 | `invokeLlmStructured<T>` — generic функция с валидацией | ✅ Реализовано |
| Фаза 1 | Добавить валидацию пустого результата (`Object.keys(cleaned).length === 0`) | ✅ Реализовано |
| Фаза 1 | Использовать Zod `.parse()` вместо `as` cast | ✅ Реализовано |
| Фаза 2 | Удалить `adhocContextSchemaBase` | ✅ Реализовано |
| Фаза 3.1 | Создать `formatAndReplySearch` утилиту | ✅ Реализовано |

**Где найти:**
- `src/telegram-bot/services/nlp-parser.ts` — generic `invokeLlmStructured`, валидация
- `src/telegram-bot/utils/search-utils.ts` — `formatAndReplySearch`

---

### ⚠️ Выполнено Частично (с отклонениями)

| Фаза | Задача (план) | Что сделали (реально) | Отклонение |
|------|---------------|----------------------|------------|
| Фаза 3.2 | Вынести константу `SEARCH_LIMITS` | НЕ сделали | Лимиты встроены в NLP schemas |
| Фаза 4 | Создать `constants.ts` с `ACTION_REQUIRED_MESSAGE` | Создали `locales/ru.ftl` + i18n | **ЛУЧШЕ** (интернационализация) |

**Почему лучше:**
- `constants.ts` → только RU язык, хардкод
- `locales/ru.ftl` + i18n → поддержка RU/EN, легко расширять

---

### ❌ НЕ Выполнено (Рудименты)

| Фаза | Задача | Почему не сделали |
|------|--------|-------------------|
| Фаза 3.2 | **Убрать `handleByTargetWithText`** | ПРОПУСТИЛИ! |
| Фаза 3.2 | **Экспортировать `processTargetQuery`** | ПРОПУСТИЛИ! |
| Фаза 3.3 | Константа `SEARCH_LIMITS` | Не критично (лимиты в NLP) |

**Текущая проблема:**

```typescript
// by-target.ts
export async function handleByTarget(ctx: BotContext) { ... }

// ❌ РУДИМЕНТ! Ненужная обертка
export async function handleByTargetWithText(ctx: BotContext, text: string) {
  await performTargetSearch(ctx, text);
}

async function performTargetSearch(ctx: BotContext, query: string) {
  // ... реальная логика
}

// input-router.ts
import { handleByTargetWithText } from "./by-target.js";

const handlers = {
  by_target: handleByTargetWithText, // ← Вызываем обертку вместо прямой функции
};
```

**Аналогично в:**
- `by-adhoc.ts` — `handleByAdhocWithText`
- `by-current.ts` — `handleByCurrentWithText`

---

### Почему i18n Шаблоны (не LLM)?

**План говорил:** Создать `constants.ts` с хардкод строками
**Реализовали:** `locales/ru.ftl` + i18n шаблоны

**Это НЕ рудимент, это УЛУЧШЕНИЕ!**

**Но:** Ты хотел **живые ответы от LLM**, а не шаблоны (даже локализованные).

**Текущая архитектура:**

```typescript
// locales/ru.ftl
welcome = Добро пожаловать в WayMates!

    Я помогу найти карьерные пути на основе опыта похожих специалистов.

    Доступные команды:
    /story — Начать сбор карьерной истории
    /by_target — Поиск по целевой позиции
    ...

// handlers/start.ts
await ctx.reply(ctx.t("welcome")); // ← Шаблон из i18n
```

**Проблема:** Робот-стиль, всегда одинаковый текст.

**Твое видение (предположительно):** Генерация через LLM для естественности.

---

## 2. i18n vs Живые LLM — Детальный Разбор

См. полный анализ: `I18N-VS-LLM-ANALYSIS.md`

### Текущая Картина

**Что используем сейчас:**

| Компонент | Метод | Пример |
|-----------|-------|--------|
| Приветствия | **i18n** | `ctx.t("welcome")` |
| Ошибки | **i18n** | `ctx.t("error-generic")`, `ctx.t("session-expired")` |
| Инструкции | **i18n** | `ctx.t("help")`, `ctx.t("target-usage")` |
| Status messages | **i18n** | `ctx.t("searching-target")` |
| Callback feedback | **i18n** | `ctx.t("story-confirmed")` |
| **Результаты поиска** | **LLM ✅** | `formatSearchResult()` через gpt-4o-mini |

**Единственное место с LLM:**
```typescript
// formatters/search.ts
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: apiKey,
});

const prompt = `You are a friendly career consultant...

Task: Present career path search results in a warm, human tone.

Rules:
- Use emojis sparingly
- Format with Markdown
- Highlight similarity percentage and key skills
- IMPORTANT: Respond in ${languageCode}`;

const response = await llm.invoke(prompt);
```

---

### Варианты Перехода на LLM

#### Вариант 1: Минимальный (как сейчас)

**Оставить i18n везде**, кроме `formatSearchResult`.

**Плюсы:**
- ✅ Быстро (нет вызовов LLM)
- ✅ Дешево (OpenAI API расходы минимальны)
- ✅ Предсказуемо (нет странных генераций)

**Минусы:**
- ❌ Робот-стиль (неестественно)
- ❌ Нет персонализации

---

#### Вариант 2: Гибридный (рекомендую)

**i18n:**
- Ошибки (`error-generic`, `session-expired`)
- Инструкции (`help`, `target-usage`, `link-usage`)
- Callback feedback (`story-confirmed`, `callback-processing`)

**LLM:**
- ✅ Результаты поиска (уже реализовано)
- 🆕 Status messages (`searching-*`) — генерировать с контекстом запроса
- 🆕 Контекстные приветствия (если пользователь вернулся через неделю)

**Пример status message с LLM:**

```typescript
// utils/live-messages.ts
export async function generateSearchingStatus(params: {
  type: "by_target" | "by_adhoc" | "by_current";
  query?: string;
  language: string;
}): Promise<string> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });

  const prompts = {
    by_target: `User is searching for professionals who achieved: "${params.query}"
Generate a brief "searching..." message in ${params.language}.
1 sentence, friendly tone, use 🔍 emoji.
Example (RU): "🔍 Ищу специалистов, которые уже стали ${params.query}..."`,

    by_adhoc: `User is searching for careers similar to: "${params.query}"
Generate a brief "searching..." message in ${params.language}.
1 sentence, friendly tone, use 🔍 emoji.`,

    by_current: `User is searching for careers similar to their own profile.
Generate a brief "searching..." message in ${params.language}.
1 sentence, friendly tone, use 🔍 emoji.`,
  };

  const response = await llm.invoke(prompts[params.type]);
  return response.content.trim();
}

// by-target.ts
const searchingMsg = await generateSearchingStatus({
  type: "by_target",
  query,
  language: ctx.from?.language_code ?? "ru",
});
const statusMsg = await ctx.reply(searchingMsg);
// Результат: "🔍 Ищу специалистов, которые уже стали ML Engineer в финтехе..."
```

**Плюсы:**
- ✅ Естественность (персонализированные сообщения)
- ✅ Безопасность (ошибки/инструкции остаются предсказуемыми)

**Минусы:**
- ❌ Чуть дороже (больше вызовов LLM)
- ❌ Чуть медленнее

---

#### Вариант 3: Максимальный LLM

**LLM везде**, кроме ошибок.

**Плюсы:**
- ✅ Максимальная естественность

**Минусы:**
- ❌ Дорого (много API вызовов)
- ❌ Непредсказуемо (может сгенерировать странное)
- ❌ Медленно (1-2 секунды на каждое сообщение)

---

### Мои Рекомендации

**Вариант 2 (Гибридный)** с приоритетами:

1. **Оставить i18n (критичные места):**
   - Ошибки — должны быть четкими
   - Инструкции — должны быть точными (команды, примеры)
   - Callback feedback — быстро, просто

2. **Добавить LLM (некритичные, контентные):**
   - ✅ Результаты поиска (уже есть)
   - 🆕 Status messages (`searching-*`) — естественность
   - 🆕 Контекстные приветствия (персонализация)

3. **Создать утилиты:**
   ```typescript
   // utils/live-messages.ts
   export async function generateSearchingStatus(...): Promise<string>
   export async function generateContextualGreeting(...): Promise<string>
   ```

**Что конкретно обсудить:**
1. Status messages (`searching-target`, `searching-adhoc`) — заменить на LLM или оставить i18n?
2. Приветствия — оставить `ctx.t("welcome")` или генерировать через LLM?
3. Success messages (`link-success`, `cancel-success`) — i18n или LLM?

---

## 3. Handlers Дублирование — План Доделки

### Текущая Проблема

```typescript
// by-target.ts
export async function handleByTarget(ctx: BotContext) {
  const query = ctx.message?.text?.replace("/by_target", "").trim();
  if (!query) {
    await showTargetUsage(ctx);
    return;
  }
  await performTargetSearch(ctx, query);
}

// ❌ ДУБЛИРОВАНИЕ: Ненужная обертка
export async function handleByTargetWithText(ctx: BotContext, text: string) {
  await performTargetSearch(ctx, text);
}

async function performTargetSearch(ctx: BotContext, query: string) {
  // ... реальная логика
}
```

**Проблема REFACTOR-PLAN.md, Фаза 3:**
> "Убрать `handleByTargetWithText` — экспортировать `processTargetQuery`"

**Что НЕ сделали:**
- ❌ Не убрали `handleByTargetWithText`
- ❌ Не переименовали `performTargetSearch` → `processTargetQuery`
- ❌ Не обновили `input-router.ts`

---

### План Доделки (Фаза 3 из REFACTOR-PLAN.md)

#### Шаг 1: Рефакторинг by-target.ts

```typescript
// by-target.ts
export async function handleByTarget(ctx: BotContext) {
  const query = ctx.message?.text?.replace("/by_target", "").trim();

  if (!query) {
    await showTargetUsage(ctx);
    return;
  }

  await processTargetQuery(ctx, query);
}

// ✅ ЭКСПОРТИРУЕМ для input-router (вместо handleByTargetWithText)
export async function processTargetQuery(ctx: BotContext, query: string) {
  const statusMsg = await ctx.reply(ctx.t("searching-target"));
  await ctx.replyWithChatAction("typing");

  const searchParams = await parseTargetQuery(ctx.services.openaiApiKey, query);
  const result = await callTool(ctx, "search_by_target", searchParams);

  await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);
  await formatAndReplySearch(ctx, result);
}

async function showTargetUsage(ctx: BotContext) {
  setPendingAction(ctx, "by_target");
  await ctx.reply(ctx.t("target-usage"));
}

// ❌ УДАЛЯЕМ handleByTargetWithText полностью
```

---

#### Шаг 2: Аналогично by-adhoc.ts, by-current.ts

```typescript
// by-adhoc.ts
export async function handleByAdhoc(ctx: BotContext) { ... }
export async function processAdhocQuery(ctx: BotContext, query: string) { ... }
// Удаляем handleByAdhocWithText

// by-current.ts
export async function handleByCurrent(ctx: BotContext) { ... }
export async function processCurrentQuery(ctx: BotContext, query: string) { ... }
// Удаляем handleByCurrentWithText
```

---

#### Шаг 3: Обновить input-router.ts

```typescript
// input-router.ts

// Было:
import { handleByAdhocWithText } from "./by-adhoc.js";
import { handleByCurrentWithText } from "./by-current.js";
import { handleByTargetWithText } from "./by-target.js";

const handlers: Record<PendingAction, (ctx: BotContext, text: string) => Promise<void>> = {
  story: handleStoryWithText,
  by_target: handleByTargetWithText,
  by_adhoc: handleByAdhocWithText,
  by_current: handleByCurrentWithText,
};

// Станет:
import { processAdhocQuery } from "./by-adhoc.js";
import { processCurrentQuery } from "./by-current.js";
import { processTargetQuery } from "./by-target.js";
import { handleStoryWithText } from "./story.js";

const handlers: Record<PendingAction, (ctx: BotContext, text: string) => Promise<void>> = {
  story: handleStoryWithText,
  by_target: processTargetQuery,   // ✅ Прямой вызов
  by_adhoc: processAdhocQuery,     // ✅ Прямой вызов
  by_current: processCurrentQuery, // ✅ Прямой вызов
};
```

---

#### Шаг 4: Quality Gates

```bash
npm run lint
npx tsc --noEmit
# Проверить что все работает (manual testing или unit tests)
```

---

### Зачем Это Нужно?

**До рефакторинга:**
- 3 файла × 3 функции = 9 функций
- Дублирование обёрток (`handleByTargetWithText` просто вызывает `performTargetSearch`)

**После рефакторинга:**
- 3 файла × 2 функции = 6 функций (убрали 3 обёртки)
- Прямые вызовы из `input-router`
- Код чище, проще поддерживать

---

## 4. Мои Вопросы

### Вопрос 1: i18n vs LLM — Что Делаем?

**Варианты:**

A. **Оставить как сейчас** (i18n везде, LLM только `formatSearchResult`)
   - Плюсы: просто, быстро, дешево
   - Минусы: робот-стиль

B. **Гибридный подход** (i18n для ошибок/инструкций, LLM для status/приветствий)
   - Плюсы: баланс естественности и надежности
   - Минусы: чуть сложнее

C. **Максимум LLM** (LLM везде кроме ошибок)
   - Плюсы: максимальная естественность
   - Минусы: дорого, медленно, непредсказуемо

**Твое решение:** A / B / C ?

**Если B (гибридный), то конкретно где добавить LLM:**
- [ ] Status messages (`searching-target`, `searching-adhoc`, `searching-current`)
- [ ] Контекстные приветствия (после долгой паузы, после /story)
- [ ] Success messages (`link-success`, `cancel-success`)
- [ ] Другое (укажи что)

---

### Вопрос 2: Handlers — Сейчас Рефакторить?

**Варианты:**

A. **Да, доделать Фазу 3 сейчас** (убрать `handleByTargetWithText`, экспортировать `process*Query`)
   - Займет 10-15 минут
   - Закроет рудимент из старого плана

B. **Нет, оставить как есть** (работает, не критично)
   - Сосредоточиться на TELEGRAM-BOT-REFACTORING-PLAN.md (Production Readiness)

**Твое решение:** A / B ?

---

### Вопрос 3: Приоритеты Работы

**Что делать дальше:**

A. **Доделать REFACTOR-PLAN.md** (Фаза 3: убрать handlers прокси)
B. **Начать TELEGRAM-BOT-REFACTORING-PLAN.md Фазу 1** (Request Timeout, TTL, Graceful Shutdown)
C. **Обсудить i18n vs LLM детально**, потом реализовать
D. **Другое** (укажи что)

**Твое решение:** A / B / C / D ?

---

## Итог

**Зафиксировано в TELEGRAM-BOT-REFACTORING-PLAN.md:**
- ✅ sessionId кэширование (TTL 30 мин, отдельный Redis ключ)
- ✅ Health Check (проверка на старте, БЕЗ HTTP endpoint)
- ✅ Username/FirstName (НЕ отправлять в Facade)
- ✅ Handlers дублирование (пункт 15, план рефакторинга)
- ✅ i18n vs LLM стратегия (гибридный подход рекомендован)

**Жду твоих ответов на вопросы 1-3!** 🚀
