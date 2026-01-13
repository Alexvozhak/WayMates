# Отчёт: Ревью рефакторинга Telegram Bot

**Дата**: 2025-12-09
**Проверяемый код**: feature/telegram-bot branch
**План рефакторинга**: TELEGRAM-BOT-REFACTORING-PLAN.md

---

## 📊 Обзорный фидбек

### Что сделано хорошо ✅

1. **ООП архитектура реализована корректно**:
   - McpClient, SessionService, SearchPresenter созданы и работают
   - Dependency Injection через BotServices
   - Все 6 handlers обновлены на ООП стиль

2. **Template Method pattern применён правильно**:
   - BasePresenter как абстрактный класс
   - SearchPresenter и ColdStartPresenter наследуют
   - Код переиспользуется, дублирование минимизировано

3. **API несоответствие Bot ↔ Facade исправлено**:
   - coldStartResponseSchema импортируется из Facade (Single Source of Truth)
   - Нет хардкода фаз в Bot коде
   - Zod валидация работает

4. **Production readiness внедрена**:
   - Request timeout (30 сек)
   - Graceful shutdown (Redis + Bot)
   - Session TTL 7 дней
   - sessionId кэширование 30 мин

5. **Quality gates проходят**:
   - `npx tsc --noEmit` - ✅ без ошибок
   - `npm run lint` - ✅ без ошибок (8 warnings в core/, НЕ в telegram-bot/)

### Критические проблемы 🚨

1. **Мёртвый код (рудименты)**:
   - `formatters/search.ts` - не используется
   - `services/llm-formatter.ts` - не используется
   - `services/mcp-utils.ts` - частично мёртв

2. **Фаза 4 не завершена**:
   - План: LLM генерация приветствия `/start`
   - Реальность: используется i18n `ctx.t("welcome")`
   - ColdStartPresenter работает, но generateWelcomeMessage отсутствует

3. **План устарел**:
   - План показывает фазы: `COLLECTING`, `CONFIRMATION`, `COMPLETED`
   - Реальность: `story_gathering`, `awaiting_*`, `saved`, `failed`
   - Хорошо что Bot импортирует схему из Facade, иначе был бы критический баг

---

## 🗑️ Проблема 1: Мёртвый код (рудименты)

### Детали

Обнаружены 3 файла с неиспользуемым кодом:

1. **`src/telegram-bot/formatters/search.ts`**:
   - Функция `formatSearchResult()` - функциональный стиль
   - Дублирует логику `SearchPresenter`
   - Используется 0 раз (grep показывает только сам файл)

2. **`src/telegram-bot/services/llm-formatter.ts`**:
   - Класс `LlmFormatter` - промежуточная версия
   - Заменён на `BasePresenter`
   - Используется 0 раз

3. **`src/telegram-bot/services/mcp-utils.ts`**:
   - Функция `parseJsonContent()` - nullable версия
   - McpClient имеет свою throwing версию
   - `extractTextContent()` используется только в мёртвом `formatters/search.ts`

### Причины

Эволюция архитектуры:
```
Функциональный стиль (search.ts)
  ↓
Промежуточный класс (LlmFormatter)
  ↓
Финальная архитектура (BasePresenter + SearchPresenter/ColdStartPresenter)
```

Старые файлы не удалены после рефакторинга.

### Последствия

1. **Confusion для разработчиков**: 3 способа сделать одно и то же
2. **Дублирование `mapLanguageCode`**: 3 раза в кодебазе
3. **Код сложнее поддерживать**: нужно понять какой файл актуален
4. **Нарушение DRY**: логика форматирования в 3 местах

### Варианты решений

#### Вариант A: Удалить все рудиментарные файлы

**Описание**:
```bash
rm src/telegram-bot/formatters/search.ts
rm src/telegram-bot/services/llm-formatter.ts
rm src/telegram-bot/services/mcp-utils.ts
```

**Плюсы**:
- ✅ Чистая кодебаза
- ✅ Нет дублирования
- ✅ Понятная архитектура

**Минусы**:
- ❌ mcp-utils.ts может понадобиться для других утилит в будущем

**Рекомендация**: ⭐ РЕКОМЕНДУЕТСЯ

#### Вариант B: Оставить mcp-utils.ts, удалить остальные

**Описание**:
```bash
rm src/telegram-bot/formatters/search.ts
rm src/telegram-bot/services/llm-formatter.ts
# mcp-utils.ts оставить "на всякий случай"
```

**Плюсы**:
- ✅ Утилиты сохранены
- ✅ Основные рудименты удалены

**Минусы**:
- ❌ mcp-utils.ts всё равно не используется сейчас
- ❌ YAGNI нарушается (You Ain't Gonna Need It)

**Рекомендация**: ❌ НЕ рекомендуется

### Финальное решение

**Вариант A** - удалить все 3 файла.

**Обоснование**:
1. BasePresenter покрывает все use cases
2. Если понадобятся утилиты - создадим заново (YAGNI)
3. mcp-utils.ts можно восстановить из git history если нужно

---

## ⚠️ Проблема 2: Фаза 4 (LLM integration) не завершена

### Детали

**План (TELEGRAM-BOT-REFACTORING-PLAN.md, строки 789-832)**:
```typescript
// services/live-messages.ts
export async function generateWelcomeMessage(params: {
  hasStory: boolean;
  language: string;
  userName?: string;
}): Promise<string> { ... }

// handlers/start.ts
const welcomeMsg = await generateWelcomeMessage({
  hasStory: ctx.session.status === "initialised" ? ctx.session.hasStory : false,
  language: ctx.from?.language_code ?? "ru",
  userName: ctx.from?.first_name,
});
await ctx.reply(welcomeMsg);
```

**Реальность (handlers/start.ts, строка 8)**:
```typescript
await ctx.reply(ctx.t("welcome"));
```

### Причины

Фаза 4 частично реализована:
- ✅ ColdStartPresenter работает для `/story`
- ❌ generateWelcomeMessage НЕ реализована для `/start`

Возможно:
1. Забыли доделать
2. Решили оставить i18n для `/start` (но не обновили план)
3. Фокус был на ColdStartPresenter (более критично)

### Последствия

1. **Несоответствие плану**: пользователь думает фаза выполнена, но это не так
2. **Упущенная функциональность**: `/start` остаётся шаблонным
3. **Inconsistency**: `/story` через LLM, `/start` через i18n

### Варианты решений

#### Вариант A: Реализовать generateWelcomeMessage как в плане

**Описание**:
- Создать `services/welcome-message.ts`
- Функция `generateWelcomeMessage()` с LLM (gpt-4o-mini)
- Обновить `handlers/start.ts`

**Плюсы**:
- ✅ План выполнен полностью
- ✅ Consistency: все ответы через LLM
- ✅ Более естественные приветствия

**Минусы**:
- ❌ LLM latency на `/start` (400-800ms)
- ❌ Дополнительный API call при каждом `/start`
- ❌ Приветствие не требует персонализации (стандартная инфа)

**Рекомендация**: ❌ НЕ рекомендуется

#### Вариант B: Использовать BasePresenter для приветствия

**Описание**:
```typescript
export class WelcomePresenter extends BasePresenter {
  protected createPrompt(rawJson: string, language: string): string {
    return `You are a career assistant for WayMates platform.
    ...`;
  }
}
```

**Плюсы**:
- ✅ Переиспользуем BasePresenter
- ✅ Consistency с ColdStartPresenter/SearchPresenter

**Минусы**:
- ❌ Оверинжиниринг для простого приветствия
- ❌ LLM latency на каждый `/start`

**Рекомендация**: ❌ НЕ рекомендуется

#### Вариант C: Оставить i18n, обновить план

**Описание**:
- Оставить `ctx.t("welcome")` как есть
- Обновить TELEGRAM-BOT-REFACTORING-PLAN.md
- Добавить обоснование: приветствие не требует LLM

**Плюсы**:
- ✅ Простота (i18n быстрее)
- ✅ Predictable приветствие
- ✅ Нет лишних LLM вызовов
- ✅ Соответствие реальности

**Минусы**:
- ❌ План изначально предполагал LLM

**Рекомендация**: ⭐ РЕКОМЕНДУЕТСЯ

### Сравнение вариантов

| Критерий | A: LLM генерация | B: BasePresenter | C: i18n (текущее) |
|----------|------------------|------------------|-------------------|
| Latency | ❌ 400-800ms | ❌ 400-800ms | ✅ <10ms |
| API costs | ❌ 0.001$ за /start | ❌ 0.001$ за /start | ✅ $0 |
| Персонализация | ✅ Имя пользователя | ✅ Имя пользователя | ❌ Generic |
| Простота | ❌ Сложность | ❌ Оверинжиниринг | ✅ Просто |
| Consistency | ✅ Все через LLM | ✅ Все через Presenter | ❌ i18n vs LLM |

### Финальное решение

**Вариант C** - оставить i18n для `/start`, обновить план.

**Обоснование**:
1. Приветствие - шаблонное сообщение, персонализация не нужна
2. LLM latency на `/start` ухудшает UX (первое впечатление)
3. `/story` и search через LLM - там это оправдано (сложные данные)
4. i18n даёт predictable результаты

**Действие**:
- Обновить TELEGRAM-BOT-REFACTORING-PLAN.md: убрать Фазу 4 для `/start`
- Отметить: "LLM только для story/search, приветствие через i18n"

---

## 📋 Проблема 3: План устарел (фазы cold_start)

### Детали

**План (строки 169-173)**:
```typescript
export const coldStartResponseSchema = z.object({
  phase: z.enum(["COLLECTING", "CONFIRMATION", "COMPLETED"]),
  message: z.string(),
  hasStory: z.boolean().optional(),
});
```

**Реальность (facade/langGraph/cold-start-v2/types.ts:224-239)**:
```typescript
export const coldStartResponseSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("story_gathering"), ... }),
  planResultSchema,  // awaiting_plan_confirmation
  entityBatchResultClarificationSchema,  // awaiting_clarification
  entityBatchResultConfirmationSchema,  // awaiting_context_confirmation
  finalPreviewSchema,  // awaiting_final_confirmation
  savedResultSchema,  // saved
  alreadySavedResultSchema,  // already_saved
  z.object({ phase: z.literal("failed"), ... }),
]);
```

### Причины

1. План написан ДО рефакторинга Facade LangGraph
2. Facade обновился (8 фаз вместо 3)
3. План не синхронизирован с изменениями

### Последствия

1. **План вводит в заблуждение**: фазы неверные
2. **Если бы следовали плану слепо**: критический баг (Zod validation fail)
3. **Хорошо что Bot импортирует схему из Facade**: Single Source of Truth спасла

### Варианты решений

#### Вариант A: Обновить план с актуальными фазами

**Описание**:
- Заменить `COLLECTING/CONFIRMATION/COMPLETED` на реальные фазы
- Добавить discriminated union пример
- Указать что схема импортируется из Facade

**Плюсы**:
- ✅ План актуален
- ✅ Документация соответствует коду

**Минусы**:
- ❌ План может устареть снова

**Рекомендация**: ⭐ РЕКОМЕНДУЕТСЯ

#### Вариант B: Удалить schema примеры из плана, оставить ссылку

**Описание**:
```markdown
## Response Schemas

Bot импортирует `coldStartResponseSchema` из Facade:
See: `facade/langGraph/cold-start-v2/types.ts`

ВАЖНО: НЕ определяй схему в Bot! Single Source of Truth - Facade.
```

**Плюсы**:
- ✅ План не устареет (нет конкретных значений)
- ✅ Подчёркивает Single Source of Truth принцип

**Минусы**:
- ❌ Меньше деталей для разработчика

**Рекомендация**: ❌ НЕ рекомендуется (план должен быть self-contained)

### Финальное решение

**Вариант A** - обновить план с актуальными фазами.

**Действие**:
```markdown
## Фаза 2: Response Schemas

ВАЖНО: coldStartResponseSchema импортируется из Facade (Single Source of Truth).

Фазы (из facade/langGraph/cold-start-v2/types.ts):
- story_gathering - начальный сбор истории
- awaiting_plan_confirmation - подтверждение плана
- awaiting_clarification - запрос недостающих данных
- awaiting_context_confirmation - подтверждение контекста
- awaiting_final_confirmation - финальное подтверждение
- saved - история сохранена
- already_saved - уже была сохранена
- failed - ошибка

// telegram-bot/schemas/mcp-responses.ts
export { coldStartResponseSchema } from "../../facade/langGraph/cold-start-v2/types.js";
```

---

## 📝 Итоговые рекомендации

### Приоритет P0 (критично)

1. **Удалить рудиментарные файлы**:
   ```bash
   rm src/telegram-bot/formatters/search.ts
   rm src/telegram-bot/services/llm-formatter.ts
   rm src/telegram-bot/services/mcp-utils.ts
   ```

2. **Обновить TELEGRAM-BOT-REFACTORING-PLAN.md**:
   - Актуальные фазы coldStartResponseSchema
   - Убрать Фазу 4 для `/start` (оставить i18n)
   - Добавить: "План может устареть - код важнее"

### Приоритет P1 (желательно)

3. **Создать commit с результатами рефакторинга**:
   ```
   refactor(telegram-bot): complete phases 0-5, cleanup dead code

   BREAKING CHANGE: ООП architecture (McpClient, SessionService, SearchPresenter)

   Completed:
   - Phase 0: Remove handler wrappers
   - Phase 1a: Production readiness (timeout, shutdown, TTL)
   - Phase 1b: sessionId caching (Redis 30 min)
   - Phase 2: Response schemas, discriminated union
   - Phase 3: OOP architecture + migration 6 handlers
   - Phase 4: LLM integration (ColdStartPresenter, SearchPresenter)
   - Phase 5: Error handling (throwing McpClient.parseJsonContent)

   Cleanup:
   - Remove dead code (formatters/search.ts, llm-formatter.ts, mcp-utils.ts)

   Not implemented:
   - Phase 4: generateWelcomeMessage (decided to use i18n for /start)
   - Phase 6: Webhook secret validation (P1 for production)

   🤖 Generated with Claude Code
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   ```

### Приоритет P2 (опционально)

4. **Фаза 6: Webhook secret validation** (когда будет production deploy)

---

## ✅ Что работает хорошо (сохранить)

1. **BasePresenter pattern** - Template Method идеально подходит
2. **Single Source of Truth для схем** - импорт из Facade правильный
3. **sessionId кэширование** - TTL 30 мин синхронизирован с Facade
4. **Graceful shutdown** - Redis + Bot корректно закрываются
5. **Zod валидация** - runtime safety работает

---

## 🎯 Финальный вердикт

**Оценка**: 8/10

**Что хорошо**:
- ✅ Архитектура ООП реализована корректно
- ✅ Breaking changes (migration handlers) выполнены
- ✅ Quality gates проходят (tsc + lint)
- ✅ BasePresenter + наследование - правильное решение
- ✅ Single Source of Truth для схем спасло от критического бага

**Что нужно улучшить**:
- 🗑️ Удалить мёртвый код (3 файла)
- 📋 Обновить план (актуальные фазы, убрать generateWelcomeMessage)
- 📝 Commit с cleanup

**Рекомендация**:
1. Удалить рудименты
2. Обновить план
3. Создать commit
4. Proceed с вариантом 2 (мануальное тестирование) или вариантом 3 (/sync-memory)
