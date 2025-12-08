# Вопросы для Обсуждения: Рефакторинг Telegram Bot

> **Дата**: 2025-12-07
> **Формат**: Краткие вопросы + варианты решений
> **Цель**: Согласовать архитектурные решения

---

## 1. Massive Code Duplication - Нейминг Енумов

**Проблема**: 3 файла (by-target, by-current, by-adhoc) - 114 строк дублирования

**Решение**: Template Method Pattern с типизированной конфигурацией

**Вопрос по нейминг**:

```typescript
SearchCommand / TelegramCommand?  // "/by_target", "/by_current", ...
SearchAction / PendingAction?     // "by_target", "by_current", ...  (уже есть type PendingAction)
SearchI18nKey?                     // "target-usage", "searching-target", ...
McpToolName / SearchToolName?     // "search_by_target", "search_user_careers", ...
```

**Альтернатива**: `const SEARCH_COMMANDS = {...} as const` вместо enum?

**Что согласовать**:
- [ ] Названия енумов
- [ ] Enum vs const as const
- [ ] Использовать существующий PendingAction или создать SearchAction?

---

## 2. SRP Violation - Выбор Подхода

**Проблема**: `mcp-client.ts` - 220 строк, 6 ответственностей (tool calling, session, retry, network, validation, errors)

**Варианты**:

### Вариант 1: Минимальное (2 файла)
- `session-manager.ts` - session lifecycle
- `mcp-client.ts` - всё остальное (180 строк)

**Pros**: Минимальные изменения
**Cons**: mcp-client всё ещё 180 строк

---

### Вариант 2: ООП (3 файла)
- `SessionManager` class
- `McpHttpClient` class (retry + network + validation)
- `mcp-client.ts` - фасад

**Pros**: Чистое SRP, легко тестировать
**Cons**: ООП не в стиле проекта, DI через ctx.services

---

### Вариант 3: Функциональный (3 файла) ✅ РЕКОМЕНДАЦИЯ
- `session-manager.ts` - pure functions для session
- `mcp-http.ts` - pure functions для HTTP (retry + network + validation)
- `mcp-client.ts` - оркестратор (callTool + ensureSession)

**Pros**: Функциональный стиль, explicit зависимости (facadeUrl как параметр), нет DI проблем
**Cons**: Передача facadeUrl везде (но это явно vs implicit через ctx.services)

**Что согласовать**:
- [ ] Выбрать вариант (1, 2 или 3)
- [ ] Если вариант 3: согласовать explicit передачу facadeUrl?
- [ ] Без метапрограммирования? ✅

---

## 3. Type Safety Issue - services

**Проблема**: `BotContext.services` декларирован как non-optional, но добавляется через middleware → type lie

**Варианты**:

### Решение 1: Optional (НЕ НРАВИТСЯ)
`services?: BotServices` → везде guards `if (!ctx.services)`

---

### Решение 2: Композиция типов ✅ РЕКОМЕНДАЦИЯ
```typescript
BaseContext = Context без services
BotContext = BaseContext + { services }
```
Explicit casts в 2 местах (middleware + регистрация handler)

**Pros**: Минимальные изменения, явные casts
**Cons**: Partial type lie (но explicit)

---

### Альтернатива: Комментарий
Оставить как есть + добавить комментарий о том что services добавляется в middleware

**Что согласовать**:
- [ ] Решение 2 (композиция) vs Комментарий vs Другое?

---

## 4. Nullable Approach - parseJsonContent

**Контекст**: В mcp-utils.ts две функции:
- `parseJsonContent<T>`: T | null (используется) ✅
- `getTextOrError`: string | throws (НЕ используется - dead code)

**Вопрос**: Nullable approach для parseJsonContent правильный?
- Ошибка парсинга = ожидаемый сценарий
- Caller решает как обрабатывать null
- Нет try-catch шума

**Что согласовать**:
- [ ] Согласны с nullable approach? ✅
- [ ] Нужен throwing вариант в будущем?

---

## 5. Layer Mixing - Форматтер делает LLM вызов

**Проблема**: `formatters/search.ts` создаёт ChatOpenAI и делает API вызов

**Контекст юзерфлоу**:
```
User → Handler → NLP Parser (LLM) → MCP Client → MCP Server (Neo4j)
  ↓
MCP Response (JSON) → Форматтер (LLM) → Telegram (Markdown)
```

**Зачем LLM форматирование**:
- Гибкость (адаптируется к данным: 0 путей vs 42 пути)
- Естественность (правильная грамматика, plurals)
- Локализация (natural language без i18n шаблонов)
- Контекст (может добавить insights)

**Альтернативы**:
1. Template engine (Handlebars) - жёсткая структура, нужны шаблоны для каждого языка
2. Переместить LLM в services/ - но форматтер станет бесполезным (только template)
3. Переименовать formatters/ → presenters/ - presenter = prepare data for UI (включая API)

**Что согласовать**:
- [ ] LLM форматирование vs Template engine?
- [ ] Оставить в formatters vs переместить в services vs переименовать в presenters?

---

## 6. NLP Parsers Duplication

**Проблема**: 3 функции (parseTargetQuery, parseAdhocQuery, parseCurrentQuery) - ~60 строк дублирования

**Замечание**: Не нравится замыкание + создание LLM каждый раз

**Варианты**:

### Вариант 1: Класс NlpParser
```typescript
class NlpParser {
  private llm: ChatOpenAI; // ✅ Создаётся ОДИН РАЗ в конструкторе

  constructor(apiKey: string) {
    this.llm = new ChatOpenAI({...});
  }

  async parseTargetQuery(query: string): Promise<...>
  async parseAdhocQuery(query: string): Promise<...>
  async parseCurrentQuery(query: string): Promise<...>
}
```

**Pros**: LLM один раз, нет дублирования, легко тестировать
**Cons**: ООП не в стиле проекта, нужно инжектить в ctx.services

---

### Вариант 2: Singleton LLM
```typescript
let llmInstance: ChatOpenAI | null = null;

function getLlm(apiKey: string) {
  if (!llmInstance) llmInstance = new ChatOpenAI({...});
  return llmInstance;
}
```

**Pros**: LLM один раз, функциональный API
**Cons**: Global state, всё ещё дублирование 3 функций

---

### Вариант 3: Generic + Singleton ✅ РЕКОМЕНДАЦИЯ
```typescript
let llmInstance = null;
function getLlm(apiKey) {...}

async function parseWithLlm<T>(apiKey, schema, prompt, validator?) {
  const llm = getLlm(apiKey); // Singleton
  // ...generic логика
}

// Thin wrappers
export async function parseTargetQuery(apiKey, query) {
  return parseWithLlm(apiKey, targetSchema, createPrompt(query), validator);
}
```

**Pros**: LLM один раз, нет дублирования, функциональный API, нет изменений в handlers
**Cons**: Global state, thin wrappers всё ещё дублируют структуру (но короткие)

**Вопросы**:
1. Проблема ли создание LLM каждый раз? (ChatOpenAI = lightweight object, не connection pool)
2. Что именно не нравится в замыкании? (validator как параметр = Strategy pattern)

**Что согласовать**:
- [ ] Является ли создание LLM каждый раз проблемой?
- [ ] Выбрать вариант (1 ООП, 3 функциональный, или оставить как есть)?

---

## 7. Error Handling Неконсистентность

**Проблема**: 3 подхода - nullable (T | null), throwing (throw Error), boolean return

**Пример**:
- `parseJsonContent` - nullable ✅
- `updateHasStory` - boolean (используется 1 раз, можно inline)
- `saveSessionFromLinkResult` - void + guard (нет проверки sessionId существования)

**Глубинная проблема**: Нестрогие сигнатуры
```typescript
sessionId: string // Тип говорит "всегда есть"
// Но в initial: { sessionId: "" } // Пустая строка!
```

**Решения**:

### Вариант 1: Optional sessionId
`sessionId: string | null` - честная типизация, везде проверки

### Вариант 2: Discriminated Union ✅
```typescript
MySessionData =
  | { status: "uninitialised" }
  | { status: "initialised"; sessionId: string; hasStory: boolean; token: string }
```
Type-safe guards

### Вариант 3: Разделить Initial и Session типы
Type guard `isSessionInitialised(session)`

**Единый подход к errors**:
- Nullable - для optional данных
- Throwing - для критических ошибок
- Boolean - для validation checks (НЕ для мутаций!)
- Result type - для explicit errors (?)

**Что согласовать**:
- [ ] Выбрать подход к типизации MySessionData (вариант 2 discriminated union?)
- [ ] Выбрать единый подход к error handling

---

## 8. updateHasStory - Inline?

**Проблема**: Функция используется ОДИН РАЗ в callbacks.ts:14

**Контекст**: handleApproveCallback - пользователь подтвердил cold_start → установить hasStory = true

**Зачем проверка sessionId**:
- Между началом /story и нажатием "Подтвердить" прошло время
- Session могла истечь в Redis
- Проверяем sessionId → если пустой → "session expired"

**НО**: Проверка не различает "uninitialised" vs "expired" (оба дают sessionId === "")

**Варианты**:

### Вариант 1: Inline ✅ РЕКОМЕНДАЦИЯ
Убрать функцию, inline проверку + установку в handleApproveCallback

**Pros**: Меньше кода, явная логика
**Cons**: Дублирование если нужно будет устанавливать hasStory в других местах

### Вариант 2: Throwing
`updateHasStory` бросает SessionExpiredError → catch в caller

### Вариант 3: Middleware для session check
Centralized check ДО handlers → fail-fast

**Что согласовать**:
- [ ] Inline (вариант 1)?
- [ ] Нужен centralized session check middleware?

---

## Итоговая Таблица

| # | Вопрос | Рекомендация |
|---|--------|--------------|
| 1 | Нейминг енумов | Согласовать |
| 2 | SRP mcp-client | Вариант 3 (функциональный) |
| 3 | Type safety services | Решение 2 (композиция типов) |
| 4 | Nullable approach | Оставить nullable ✅ |
| 5 | LLM в форматтере | Обсудить (оставить? переместить? переименовать?) |
| 6 | NLP parsers | Вариант 3 (generic + singleton) |
| 7 | Error handling | Discriminated union для MySessionData |
| 8 | updateHasStory | Inline |
