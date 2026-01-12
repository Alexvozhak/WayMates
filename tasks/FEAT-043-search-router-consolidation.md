# FEAT-043: Консолидация SearchGraph Router

**Status**: DEFERRED
**Priority**: P2 (понижен с P1)
**Component**: Facade (SearchGraph routing)
**Created**: 2025-12-25

---

## Проблема

В `search-router.ts` есть **две отдельные структуры данных** для одной и той же информации:

### Структура 1: Допустимые destinations (валидация)

```typescript
const PARSE_INTENT_ROUTE_MAPS = new Map([
  [PHASE.showing_results, buildRouteMap([
    NODE.load_existing_goal, NODE.delete_goal, NODE.apply_filters,
    NODE.generate_answer, NODE.clarify_intent, NODE.cancel
  ])],
]);
```

### Структура 2: Маппинг intent → node (роутинг)

```typescript
function createIntentRoutes(flags) {
  return {
    [PHASE.showing_results]: {
      filter: NODE.apply_filters,
      clarify: NODE.load_existing_goal,
      change: NODE.load_existing_goal,
      delete: NODE.delete_goal,
      ask: NODE.generate_answer,
      cancel: NODE.cancel,
      unknown: NODE.clarify_intent
    }
  };
}
```

**Проблемы:**
1. **Дублирование** — нужно обновлять оба места при изменениях
2. **Рассинхрон** — можно добавить ноду в одну структуру и забыть про другую
3. **Непонятность** — зачем две структуры для одного?

---

## Решение

**Оставить только маппинг intent → node. Destinations выводить автоматически.**

### Было (2 структуры)

```typescript
// Структура 1: список дверей
const DESTINATIONS = {
  showing_results: [apply_filters, load_existing_goal, delete_goal, ...]
};

// Структура 2: маппинг интентов
const ROUTES = {
  showing_results: { filter: apply_filters, clarify: load_existing_goal, ... }
};
```

### Стало (1 структура)

```typescript
// Только маппинг интентов
const PHASE_ROUTES: Record<SearchPhase, (flags: RouteFlags) => IntentRoutes> = {
  [PHASE.showing_results]: (flags) => ({
    filter:  NODE.apply_filters,
    clarify: NODE.load_existing_goal,
    change:  NODE.load_existing_goal,
    delete:  NODE.delete_goal,
    ask:     NODE.generate_answer,
    cancel:  NODE.cancel,
    unknown: NODE.clarify_intent,
  }),
};

// Destinations = автоматически из маппинга
function getDestinations(phase: SearchPhase): Set<NodeName> {
  // Вызываем с "максимальными" флагами чтобы получить все возможные ноды
  const routes = PHASE_ROUTES[phase]({ canClarify: true, hasGoal: true, canChangePosition: true });
  return new Set(Object.values(routes));
}
```

---

## Acceptance Criteria

1. **Удалить `PARSE_INTENT_ROUTE_MAPS`**
   - [ ] Весь код использует только `PHASE_ROUTES`

2. **`getDestinations()` выводится из `PHASE_ROUTES`**
   - [ ] Функция вызывает routes с максимальными флагами
   - [ ] Возвращает `Set<NodeName>` уникальных destinations

3. **Валидация в dev mode**
   - [ ] При старте проверять что все destinations из routes валидны
   - [ ] Runtime ошибка если нода не существует

4. **Тесты проходят**
   - [ ] Все существующие SearchGraph тесты (15/15)
   - [ ] lint + tsc без ошибок

---

## Технический подход

### Шаг 1: Рефакторинг PHASE_ROUTES

```typescript
// search-router.ts

type IntentRoutes = Partial<Record<SearchIntent, NodeName>>;

const PHASE_ROUTES: Record<SearchPhase, (flags: RouteFlags) => IntentRoutes> = {
  [PHASE.confirming_adhoc_context]: (flags) => ({
    proceed: flags.hasGoal ? NODE.search : NODE.explore,
    clarify: NODE.extract_goal,
    filter: NODE.ask_adhoc_context,
    cancel: NODE.cancel,
    unknown: NODE.clarify_intent,
  }),

  [PHASE.showing_exploration]: (_flags) => ({
    proceed: NODE.extract_goal,
    clarify: NODE.extract_goal,
    filter: NODE.apply_filters,
    cancel: NODE.cancel,
    unknown: NODE.clarify_intent,
  }),

  // ... остальные фазы
};
```

### Шаг 2: getDestinations()

```typescript
export function getDestinations(phase: SearchPhase): Set<NodeName> {
  const maxFlags: RouteFlags = { canClarify: true, hasGoal: true, canChangePosition: true };
  const routes = PHASE_ROUTES[phase](maxFlags);
  return new Set(Object.values(routes).filter((n): n is NodeName => n !== undefined));
}
```

### Шаг 3: Удалить PARSE_INTENT_ROUTE_MAPS

- Удалить `PARSE_INTENT_ROUTE_MAPS`
- Удалить `buildRouteMap()`
- Удалить `availableNodesByPhase()` или переписать на `getDestinations()`

### Шаг 4: Dev-time валидация

```typescript
if (process.env.NODE_ENV === 'development') {
  for (const phase of Object.values(PHASE)) {
    const destinations = getDestinations(phase);
    for (const node of destinations) {
      if (!Object.values(NODE).includes(node)) {
        throw new Error(`Invalid node ${node} in phase ${phase}`);
      }
    }
  }
}
```

---

## Связанные файлы

- `src/facade/langGraph/search-graph/search-router.ts` — основной файл
- `src/facade/langGraph/search-graph/state.ts` — PHASE, NODE enums

---

## Оценка

| Аспект | Оценка |
|--------|--------|
| Сложность | Низкая (рефакторинг без изменения логики) |
| Риск | Низкий (есть тесты, логика не меняется) |
| Влияние | Среднее (улучшает maintainability) |
| LOC | -30...-50 (удаление дублирования) |

---

## Notes

Обнаружено во время анализа BUG-1 (Advisor "спасибо" → cancel) в manual testing сессии 2025-12-25.

Рефакторинг НЕ исправит найденные баги — они в логике роутинга, не в структуре данных. Но упростит поддержку и уменьшит риск рассинхрона в будущем.

---

## Решение: DEFERRED (2025-12-25)

### Анализ

Проведён глубокий анализ архитектуры SearchGraph:

| Показатель | Значение |
|------------|----------|
| Всего нод | 23 |
| Conditional edges | 5 |
| INTERRUPT нод | 7 |
| Дублирование | ~20 LOC |

### Вердикт

**Архитектура адекватна задаче.** Дублирование минимальное и служит как safety net:

1. **`PARSE_INTENT_ROUTE_MAPS`** — статический список доступных нод (defensive programming)
2. **`createIntentRoutes`** — динамический маппинг с условной логикой

Обе структуры нужны:
- Первая для валидации и определения edges в графе
- Вторая для реального роутинга с state-dependent условиями

### Почему отложено

1. **Низкий ROI** — ~20 LOC экономии при риске сломать работающий код
2. **Safety net полезен** — если забыть фазу в одной структуре, другая поймает
3. **Есть более ценные задачи** — E2E тесты, несогласованность adhoc↔goal, production readiness

### Когда вернуться

- Если появятся баги из-за рассинхрона структур
- При масштабном рефакторинге SearchGraph
- Post-MVP когда будет время на tech debt
