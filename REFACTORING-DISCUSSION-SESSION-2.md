# Рефакторинг Telegram Bot — Обсуждение Сессия 2

> **Дата**: 2025-12-08
> **Статус**: Обсуждение принятых решений

---

## Принятые Решения

### 1. i18n vs LLM — Гибридный Подход

**Твое решение:**
> "я хотел бы чтобы nlp от coldstart тоже обрабатывалась мб, все результаты поиска в nlp. всё остальное всё же можно в шаблон, а ну и приветствие тоже в llm."

**Финальная стратегия:**

| Тип сообщения | Метод | Реализация |
|---------------|-------|------------|
| **Приветствия** (`/start`) | **LLM** | `generateWelcomeMessage()` — персонализация с hasStory/userName |
| **Результаты поиска** | **LLM** ✅ | Уже реализовано (`formatSearchResult`) |
| **cold_start результаты** | **LLM** 🆕 | `formatColdStartMessage()` — обработка ответов LangGraph |
| Ошибки | i18n | Шаблоны (четкость, предсказуемость) |
| Инструкции (/help, usage) | i18n | Шаблоны (точность команд) |
| Callback feedback | i18n | Шаблоны (быстро, просто) |
| Status messages (`searching-*`) | i18n | Шаблоны (простота, быстрота) |

**Зафиксировано в плане:** ✅ Раздел "i18n vs LLM — Финальная Стратегия"

---

### 2. Handlers Рефакторинг

**Твое решение:**
> "Вопрос 2: Handlers — Сейчас Рефакторить? - сейчас планируем в доке рефакторинга"

**Что делаем:**
- ✅ Добавлено в план как **Фаза 0** (доделать старый план REFACTOR-PLAN.md)
- Убрать обертки: `handleByTargetWithText`, `handleByAdhocWithText`, `handleByCurrentWithText`
- Экспортировать: `processTargetQuery`, `processAdhocQuery`, `processCurrentQuery`
- Обновить `input-router.ts` — прямые вызовы вместо оберток

**Зафиксировано в плане:** ✅ Раздел "Приоритеты Реализации → Фаза 0"

---

### 3. Приоритеты Работы

**Твое решение:**
> "Вопрос 3: Приоритеты Работы - в новом плане запланировать доделать этот шаг из старого"

**Порядок фаз:**
1. **Фаза 0** — Доделать handlers (быстрый рефакторинг, без зависимостей)
2. **Фаза 1** — Production Readiness (timeout, TTL, graceful shutdown, health check)
3. **Фаза 2** — Архитектурные изменения (response schemas, tool registry, discriminated union)
4. **Фаза 3** — ООП рефакторинг (McpClient, SessionService, SearchPresenter)
5. **Фаза 4** — LLM Integration (приветствия, cold_start formatter)
6. **Фаза 5** — Error Handling
7. **Фаза 6** — Security (webhook secret)

**Зафиксировано в плане:** ✅ Раздел "Приоритеты Реализации"

---

## Детальный Анализ Новой Функциональности

### 1. Приветствие через LLM

**Текущая реализация (i18n):**
```typescript
// handlers/start.ts
await ctx.reply(ctx.t("welcome"));

// locales/ru.ftl
welcome = Добро пожаловать в WayMates!

    Я помогу найти карьерные пути на основе опыта похожих специалистов.

    Доступные команды:
    /story — Начать сбор карьерной истории
    /by_target — Поиск по целевой позиции
    /by_current — Поиск похожих на меня
    /by_adhoc — Поиск по произвольному профилю
    /help — Справка

    Начнём с /story — расскажите о своём опыте!
```

**Новая реализация (LLM):**
```typescript
// services/live-messages.ts
export async function generateWelcomeMessage(params: {
  hasStory: boolean;
  language: string;
  userName?: string;
}): Promise<string> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });

  const prompt = `You are a career assistant for WayMates platform.

User just started conversation. Greet them warmly and explain:
- Platform helps find career paths based on similar professionals
- Available commands: /story, /by_target, /by_current, /by_adhoc
- ${params.hasStory ? "User has story → suggest search commands" : "Suggest starting with /story"}

${params.userName ? `User name: ${params.userName}` : ""}
Language: ${params.language === "en" ? "English" : "Russian"}
Tone: friendly, concise (3-4 sentences)
Format: Plain text, use emojis sparingly`;

  const response = await llm.invoke(prompt);
  return response.content;
}

// handlers/start.ts
const welcomeMsg = await generateWelcomeMessage({
  hasStory: ctx.session.status === "initialised" ? ctx.session.hasStory : false,
  language: ctx.from?.language_code ?? "ru",
  userName: ctx.from?.first_name,
});
await ctx.reply(welcomeMsg);
```

**Плюсы:**
- ✅ Персонализация (имя пользователя, hasStory)
- ✅ Естественный диалог
- ✅ Разнообразие (не одинаковый текст каждый раз)

**Минусы:**
- ❌ Медленнее (1-2 секунды)
- ❌ Дороже (OpenAI API расходы)
- ❌ Может забыть упомянуть команду

---

### 2. cold_start Результаты через LLM

**Текущая реализация:**
```typescript
// handlers/story.ts
const data = parseJsonContent<ColdStartResponse>(result);

if (data.phase === "COLLECTING") {
  await ctx.reply(data.message); // ← Сырой текст от Facade
}
```

**Пример сырого текста от Facade:**
```
"Расскажите о вашей текущей позиции и опыте работы"
```

**Новая реализация (LLM):**
```typescript
// formatters/cold-start.ts
export async function formatColdStartMessage(params: {
  phase: "COLLECTING" | "CONFIRMATION" | "COMPLETED";
  message: string;
  language: string;
}): Promise<string> {
  const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });

  const prompt = `You are a career assistant helping user share their career story.

Phase: ${params.phase}
Raw message from system: ${params.message}

Rewrite the message in a friendly, natural tone.
Language: ${params.language === "en" ? "English" : "Russian"}
Format: Plain text, 2-3 sentences max
Use emoji sparingly

${params.phase === "COLLECTING" ? "Encourage user to share more details" : ""}
${params.phase === "CONFIRMATION" ? "Ask user to confirm or edit" : ""}
${params.phase === "COMPLETED" ? "Congratulate and suggest next steps" : ""}`;

  const response = await llm.invoke(prompt);
  return response.content;
}

// handlers/story.ts
const formattedMsg = await formatColdStartMessage({
  phase: data.phase,
  message: data.message,
  language: ctx.from?.language_code ?? "ru",
});
await ctx.reply(formattedMsg);
```

**Пример результата:**
```
"💼 Отлично! Теперь расскажите подробнее о вашей текущей позиции.
Какой опыт работы у вас есть?"
```

**Плюсы:**
- ✅ Естественный диалог (не робот)
- ✅ Адаптация под фазу (COLLECTING → поощрение, COMPLETED → поздравление)
- ✅ Персонализация под язык

**Минусы:**
- ❌ Медленнее (каждый ответ от cold_start → +1-2 секунды)
- ❌ Дороже (OpenAI API)

---

## Вопросы для Обсуждения

### Вопрос 1: cold_start Formatter — Обработка CONFIRMATION Фазы

**Контекст:**
В фазе `CONFIRMATION` Facade возвращает сообщение + инлайн-кнопки (Подтвердить/Редактировать/Отмена).

**Текущий код:**
```typescript
// handlers/story.ts
if (data.phase === "CONFIRMATION") {
  await ctx.reply(data.message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: ctx.t("button-approve"), callback_data: "decision:approve" },
          { text: ctx.t("button-edit"), callback_data: "decision:edit" },
        ],
        [{ text: ctx.t("button-cancel"), callback_data: "decision:cancel" }],
      ],
    },
  });
}
```

**Вопрос:**
Если мы форматируем `data.message` через LLM, может ли LLM изменить смысл так, что кнопки станут неактуальными?

**Варианты:**

**A) Форматировать все фазы через LLM:**
```typescript
const formattedMsg = await formatColdStartMessage({
  phase: data.phase,
  message: data.message,
  language: ctx.from?.language_code ?? "ru",
});

if (data.phase === "CONFIRMATION") {
  await ctx.reply(formattedMsg, { reply_markup: ... });
} else {
  await ctx.reply(formattedMsg);
}
```

**Риск:** LLM может переформулировать так, что кнопки не подходят.

**B) Не форматировать CONFIRMATION:**
```typescript
if (data.phase === "CONFIRMATION") {
  // Используем сырое сообщение от Facade
  await ctx.reply(data.message, { reply_markup: ... });
} else {
  // Форматируем только COLLECTING и COMPLETED
  const formattedMsg = await formatColdStartMessage(...);
  await ctx.reply(formattedMsg);
}
```

**Плюс:** Гарантия что кнопки подходят к тексту.

**C) LLM с жесткими инструкциями для CONFIRMATION:**
```typescript
const prompt = `...
${params.phase === "CONFIRMATION" ?
  "Ask user to confirm or edit. KEEP the meaning clear for buttons: Approve/Edit/Cancel" :
  ""}`;
```

**ПРИНЯТО:** ✅ **Вариант B** — Не форматировать CONFIRMATION

**Реализация:**
```typescript
if (data.phase === "CONFIRMATION") {
  // Сырое сообщение от Facade (гарантия соответствия кнопкам)
  await ctx.reply(data.message, { reply_markup: ... });
} else {
  // Форматируем только COLLECTING и COMPLETED
  const formattedMsg = await formatColdStartMessage({
    phase: data.phase,
    message: data.message,
    language: ctx.from?.language_code ?? "ru",
  });
  await ctx.reply(formattedMsg);
}
```

---

### Вопрос 2: Приветствие LLM — Кэширование или Генерация Каждый Раз?

**Контекст:**
Пользователь может вызывать `/start` несколько раз (например, чтобы увидеть команды).

**Варианты:**

**A) Генерировать каждый раз:**
```typescript
// Каждый /start → новый вызов OpenAI
const welcomeMsg = await generateWelcomeMessage(...);
```

**Плюсы:** Разнообразие, персонализация (можно добавить время дня, контекст)
**Минусы:** Дорого, медленно

**B) Кэшировать на 24 часа:**
```typescript
const cacheKey = `telegram:welcome:${ctx.from.id}`;
let welcomeMsg = await redis.get(cacheKey);

if (!welcomeMsg) {
  welcomeMsg = await generateWelcomeMessage(...);
  await redis.setex(cacheKey, 86400, welcomeMsg); // 24 часа
}

await ctx.reply(welcomeMsg);
```

**Плюсы:** Дешевле, быстрее
**Минусы:** Меньше разнообразия

**C) Первый раз LLM, повторные — i18n fallback:**
```typescript
if (isFirstStart) {
  const welcomeMsg = await generateWelcomeMessage(...);
  await ctx.reply(welcomeMsg);
} else {
  await ctx.reply(ctx.t("welcome-repeat")); // Шаблон для повторных /start
}
```

**Плюсы:** Баланс естественности и экономии
**Минусы:** Нужна логика определения "первого раза"

**ПРИНЯТО:** ✅ **Вариант A** — Генерировать каждый раз (пока так)

**Реализация:**
```typescript
// Каждый /start → свежая генерация
const welcomeMsg = await generateWelcomeMessage({
  hasStory: ctx.session.status === "initialised" ? ctx.session.hasStory : false,
  language: ctx.from?.language_code ?? "ru",
  userName: ctx.from?.first_name,
});
await ctx.reply(welcomeMsg);
```

**Примечание:** Можем позже добавить кэширование если расходы будут высокими.

---

### Вопрос 3: Фаза 0 — Начать Сейчас?

**Контекст:**
Фаза 0 (handlers рефакторинг) — простая задача, без зависимостей.

**Варианты:**

**A) Начать сейчас:**
- Быстро доделать (30-40 минут)
- Очистить технический долг перед основными фазами
- Качество gates (lint, tsc)

**B) Запланировать на потом:**
- Сначала обсудить все детали LLM integration
- Потом делать все фазы подряд

**ПРИНЯТО:** ✅ **Вариант B** — НЕ начинать сейчас

**Причина:** Нужно актуализировать промпт команду `/refactor-telegram-bot` перед началом работы.

**Следующий шаг:** Обновить `.claude/commands/refactor-telegram-bot.md`

---

## Дополнительные Вопросы

### Вопрос 4: Fallback для LLM Ошибок

**Контекст:**
Если OpenAI API недоступен (rate limit, network error), что делать?

**Варианты:**

**A) Показать ошибку пользователю:**
```typescript
try {
  const welcomeMsg = await generateWelcomeMessage(...);
  await ctx.reply(welcomeMsg);
} catch (error) {
  await ctx.reply(ctx.t("error-generic"));
}
```

**B) Fallback на i18n шаблон:**
```typescript
try {
  const welcomeMsg = await generateWelcomeMessage(...);
  await ctx.reply(welcomeMsg);
} catch (error) {
  logger.warn({ err: error }, "Failed to generate welcome via LLM, using i18n fallback");
  await ctx.reply(ctx.t("welcome")); // ← i18n fallback
}
```

**C) Retry + fallback:**
```typescript
const welcomeMsg = await generateWelcomeMessage(...).catch(async (error) => {
  logger.warn({ err: error }, "LLM failed, retrying once");
  return await generateWelcomeMessage(...).catch(() => {
    logger.error("LLM failed twice, using i18n fallback");
    return ctx.t("welcome");
  });
});
```

**ПРИНЯТО:** ✅ **Вариант A** — Показать ошибку пользователю (пока так)

**Реализация:**
```typescript
try {
  const welcomeMsg = await generateWelcomeMessage(...);
  await ctx.reply(welcomeMsg);
} catch (error) {
  logger.error({ err: error }, "Failed to generate welcome message");
  await ctx.reply(ctx.t("error-generic"));
}
```

**Примечание:** Можем позже добавить retry или i18n fallback.

---

### Вопрос 5: LLM Model Selection

**Контекст:**
Для форматирования используем `gpt-4o-mini`.

**Вопрос:** Достаточно ли mini для приветствий и cold_start? Или нужно `gpt-4o` для лучшего качества?

**Сравнение:**

| Модель | Цена (input/output) | Качество | Скорость |
|--------|---------------------|----------|----------|
| gpt-4o-mini | $0.15 / $0.6 за 1M токенов | Хорошее | Быстро |
| gpt-4o | $2.5 / $10 за 1M токенов | Отличное | Медленнее |

**Расчет для 1000 пользователей/день:**
- Приветствие: ~200 токенов (input) + 100 токенов (output) = 300 токенов
- 1000 пользователей × 300 токенов = 300,000 токенов

**gpt-4o-mini:** $0.15 × 0.2 + $0.6 × 0.1 = **$0.09/день** = **$2.7/месяц**
**gpt-4o:** $2.5 × 0.2 + $10 × 0.1 = **$1.5/день** = **$45/месяц**

**ПРИНЯТО:** ✅ **gpt-4o-mini достаточно**

**Реализация:**
```typescript
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: apiKey,
});
```

**Расчет затрат:** ~$2.7/месяц для 1000 пользователей/день (приемлемо).

---

## Следующие Шаги

### ✅ Все Вопросы Закрыты!

**Принятые решения:**
1. ✅ cold_start CONFIRMATION — не форматировать через LLM
2. ✅ Приветствие — генерировать каждый раз (пока без кэша)
3. ✅ Фаза 0 — НЕ начинать, сначала актуализировать `/refactor-telegram-bot`
4. ✅ Fallback — показать ошибку (пока без i18n fallback)
5. ✅ Model — gpt-4o-mini

### Следующий Этап

1. ⏳ **Актуализировать** `.claude/commands/refactor-telegram-bot.md`
2. ⏳ **Ревью плана** — проверить конфликты, рациональность, полноту
3. ⏳ **Начать реализацию** после утверждения плана

**Статус:** Готов к глубокому ревью плана 🚀
