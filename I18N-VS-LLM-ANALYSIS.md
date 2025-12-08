# i18n vs LLM — Детальный Анализ

## Текущие Сообщения (по типам)

### 1. Ошибки

| Ключ | Текущий текст | Метод | Оставить? |
|------|---------------|-------|-----------|
| `error-generic` | "Произошла непредвиденная ошибка. Попробуйте позже." | **i18n** | ✅ **ДА** |
| `session-expired` | "Ваша сессия истекла. Используйте /start для повторной регистрации." | **i18n** | ✅ **ДА** |

**Обоснование:**
- Ошибки должны быть **четкими и предсказуемыми**
- Пользователь в стрессе → нужен понятный текст
- LLM может сгенерировать что-то странное → хуже UX

**Рекомендация:** Оставить i18n.

---

### 2. Инструкции и Help

| Ключ | Текущий текст | Метод | Оставить? |
|------|---------------|-------|-----------|
| `help` | "Команды WayMates\n\nНачало работы:\n/start — Регистрация\n..." | **i18n** | ✅ **ДА** |
| `target-usage` | "Поиск по целевой позиции\n\nОпишите кем хотите стать:\n/by_target Senior ML Engineer в финтехе..." | **i18n** | ✅ **ДА** |
| `adhoc-usage` | "Поиск по произвольному контексту\n\n..." | **i18n** | ✅ **ДА** |
| `current-usage` | "Поиск по вашему текущему профилю\n\n..." | **i18n** | ✅ **ДА** |

**Обоснование:**
- Инструкции должны быть **точными** (команды, примеры)
- LLM может перефразировать `/by_target` → `/target` (ошибка!)
- Пользователи копируют примеры → должны быть стабильными

**Рекомендация:** Оставить i18n.

---

### 3. Приветствия и Welcome

| Ключ | Текущий текст | Метод | Заменить на LLM? |
|------|---------------|-------|------------------|
| `welcome` | "Добро пожаловать в WayMates!\n\nЯ помогу найти карьерные пути на основе опыта похожих специалистов.\n\nДоступные команды:\n/story — Начать сбор карьерной истории\n/by_target — Поиск по целевой позиции\n..." | **i18n** | ⚠️ **СПОРНО** |

**Текущий подход (i18n):**
```typescript
// handlers/start.ts
await ctx.reply(ctx.t("welcome"));
```

**Вариант с LLM:**
```typescript
const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });
const prompt = `You are a career assistant for WayMates platform.

User just started conversation. Greet them warmly and explain:
- Platform helps find career paths based on similar professionals
- Available commands: /story, /by_target, /by_current, /by_adhoc
- Suggest starting with /story

Language: ${ctx.from?.language_code === "en" ? "English" : "Russian"}
Tone: friendly, concise (3-4 sentences)
Format: Plain text, use emojis sparingly

IMPORTANT: Do NOT use template phrases like "Hello! I'm here to help"`;

const response = await llm.invoke(prompt);
await ctx.reply(response.content);
```

**Плюсы LLM:**
- ✅ Естественный диалог (не робот)
- ✅ Можно персонализировать (если `hasStory === true` → другое приветствие)
- ✅ Разнообразие (каждый раз немного другой текст)

**Минусы LLM:**
- ❌ Медленнее (1-2 секунды)
- ❌ Дороже (OpenAI API)
- ❌ Может забыть упомянуть важную команду

**Рекомендация:** **Оставить i18n для /start**, но добавить LLM для контекстных приветствий.

**Пример контекстного приветствия:**
```typescript
// Пользователь вернулся через неделю → персонализированное приветствие
if (daysSinceLastVisit > 7 && ctx.session.hasStory) {
  const greeting = await generateLiveGreeting({
    hasStory: true,
    lastVisit: daysSinceLastVisit,
    language: ctx.from?.language_code,
  });
  await ctx.reply(greeting);
}
```

---

### 4. Результаты Поиска

| Компонент | Текущий метод | Оставить? |
|-----------|---------------|-----------|
| `formatSearchResult` | **LLM** (gpt-4o-mini) | ✅ **ДА** |

**Текущая реализация:**
```typescript
// formatters/search.ts
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: apiKey,
});

const prompt = `You are a friendly career consultant in a Telegram bot.

Task: Present career path search results in a warm, human tone.

Rules:
- Use emojis sparingly (📊 🎯 💼 🔧 📍)
- Format with Markdown (bold **text**, lists)
- Each path should be a separate block
- Highlight similarity percentage and key skills
- Add a short intro (1-2 sentences)
- Avoid template phrases like "Here's what I found"
- Show top 5 results maximum
- If no results, say it naturally
- IMPORTANT: Respond in ${languageCode}`;
```

**Обоснование:**
- ✅ Результаты поиска — **контентное сообщение**, естественность важна
- ✅ LLM лучше форматирует JSON → читаемый текст
- ✅ Адаптирует тон под язык (RU/EN разные культуры)

**Рекомендация:** Оставить LLM.

---

### 5. Подтверждения и Статусы

| Ключ | Текущий текст | Метод | Заменить на LLM? |
|------|---------------|-------|------------------|
| `story-confirmed` | "Подтверждено" | **i18n** | ✅ **ДА** (оставить i18n) |
| `story-cancelled` | "Сбор истории отменён. Начните заново с /story" | **i18n** | ✅ **ДА** |
| `cancel-success` | "Операция отменена. Вы можете начать заново с /story" | **i18n** | ✅ **ДА** |
| `callback-processing` | "Обработка..." | **i18n** | ✅ **ДА** |
| `searching-target` | "Ищу тех, кто уже достиг похожей цели..." | **i18n** | ⚠️ **СПОРНО** |
| `searching-adhoc` | "Ищу похожие карьерные пути..." | **i18n** | ⚠️ **СПОРНО** |
| `searching-current` | "Ищу похожие карьерные пути на основе вашего профиля..." | **i18n** | ⚠️ **СПОРНО** |

**Обоснование:**
- **Callback feedback** (`Обработка...`, `Подтверждено`) → быстро, просто, i18n OK
- **Status messages** (`Ищу тех, кто...`) → можно LLM для разнообразия

**Вариант с LLM для status:**
```typescript
// Вместо:
await ctx.reply(ctx.t("searching-target"));

// Можно:
const statusMsg = await generateSearchingStatus({
  type: "by_target",
  query: "ML Engineer в финтехе",
  language: ctx.from?.language_code,
});
await ctx.reply(statusMsg);
// Результат: "Ищу специалистов, которые уже стали ML Engineer в финтехе..."
```

**Рекомендация:**
- Callback feedback → i18n (быстро, просто)
- Status messages → **можно LLM** (естественность, персонализация)

---

### 6. Story Dialogs

| Ключ | Текущий текст | Метод | Заменить на LLM? |
|------|---------------|-------|------------------|
| `story-prompt` | "Расскажите о своей карьерной истории:\n\nНапример:\nРаботал backend разработчиком в Яндексе с 2020 по 2023, писал на Python и Go.\nПотом перешёл в стартап на позицию Tech Lead...\n\nВы можете отправить текст или голосовое сообщение." | **i18n** | ⚠️ **СПОРНО** |
| `story-edit-prompt` | "Введите изменения к вашей карьерной истории:" | **i18n** | ✅ **ДА** (оставить i18n) |
| `story-approved` | "{ $message }\n\nТеперь вы можете:\n• /by_target — Поиск по целевой позиции\n• /by_current — Поиск похожих на меня\n• /by_adhoc — Поиск по произвольному профилю\n• /story — Добавить ещё контекстов" | **Гибрид** (LLM message + i18n список) | ⚠️ **СПОРНО** |

**story-prompt:**
- Примеры должны быть **стабильными** (пользователи копируют)
- Инструкции должны быть **точными**
- **Рекомендация:** Оставить i18n

**story-approved:**
- `$message` — от Facade (может быть сгенерирован LLM)
- Список команд — должен быть точным
- **Рекомендация:** Гибрид (как сейчас)

---

### 7. Navigation и Errors

| Ключ | Текущий текст | Метод | Заменить на LLM? |
|------|---------------|-------|------------------|
| `action-required` | "Сначала выберите действие:\n\n/story — Рассказать карьерную историю\n/by_target — Поиск по целевой позиции\n/by_current — Поиск по моему профилю\n/by_adhoc — Поиск по произвольному профилю" | **i18n** | ✅ **ДА** (оставить i18n) |
| `story-required` | "Сначала расскажите карьерную историю!\n\nИспользуйте /story для начала." | **i18n** | ✅ **ДА** |
| `link-usage` | "Привязка LibreChat аккаунта\n\nИспользование:\n/link <ваш_token>\n\nТокен можно получить в LibreChat через команду /token" | **i18n** | ✅ **ДА** |
| `link-success` | "Аккаунты успешно привязаны! Теперь вы можете использовать бота." | **i18n** | ⚠️ **СПОРНО** |

**Обоснование:**
- Команды и инструкции → i18n (точность)
- Success сообщения → можно LLM (естественность)

**Рекомендация:**
- `action-required`, `story-required`, `link-usage` → i18n
- `link-success` → можно LLM

---

## Итоговая Таблица: Что Оставить i18n, Что Заменить на LLM

| Тип сообщения | Примеры | Метод | Обоснование |
|---------------|---------|-------|-------------|
| **Ошибки** | `error-generic`, `session-expired` | **i18n** | Четкость, предсказуемость |
| **Инструкции** | `help`, `target-usage`, `link-usage` | **i18n** | Точность команд и примеров |
| **Приветствия (первое)** | `welcome` | **i18n** | Стабильность, быстрота |
| **Приветствия (контекстные)** | После долгой паузы, после завершения /story | **LLM** | Персонализация |
| **Результаты поиска** | `formatSearchResult` | **LLM** ✅ | Естественность, адаптация |
| **Callback feedback** | `story-confirmed`, `callback-processing` | **i18n** | Быстро, просто |
| **Status messages** | `searching-target`, `searching-adhoc` | **LLM** (опционально) | Разнообразие, персонализация |
| **Story dialogs** | `story-prompt`, `story-edit-prompt` | **i18n** | Стабильные примеры |
| **Success messages** | `link-success`, `cancel-success` | **LLM** (опционально) | Естественность |

---

## Рекомендованная Реализация

### Вариант 1: Минимальный (только критичные места)

**Оставить i18n везде**, кроме:
- ✅ `formatSearchResult` (уже LLM)

**Плюсы:** Просто, быстро, дешево
**Минусы:** Робот-стиль

---

### Вариант 2: Гибридный (рекомендую)

**i18n:**
- Ошибки
- Инструкции (/help, usage)
- Callback feedback
- Story prompts

**LLM:**
- ✅ `formatSearchResult` (уже реализовано)
- 🆕 Status messages (`searching-*`) — генерировать с контекстом запроса
- 🆕 Контекстные приветствия (если пользователь вернулся через неделю)

**Плюсы:** Баланс естественности и надежности
**Минусы:** Чуть сложнее

---

### Вариант 3: Максимальный LLM

**LLM везде**, кроме:
- Ошибки (i18n)
- Команды в инструкциях (i18n)

**Плюсы:** Максимальная естественность
**Минусы:** Дорого, медленно, непредсказуемо

---

## Мои Рекомендации

**Вариант 2 (Гибридный):**

1. **Оставить i18n:**
   - Ошибки, инструкции, callback feedback → как сейчас

2. **Добавить LLM:**
   - Status messages (`searching-*`) → персонализировать с запросом
   - Контекстные приветствия → после долгой паузы или завершения /story

3. **Создать утилиту:**
   ```typescript
   // utils/live-messages.ts
   export async function generateSearchingStatus(params: {
     type: "by_target" | "by_adhoc" | "by_current";
     query?: string;
     language: string;
   }): Promise<string> {
     const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });
     const prompt = buildSearchingPrompt(params);
     const response = await llm.invoke(prompt);
     return response.content;
   }
   ```

**Хочешь обсудить конкретную реализацию?**
