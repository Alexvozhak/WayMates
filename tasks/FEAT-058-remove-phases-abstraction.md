# FEAT-058: Удалить абстракцию Phases из SearchGraph

**Дата:** 2026-01-01
**Статус:** PENDING
**Приоритет:** 🟡 P2 (Tech Debt)
**Компонент:** Facade / SearchGraph

---

## Мотивация

Phases — избыточная абстракция поверх LangGraph nodes. Создаёт тройное дублирование данных:

1. Данные в `state` (searchResults, storedGoal, etc.)
2. Данные в `interrupt` payload
3. Данные в `responseBuilder` output

LangGraph уже знает:
- Какой node выполняется
- Где остановились (checkpoint)
- Какой interrupt активен

Phases добавляют сложность без ценности:
- `previousPhase` / `effectivePhase` логика
- Синхронизация phase с реальным состоянием
- Дублирование маппингов (PARSE_INTENT_ROUTE_MAPS)

---

## Текущее использование phases

| Использование | Файл | Что делает |
|---------------|------|------------|
| Response building | `response-builders.ts` | Record<Phase, Builder> — строит JSON ответ |
| Intent routing | `search-router.ts` | PARSE_INTENT_ROUTE_MAPS — валидные intents по phase |
| Checkpointing | `interrupt-utils.ts` | Извлекает phase для resume |

---

## Предлагаемое решение

### 1. Убрать `phase` из state

```typescript
// Было:
phase: Annotation<SearchPhase>

// Стало:
// Удалить — не нужно
```

### 2. Routing по контексту

```typescript
// Было:
const phaseRoutes = routes[phase];

// Стало:
function getValidIntents(state: SearchStateType): SearchUserIntent[] {
  if (state.searchResults.length > 0) {
    return RESULTS_INTENTS;
  }
  if (state.storedGoal) {
    return GOAL_INTENTS;
  }
  if (state.adhocContext) {
    return ADHOC_INTENTS;
  }
  return INITIAL_INTENTS;
}
```

### 3. Response = interrupt payload

```typescript
// Было:
export const responseBuilders: Record<SearchPhase, ResponseBuilder> = {
  [PHASE.showing_waymate_results]: (state) => ({
    phase: PHASE.showing_waymate_results,
    results: state.searchResults,
    goal: state.storedGoal,
    chartUrl: state.chartUrl,
  }),
};

// Стало:
// Interrupt payload = response напрямую
// Или generic builder по interrupt.type
```

### 4. Interrupt type вместо phase

```typescript
// interrupt уже содержит type:
interrupt({
  type: "show_results",  // ← это и есть "phase"
  results: [...],
  goal: {...},
});

// Response = interrupt payload
```

---

## Scope изменений

| Файл | Изменение |
|------|-----------|
| `state.ts` | Удалить `phase`, `previousPhase` из annotation |
| `state.ts` | Удалить `searchPhaseSchema` |
| `response-builders.ts` | Переписать на interrupt type или удалить |
| `search-router.ts` | Routing по контексту вместо phase |
| `nodes/*.ts` | Убрать `phase:` из return statements |
| `interrupt-utils.ts` | Упростить или удалить |
| `types.ts` | Обновить SearchGraphResponse |
| `tests/**` | Обновить assertions |

**Оценка:** ~300-400 LOC изменений

---

## Acceptance Criteria

- [ ] `phase` удалён из state
- [ ] `previousPhase` удалён из state
- [ ] Routing работает по контексту (hasGoal, hasResults, etc.)
- [ ] Response = interrupt payload (без response builders)
- [ ] Все тесты проходят
- [ ] Batch тесты demo-adhoc и demo-cold-start проходят

---

## Риски

1. **Сложность перехода** — много файлов затронуто
2. **Тесты проверяют phase** — нужно обновить assertions
3. **UI зависит от phase** — проверить Telegram bot handlers

---

## Связанные задачи

- FEAT-055: Demo Video — обнаружили проблему при рефакторинге advisor flow
- Удаление `advising` phase показало что phases избыточны
