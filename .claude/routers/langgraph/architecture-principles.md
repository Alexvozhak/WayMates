# LangGraph: Архитектурные Принципы

> Принципы организации кода, ЗО сущностей, SRP правила
>
> Дополняет lessons-learned.md (практические gotchas) архитектурными решениями

Последнее обновление: 2025-12-18

---

## 🏗️ Архитектура Графа

### Структура Директории

```
src/facade/langGraph/
├── shared/                      # Переиспользуемые утилиты
│   ├── state-utils.ts           # StateUpdate<S>, lastValue
│   ├── routing.ts               # buildRouteMap
│   ├── interrupt-utils.ts       # createInterruptPhaseExtractor
│   ├── intents.ts               # BASE_INTENTS
│   └── types.ts                 # GraphDeps, hasConfigDeps
│
├── search-graph/                # Граф поиска кандидатов
│   ├── types.ts                 # Phase enum, Node enum, SearchUserIntent
│   ├── state.ts                 # Annotation + Zod schema
│   ├── search-graph.ts          # StateGraph builder + Graph class
│   ├── search-router.ts         # Data-driven routing tables
│   ├── prompts.ts               # LLM prompts
│   ├── response-builders.ts     # Phase → Response mapping
│   └── nodes/                   # Ноды графа
│       ├── show-*.ts            # Interrupt ноды
│       ├── parse-search-intent.ts # Единый intent parser
│       └── *.ts                 # Бизнес-логика ноды
│
└── cold-start-v2/               # Граф сбора истории
    └── ... (аналогичная структура)
```

---

## 🎯 Зоны Ответственности (ЗО)

### Типы файлов и их ЗО (универсально для всех графов)

| Файл | ЗО | НЕ делает |
|------|-----|-----------|
| **types.ts** | Phase enum, Node enum, Zod schemas, type exports | Логика, импорты из nodes |
| **state.ts** | Annotation definition, state defaults, re-export types | Бизнес-логика, routing |
| **{graph-name}.ts** | StateGraph builder, Graph class, edges, run() | Routing логика (только вызывает routers) |
| **{graph}-router.ts** | Routing tables, routing functions | State mutation, LLM calls |
| **nodes/*.ts** | Одна атомарная операция | Routing, вызов других нод |
| **prompts.ts** | LLM prompts как константы | Логика парсинга |
| **response-builders.ts** | READONLY: State → Response для API | State mutation, бизнес-логика |

**response-builders.ts подробнее:**
```typescript
// ЗО: трансформировать internal state → external response
// Используется в Graph.run() для отдачи результата наружу

export const responseBuilders: Record<Phase, ResponseBuilder> = {
  [PHASE.showingGoal]: (state) => ({
    phase: PHASE.showingGoal,
    extractedGoal: state.extractedGoal,  // ← читает state
    options: OPTIONS.showGoal,           // ← добавляет UI options
  }),
  // ...
};

// НЕ мутирует state — только читает и форматирует
```

### ЗО Нод (Single Responsibility)

```
┌─────────────────────────────────────────────────────────────────┐
│                         NODE TYPES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INTERRUPT NODES (show_*)                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ЗО: Показать данные пользователю, дождаться ответа       │    │
│  │                                                          │    │
│  │ ДЕЛАЕТ:                                                  │    │
│  │   • interrupt({type, data, options, phase})              │    │
│  │   • return { userResponse, phase }                       │    │
│  │                                                          │    │
│  │ НЕ ДЕЛАЕТ:                                               │    │
│  │   ✗ parseUserIntent (вынесено в parse_search_intent)     │    │
│  │   ✗ routing decisions                                    │    │
│  │   ✗ userResponse: "" clearing                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  PARSE NODES (parse_*)                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ЗО: Распознать intent пользователя из userResponse       │    │
│  │                                                          │    │
│  │ ДЕЛАЕТ:                                                  │    │
│  │   • parseUserIntent(state.userResponse)                  │    │
│  │   • return { searchUserIntent, clarificationText, ... }  │    │
│  │                                                          │    │
│  │ НЕ ДЕЛАЕТ:                                               │    │
│  │   ✗ interrupt                                            │    │
│  │   ✗ routing decisions                                    │    │
│  │   ✗ business logic                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  BUSINESS NODES (extract_*, validate_*, set_*, etc.)             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ЗО: Выполнить одну бизнес-операцию                       │    │
│  │                                                          │    │
│  │ ДЕЛАЕТ:                                                  │    │
│  │   • LLM extraction / validation                          │    │
│  │   • Database queries / mutations                         │    │
│  │   • return { businessData, phase }                       │    │
│  │                                                          │    │
│  │ НЕ ДЕЛАЕТ:                                               │    │
│  │   ✗ interrupt                                            │    │
│  │   ✗ intent parsing                                       │    │
│  │   ✗ multiple operations                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data-Driven Routing

### Принцип

**Routing как данные, не код.**

```typescript
// ❌ ПЛОХО: switch/case в каждом router
export function routeAfterShowGoal(state) {
  switch (state.searchUserIntent) {
    case "validate": return NODE.validate_goal;
    case "clarify": return NODE.clarify_goal;
    // ... много веток
  }
}

export function routeAfterShowExploration(state) {
  switch (state.searchUserIntent) {
    case "proceed": return NODE.extract_goal;
    // ... те же паттерны
  }
}
```

```typescript
// ✅ ХОРОШО: routing table
const PHASE_ROUTES: Record<SearchPhase, Record<SearchUserIntent, NodeName>> = {
  [PHASE.showingExploration]: {
    proceed: NODE.extract_goal,
    filter: NODE.apply_filters,
    cancel: NODE.cancel,
  },
  [PHASE.showingGoal]: {
    validate: NODE.validate_goal,
    clarify: NODE.clarify_goal,
    save: NODE.set_goal,
    cancel: NODE.cancel,
  },
  // ...
};

// Один router для всех фаз
export function routeByPhaseAndIntent(state): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;

  const routes = PHASE_ROUTES[state.phase];
  return routes?.[state.searchUserIntent] ?? PHASE_DEFAULTS[state.phase];
}
```

### Преимущества

1. **Читаемость** — routing как таблица, видно все переходы
2. **Единая точка** — один router вместо 4-5
3. **Defensive** — `if (phase === "failed")` один раз
4. **Типизация** — TypeScript проверяет что все cases покрыты

---

## 📋 Типизация

### StateUpdate Pattern

```typescript
// shared/state-utils.ts
export type StateUpdate<S> = Partial<S>;

// Использование в нодах
export function showGoalNode(state: SearchStateType): StateUpdate<SearchStateType> {
  return {
    userResponse: String(interrupt({...})),
    phase: PHASE.showingGoal,
  };
}
```

**Почему не `Partial<SearchStateType>` напрямую:**
- Семантика: `StateUpdate` говорит "это обновление state"
- Консистентность: одинаковый тип везде
- Рефакторинг: легко найти все nodes

### Typed Destinations

```typescript
// Router возвращает только валидные destinations
const ALL_INTENT_DESTINATIONS = [
  NODE.extract_goal,
  NODE.validate_goal,
  // ...
] as const;

type IntentDestination = (typeof ALL_INTENT_DESTINATIONS)[number];

export function routeByPhaseAndIntent(state): IntentDestination {
  // TypeScript проверит что return value ∈ IntentDestination
}
```

### Zod Schema как Source of Truth

```typescript
// types.ts
export const searchPhaseSchema = z.enum([
  "checking_goal",
  "exploring",
  // ...
]);

// Derive type и enum из schema
export type SearchPhase = z.infer<typeof searchPhaseSchema>;
export const PHASE = searchPhaseSchema.Values;

// Runtime validation
const toSearchState = createStateValidator(searchStateSchema, "Search");
```

---

## 🚫 Anti-Patterns

### 1. Inline Spread Hell

```typescript
// ❌ ПЛОХО: условные spreads, нечитаемо
return {
  ...(parsed.intent === "clarify" && { clarificationText: parsed.clarificationText }),
  ...(parsed.intent === "validate" && parsed.filters && { targetSearchParams: ... }),
  ...(someCondition && { field: value }),
};

// ✅ ХОРОШО: явные переменные
const clarificationText = parsed.intent === "clarify" ? parsed.clarificationText : null;
const targetSearchParams = buildTargetParams(parsed);

return {
  searchUserIntent: parsed.intent,
  clarificationText,
  targetSearchParams,
};
```

### 2. Mixed Responsibilities

```typescript
// ❌ ПЛОХО: show_* нода делает и interrupt и parsing
export async function showGoalNode(state) {
  const userResponse = interrupt({...});
  const parsed = await parseUserIntent(userResponse);  // ← SRP violation!
  return { userResponse, searchUserIntent: parsed.intent };
}

// ✅ ХОРОШО: разделение
export function showGoalNode(state) {
  const userResponse = interrupt({...});
  return { userResponse, phase: PHASE.showingGoal };
}

export async function parseSearchIntentNode(state) {
  const parsed = await parseUserIntent(state.userResponse);
  return { searchUserIntent: parsed.intent };
}
```

### 3. Conditional userResponse Clearing

```typescript
// ❌ ПЛОХО: очистка разбросана по 5 нодам
// load-context.ts
return { adhocContext, userResponse: "" };

// extract-goal.ts
return { extractedGoal, userResponse: "" };

// clarify-goal.ts
return { extractedGoal, userResponse: "" };

// ✅ ХОРОШО: архитектура не требует очистки
// show_* → parse_search_intent → routing
// Следующий interrupt перезапишет userResponse автоматически
```

### 4. Re-export Chains

```typescript
// ❌ ПЛОХО: цепочка реэкспортов
// types.ts
export const PHASE = ...;

// state.ts
export { PHASE } from "./types.js";

// search-graph.ts
export { PHASE } from "./state.js";

// ✅ ХОРОШО: импорт из source
import { PHASE } from "./types.js";
```

### 5. Type Guards vs Zod

```typescript
// ❌ ПЛОХО: примитивный type guard
function isSearchState(values: unknown): values is SearchStateType {
  return !!values && typeof values === "object" && "phase" in values;
}

// ✅ ХОРОШО: Zod validation
const toSearchState = createStateValidator(searchStateSchema, "Search");
// Валидирует ВСЕ поля, не только наличие
```

---

## 🔗 Flow: show_* → parse_search_intent → routing

```
┌──────────────────────────────────────────────────────────────────┐
│                        INTERRUPT FLOW                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User message                                                     │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────────────┐                                              │
│  │ show_exploration │  interrupt({type, candidates, options})     │
│  │ show_goal        │  → pause execution                          │
│  │ show_results     │  → wait for user                            │
│  │ ask_after_val... │                                             │
│  └────────┬────────┘                                              │
│           │ userResponse                                          │
│           ▼                                                       │
│  ┌─────────────────┐                                              │
│  │ parse_search_   │  parseUserIntent(userResponse)               │
│  │ intent          │  → classify intent                           │
│  │                 │  → extract filters/clarification             │
│  └────────┬────────┘                                              │
│           │ searchUserIntent                                      │
│           ▼                                                       │
│  ┌─────────────────┐                                              │
│  │ routeByPhase    │  PHASE_ROUTES[phase][intent]                 │
│  │ AndIntent       │  → lookup in routing table                   │
│  │                 │  → return target node                        │
│  └────────┬────────┘                                              │
│           │                                                       │
│           ▼                                                       │
│  ┌─────────────────┐                                              │
│  │ target node     │  extract_goal / validate_goal / set_goal ... │
│  └─────────────────┘                                              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Shared Utilities

### buildRouteMap

```typescript
// shared/routing.ts
export function buildRouteMap<T extends string>(
  destinations: readonly T[],
): Record<T, T> {
  return Object.fromEntries(destinations.map((d) => [d, d])) as Record<T, T>;
}

// Использование
.addConditionalEdges(
  NODE.parse_search_intent,
  routeByPhaseAndIntent,
  buildRouteMap(ALL_INTENT_DESTINATIONS),
)
```

### createInterruptPhaseExtractor

```typescript
// shared/interrupt-utils.ts
export function createInterruptPhaseExtractor<P extends string>(
  phaseSchema: z.ZodEnum<[P, ...P[]]>,
): (snapshot: StateSnapshot) => P | undefined {
  const schema = z.object({ phase: phaseSchema.optional() });

  return (snapshot) => {
    const task = snapshot.tasks[0];
    const interrupt = task?.interrupts[0];
    if (!interrupt) return undefined;

    const parsed = schema.safeParse(interrupt.value);
    return parsed.success ? parsed.data.phase : undefined;
  };
}

// Использование — типизированный extractor
const extractInterruptPhase = createInterruptPhaseExtractor(searchPhaseSchema);
```

### createStateValidator

```typescript
// shared/state-validation.ts
export function createStateValidator<T>(
  schema: z.ZodType<T>,
  name: string,
): (values: unknown) => T {
  return (values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      throw new AgentInvariantError(`to${name}State`, result.error.message);
    }
    return result.data;
  };
}

// Использование
const toSearchState = createStateValidator(searchStateSchema, "Search");
```

---

## 📋 Checklist: Новая Нода

### 1. Определи тип ноды
- [ ] INTERRUPT — показывает данные, ждёт ответа
- [ ] PARSE — парсит intent/данные из userResponse
- [ ] BUSINESS — выполняет одну операцию

### 2. Для INTERRUPT ноды
- [ ] Только `interrupt({...})` + `return { userResponse, phase }`
- [ ] НЕ вызывай `parseUserIntent`
- [ ] НЕ очищай `userResponse`

### 3. Для PARSE ноды
- [ ] Читает `state.userResponse`
- [ ] Вызывает LLM для классификации
- [ ] Возвращает структурированный результат
- [ ] НЕ делает interrupt

### 4. Для BUSINESS ноды
- [ ] Одна операция (extract / validate / save / etc.)
- [ ] Может вызывать LLM или DB
- [ ] НЕ делает interrupt
- [ ] НЕ парсит intent

### 5. Добавь в граф
- [ ] `.addNode(NODE.name, nodeFunction)`
- [ ] `.addEdge(SOURCE, NODE.name)` или `.addConditionalEdges(...)`
- [ ] Если conditional — добавь destination в routing table

### 6. Проверь
- [ ] `npm run lint:fix`
- [ ] `npx tsc --noEmit`
- [ ] Integration test

---

## 🔗 Связанные Документы

- [lessons-learned.md](./lessons-learned.md) — практические gotchas
- [gotchas.md](./gotchas.md) — синтаксические ловушки LangGraph
- [glossary.md](./glossary.md) — терминология
- [LANGGRAPH-REFACTORING-PLAN.md](../../../LANGGRAPH-REFACTORING-PLAN.md) — план рефакторинга
