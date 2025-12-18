# Session: LangGraph Architecture Refactoring

**Дата:** 2025-12-18 — 2025-12-19
**План:** `LANGGRAPH-REFACTORING-PLAN.md`
**Scope:** cold-start-v2, search-graph, shared utilities
**Статус:** ✅ COMPLETED (Phase 1-3)

---

## Phase 1: Shared Utilities

### Результаты

| Файл | LOC | Статус |
|------|-----|--------|
| `shared/state-utils.ts` | +5 | ✅ Добавлен `StateUpdate<S>` |
| `shared/routing.ts` | 10 | ✅ `buildRouteMap<T>` — используется обоими графами |
| `shared/interrupt-utils.ts` | 24 | ✅ `createInterruptPhaseExtractor` |
| `shared/state-validation.ts` | 17 | ✅ `createStateValidator` |

### Отхождения от плана

| Пункт плана | Решение | Обоснование |
|-------------|---------|-------------|
| **1.4 shared/intents.ts** | ❌ SKIP | Интенты специфичны для графа. Только "cancel" общий — абстракция не даёт ценности. |

### Закрытые вопросы

1. ~~**shared/routing.ts** — рационально ли держать `buildRouteMap` в shared?~~ ✅ RESOLVED
   - Оставлен в shared — используется обоими графами
   - Импорты обновлены: `import { buildRouteMap } from "../shared/routing.js"`

---

## Phase 2: cold-start-v2 DRY Refactor

### Финальная архитектура decision-router.ts (91 LOC)

```
DECISION_ROUTE_MAPS (Map)     — phase → buildRouteMap([...destinations])
CLARIFY_INTENT_ROUTES (Map)   — phase → parse_*_decision node
createDecisionRoutes(flag)    — factory: phase → { intent → node } с тернарным

availableNodesByPhase(phase)        — export для cold-start-graph.ts
routeNextNodeAfterDecision(state)   — unified, inline invariant check
routeNextNodeAfterClarifyIntent(state) — inline Map.get
routeNextNodeAfterValidation(state) — state-based (missingFields)
routeNextNodeAfterPlanCareer(state) — state-based (queue.length)

Static exports:
- PLAN_CAREER_ROUTE_MAP
- VALIDATION_ROUTE_MAP
- CLARIFY_INTENT_ROUTE_MAP
```

### cold-start-graph.ts — DRY edges

```typescript
// БЫЛО: 47 строк hardcoded destinations
.addConditionalEdges(NODE.parse_story_decision, routeAfterDecision, {
  [NODE.plan_career]: NODE.plan_career,
  [NODE.gather_story]: NODE.gather_story,
  [NODE.clarify_intent]: NODE.clarify_intent,
  [NODE.cancel]: NODE.cancel,
})

// СТАЛО: 1 вызов availableNodesByPhase
.addConditionalEdges(NODE.parse_story_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.story_gathering))
```

### Ключевое решение: state-dependent routing в таблице

```typescript
function createDecisionRoutes(hasMoreContexts: boolean) {
  return {
    [PHASE.awaiting_context_confirmation]: {
      approve: hasMoreContexts ? NODE.next_context : NODE.show_final,  // тернарный!
      edit: NODE.edit_context,
      cancel: NODE.cancel
    },
    // ...
  };
}
```

**Почему `approve` не в DECISION_ROUTE_MAPS:**
- `approve` для context зависит от state (`currentContextIndex < queue.length - 1`)
- Нельзя выразить в статичной Map
- Решение: factory function с параметром `hasMoreContexts`

### Отхождения от плана

| Пункт плана | Решение | Обоснование |
|-------------|---------|-------------|
| **Object для destinations** | Map | Нативная типизация, `.get()` возвращает `T \| undefined` без кастов |
| **Getter functions** | Inline | `getClarifyRoute`, `getIntent` — излишний уровень, inline проще |
| **Отдельные роутеры** | Unified | 4 функции → 1 `routeNextNodeAfterDecision` с data-driven таблицей |

### Тесты

- 28/28 contract tests ✅
- Тесты обновлены под unified `routeNextNodeAfterDecision(state)` с `phase` в state

---

## Phase 2.5: Архитектурное решение — Одна parse нода на граф

### Контекст обсуждения

**Вопрос**: Рационально ли в cold-start-v2 иметь 2 parse ноды (`parseStoryCompletionNode`, `parseConfirmationNode`)?

### Анализ cold-start-v2:

```
parseStoryCompletionNode:  intents = [approve, continue, cancel]
parseConfirmationNode:     intents = [approve, edit, cancel]
```

- `approve` и `cancel` — общие
- `continue` vs `edit` — семантически разные ("добавить к истории" vs "изменить данные")
- Логика парсинга ОДИНАКОВАЯ (вызов LLM)
- Отличается только промпт (валидные интенты)

### Анализ search-graph:

```
showExploration:    [proceed, filter, cancel]
showGoal:           [validate, clarify, save, cancel]
askAfterValidate:   [save, change, cancel]
showResults:        [change, delete, filter, cancel]
```

4 разных набора → если делать как cold-start-v2, то 4 parse ноды → много дублирования.

### Ключевой вопрос: Где живёт знание о валидных интентах?

| Подход | Где знание | Плюсы | Минусы |
|--------|------------|-------|--------|
| N parse нод | В каждой ноде | Явность, простые промпты | Дублирование логики |
| 1 parse нода | В конфиге (OPTIONS[phase]) | DRY, единая логика | Сложнее промпт |

### Решение: Одна parse нода с phase-aware промптом

**Принцип:**
1. Parse нода читает `state.phase`
2. Получает валидные интенты из `OPTIONS[phase]`
3. Строит промпт с этими интентами
4. Парсит `userResponse` → возвращает `{ intent }`
5. Бизнес-логика (clarificationText, targetSearchParams) — в отдельных бизнес-нодах

**Разделение ответственности:**
```
show_* нода:        только interrupt + phase
parse_intent нода:  классифицирует userResponse → intent
router:             решает по phase + intent
бизнес-нода:        извлекает специфичные данные
```

### План реализации (изменён):

**Phase 2.5a: cold-start-v2 → одна parse нода**
- [ ] Объединить `parseStoryCompletionNode` + `parseConfirmationNode` → `parseDecisionNode`
- [ ] Phase-aware промпт через `PHASE_INTENTS[phase]`
- [ ] Обновить edges в графе
- [ ] Обновить тесты

**Phase 3: search-graph → одна parse нода** (после 2.5a)
- [ ] Создать `parse_search_intent` с phase-aware промптом
- [ ] Применить тот же паттерн

---

## Phase 3: search-graph Refactoring

### Статус: ✅ COMPLETED

### Реализовано:

- [x] Добавлен `NODE.parse_search_intent` в state.ts
- [x] Создан `nodes/parse-search-intent.ts` (одна нода)
- [x] Упрощены 4 show_* ноды (только interrupt + phase)
- [x] Переписан search-router.ts (cold-start pattern: Map + factory + availableNodesByPhase)
- [x] Обновлены edges в search-graph.ts
- [x] lint + tsc проходят
- [x] **NEW (2025-12-19):** Добавлен `clarify_intent` node для unknown intent
- [x] **NEW:** `PARSE_INTENT_ALL_DESTINATIONS` constant
- [x] **NEW:** Complex conditions extracted to variables
- [x] **NEW:** `extractClarificationText` refactored to if/return
- [x] **NEW:** `toSearchState` inlined, kept guard

---

## Phase 4: Cleanup

### Статус: ⏳ PARTIAL

| Пункт | Статус | Комментарий |
|-------|--------|-------------|
| Delete shared/decision.ts | ❌ SKIP | Используется upsert-*, update-* |
| shared/routing.ts | ✅ Оставлен | Используется обоими графами |

---

## Финальные проверки

- [x] `npm run lint:fix` ✅
- [x] `npx tsc --noEmit` ✅
- [x] Unit tests (contracts.spec.ts) ✅ 28/28
- [ ] Integration tests — не запускались

---

## Требования к коду (выработаны в сессии)

### DRY Routing Architecture

1. **Map для destinations** — source of truth, `availableNodesByPhase()` экспорт
2. **Factory function** для state-dependent routing — тернарный прямо в таблице
3. **Inline invariants** — не плодить getter functions для простых проверок
4. **prettier-ignore** для таблиц — одна строка на элемент

### Пример паттерна

```typescript
// SOURCE OF TRUTH: destinations
const ROUTE_MAPS = new Map<Phase, Partial<Record<NodeName, NodeName>>>([
  [PHASE.foo, buildRouteMap([NODE.a, NODE.b, NODE.cancel])],
]);

// ROUTING LOGIC: intent → node (с state-dependent тернарным)
function createRoutes(flag: boolean) {
  return {
    [PHASE.foo]: { approve: flag ? NODE.a : NODE.b, cancel: NODE.cancel },
  };
}

// EXPORT для graph
export function availableNodesByPhase(phase: Phase) {
  const map = ROUTE_MAPS.get(phase);
  if (!map) throw new AgentInvariantError(...);
  return map;
}

// UNIFIED ROUTER
export function routeNextNodeAfterDecision(state: State): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (!state.parsedDecision) throw new AgentInvariantError(...);

  const routes = createRoutes(state.flag);
  return routes[state.phase]?.[state.parsedDecision.intent] ?? NODE.clarify_intent;
}
```

---

## Общие инсайты сессии

1. **Map vs Object для route tables** — Map лучше для phase→destinations (нативная типизация), Object для intent→node (LangGraph API)

2. **State-dependent routing** — factory function с параметром, тернарный прямо в таблице, не special cases в роутере

3. **Inline vs helpers** — для простых проверок (`.get()`, `!parsedDecision`) inline читабельнее чем отдельные функции

4. **DRY в graph edges** — destinations должны генерироваться из той же Map что использует роутер

5. **(NEW) `unknown` intent как escape hatch** — LLM должна иметь явный путь отступления когда не может классифицировать. Не полагаться на fallback `??`, делать explicit route.

6. **(NEW) Консистентность графов** — cold-start и search-graph должны обрабатывать edge cases одинаково (unknown → clarify_intent)

7. **(NEW) Zod schema = source of truth** — `.describe()` в схеме достаточно, не дублировать "Return structured JSON" в промптах

8. **(NEW) Map.get() fallback** — если все фазы покрыты, лучше throw чем magic fallback типа `["cancel"]`

---

## Рекомендации для будущих сессий

1. ~~**search-graph refactor** — применить тот же паттерн (Map + factory + availableNodesByPhase)~~ ✅ DONE

2. ~~**shared/routing.ts** — решить: inline buildRouteMap или оставить shared~~ ✅ Оставлен в shared

3. **Tests** — запустить integration tests (пока только unit)

4. **(NEW) response-builders.ts** — проверить консистентность с новыми фазами/интентами

5. **(NEW) upsert-*/update-* графы** — применить те же паттерны (clarify_intent, unknown handling) если будут рефакториться

---

## Naming Convention (согласовано в сессии)

| Тип функции | Паттерн | Пример |
|-------------|---------|--------|
| Доступные destinations по фазе | `availableNodesByPhase(phase)` | Возвращает Map всех возможных нод |
| Роутер после события | `routeNextNodeAfter{Event}(state)` | Возвращает одну ноду |

**Обоснование:**
- `availableNodesByPhase` — явно: "доступные ноды" + "по фазе" (что за аргумент)
- `routeNextNodeAfter*` — явно: "роутинг" + "следующую ноду" + "после чего"

---

## Code Style Requirements (согласовано в сессии)

### 1. Никакой inline "грязи" — заводить переменные

```typescript
// ❌ ПЛОХО: inline spread с условием
return {
  extractedGoal: existingGoal.targetCriteria,
  clarifyRound: 0,
  ...(isFromCheckGoal && { userResponse: "" }),
};

// ✅ ХОРОШО: явная переменная
const clearUserResponse = isFromCheckGoal ? { userResponse: "" } : {};
return {
  extractedGoal: existingGoal.targetCriteria,
  clarifyRound: 0,
  ...clearUserResponse,
};

// ✅ ЕЩЁ ЛУЧШЕ: if-else для читаемости
if (isFromCheckGoal) {
  return { extractedGoal, clarifyRound: 0, userResponse: "" };
}
return { extractedGoal, clarifyRound: 0 };
```

### 2. prettier-ignore для fluent chains в graph builder

```typescript
export function createGraphBuilder() {
  // prettier-ignore
  return new StateGraph(coldStartStateAnnotation)
    .addNode(NODE.gather_story, gatherStoryNode)
    .addEdge(START, NODE.gather_story)
    .addConditionalEdges(NODE.parse_story_decision, routeNextNodeAfterDecision, availableNodesByPhase(PHASE.story_gathering))
    // ... одна строка на edge
}
```

**Почему:** Prettier разбивает длинные строки, но для graph topology важна визуальная структура — одна строка = один edge.

### 3. Имена должны отвечать на вопросы

| Вопрос | Ответ в названии |
|--------|------------------|
| Что возвращает? | `availableNodes...` (набор нод) |
| По какому ключу? | `...ByPhase` (по фазе) |
| Когда вызывается? | `...AfterDecision` (после парсинга решения) |
| Что делает? | `routeNextNode...` (роутинг к следующей ноде) |

### 4. Семантика аргументов в названии функции

```typescript
// ❌ Неясно что за аргумент
getRouteMap(PHASE.story_gathering)

// ✅ Ясно: аргумент — фаза
availableNodesByPhase(PHASE.story_gathering)
```

### 5. Соблюдать бизнес-уровень функции (SRP + Layer Separation)

Все returns должны быть видны и сконцентрированы в теле функции. Верхнеуровневая функция не должна "проваливаться" в низкоуровневые детали.

### 6. (NEW) Complex conditions → named variables

```typescript
// ❌ if (isEnabled() && arr.length > 0 && other.length > 0)
// ✅ const hasData = arr.length > 0 && other.length > 0;
//    const shouldRun = isEnabled() && hasData;
```

### 7. (NEW) Ternary chains → if/return

```typescript
// ❌ return a && "b" in obj ? obj.b : null;
// ✅ if (!a) return null;
//    if (!("b" in obj)) return null;
//    return obj.b;
```

### 8. (NEW) Constants для сложных spreads

```typescript
// ❌ .addConditionalEdges(node, router, { ...fn(A), ...fn(B), ...fn(C) })
// ✅ const ALL_DESTINATIONS = { ...fn(A), ...fn(B), ...fn(C) };
//    .addConditionalEdges(node, router, ALL_DESTINATIONS)
```

### 9. (NEW) lint:fix вместо lint

Всегда `npm run lint:fix` — autofix экономит время.

```typescript
// ❌ ПЛОХО: верхнеуровневый роутер вдруг парсит строки
export function routeNextNodeAfterDecision(state: State): NodeName {
  const intent = state.userResponse.toLowerCase().includes("cancel")
    ? "cancel"
    : "approve";  // низкоуровневый парсинг в бизнес-функции!
  return routes[intent];
}

// ✅ ХОРОШО: роутер работает с уже распарсенными данными
export function routeNextNodeAfterDecision(state: State): NodeName {
  if (state.phase === PHASE.failed) return NODE.cancel;
  if (!state.parsedDecision) throw new AgentInvariantError(...);

  const routes = createDecisionRoutes(state.hasMoreContexts);
  return routes[state.phase]?.[state.parsedDecision.intent] ?? NODE.clarify_intent;
}
```

**Принцип:** Каждая функция работает на ОДНОМ уровне абстракции:
- **Роутер** — принимает решение по готовым данным (phase, intent)
- **Parser** — парсит сырой input в структуру
- **Validator** — проверяет бизнес-правила
- **Node** — оркестрирует: вызывает parser/validator, возвращает state update

```
┌─────────────────────────────────────────────┐
│ Node (orchestration)                        │
│   ├── calls Parser (low-level)              │
│   ├── calls Validator (business rules)      │
│   └── returns StateUpdate (high-level)      │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Router (decision)                           │
│   └── reads parsed state, returns NodeName  │
└─────────────────────────────────────────────┘
```

**Антипаттерн:** show_* ноды, которые делают и interrupt, и parseUserIntent — нарушение SRP.

---

## Session 2025-12-19: Code Quality Fixes

### Изменения

| # | Изменение | Файлы |
|---|-----------|-------|
| 1 | **CONFIRMATION_PROMPT** упрощён (убран "Return structured JSON") | `parse-confirmation.ts` |
| 2 | **`unknown` intent** добавлен в cold-start + search-graph | `types.ts`, `decision-router.ts`, `search-router.ts` |
| 3 | **Explicit `unknown` routing** → `clarify_intent` node | оба графа |
| 4 | **Complex conditions → variables** | `show-results.ts`, `parse-search-intent.ts` |
| 5 | **PARSE_INTENT_ALL_DESTINATIONS** constant | `search-router.ts`, `search-graph.ts` |
| 6 | **extractClarificationText** → if/return | `parse-search-intent.ts` |
| 7 | **toSearchState** inlined | `search-graph.ts` |
| 8 | **clarify_intent node** для search-graph | новый файл `nodes/clarify-intent.ts` |
| 9 | **Tests** обновлены для `unknown` intent | `contracts.spec.ts` |

### Архитектурное улучшение: Consistent unknown handling

**До:**
- cold-start: `unknown` → fallback через `??` к `clarify_intent`
- search-graph: `unknown` → молча остаётся на show_* node

**После:**
- cold-start: `unknown` → explicit route к `clarify_intent`
- search-graph: `unknown` → explicit route к `clarify_intent` (NEW node)

**UX:** Оба графа теперь явно говорят "Не понял, выберите действие:" вместо молчаливого повтора.

### clarify_intent node для search-graph

```typescript
// Map phase → valid options
const PHASE_OPTIONS = new Map([...]);

// Node: interrupt с "Не понял, выберите действие"
// Throw если phase не в Map (все 4 show-фазы покрыты)
```

### Graph edge

```
parse_search_intent ──[unknown]──► clarify_intent ──► parse_search_intent (loop)
```

---

## Файлы изменённые за 2025-12-19

### Новые файлы:
- `src/facade/langGraph/search-graph/nodes/clarify-intent.ts`

### Модифицированные:
- `src/facade/langGraph/cold-start-v2/types.ts` — added `unknown` to decisionSchema
- `src/facade/langGraph/cold-start-v2/nodes/parse-confirmation.ts` — simplified prompt
- `src/facade/langGraph/cold-start-v2/decision-router.ts` — explicit `unknown` routes
- `src/facade/langGraph/search-graph/state.ts` — added `NODE.clarify_intent`
- `src/facade/langGraph/search-graph/search-router.ts` — `PARSE_INTENT_ALL_DESTINATIONS`, `unknown` routes
- `src/facade/langGraph/search-graph/search-graph.ts` — added clarify_intent node + edge
- `src/facade/langGraph/search-graph/nodes/show-results.ts` — extracted condition to variable
- `src/facade/langGraph/search-graph/nodes/parse-search-intent.ts` — extracted condition, refactored extractClarificationText
- `tests/facade/agents/cold-start-v2/unit/contracts.spec.ts` — updated for `unknown` intent
