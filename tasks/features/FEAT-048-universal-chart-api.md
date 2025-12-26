# FEAT-048: Универсальный Chart API для всех режимов поиска

**Статус:** TODO
**Приоритет:** P1
**Ветка:** `feature/universal-chart`
**Создано:** 2025-12-26

---

## TL;DR

Chart работает только для searchWaymates. Нужно добавить для остальных режимов.
**Решение:** Расширить discriminated union в transformer (добавить `mode: "goal-only"`). Конвертация типов — inline в nodes.

---

## 1. Текущее состояние

| Режим | Chart | Готовность |
|-------|-------|------------|
| **searchWaymates** | `✅` | **95%** |
| **searchPathfinders** | `❌` | **40%** |
| **reversePathfinders** (validate-goal) | `❌` | **30%** |
| **explore** (без цели) | `❌` | **60%** |

**Корневая проблема:** `show-results.ts` хардкодит `state.searchResults`, игнорируя `pathfinderResults`. Другие nodes возвращают `chartUrl: null`.

---

## 2. Архитектура

**Расширяем существующий discriminated union в trajectory-transformer:**

```
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
┌────────┴────────┐         ┌─────────┴─────────┐        ┌─────────┴─────────┐
│  mode: "full"   │         │mode: "candidates- │        │ mode: "goal-only" │
│                 │         │       only"       │        │    (НОВЫЙ)        │
│ userTrajectory  │         │  adhocContext     │        │ БЕЗ user/adhoc    │
│ UserContext[]   │         │ AdhocContextBase  │        │ только candidates │
│                 │         │                   │        │ + goalValues      │
│ ✅ waymates     │         │ ✅ explore adhoc  │        │ ✅ validate-goal  │
│ ✅ pathfinders  │         │                   │        │                   │
└─────────────────┘         └───────────────────┘        └───────────────────┘
```

**Что рисует каждый режим:**

| Mode | User Line | Adhoc Marker | Goal Line | Candidates |
|------|-----------|--------------|-----------|------------|
| `"full"` | ✅ | ❌ | ✅ (если есть) | ✅ |
| `"candidates-only"` | ❌ | ✅ | ✅ (если есть) | ✅ |
| `"goal-only"` (NEW) | ❌ | ❌ | ✅ | ✅ |

**Файлы для изменения:**

| Файл | Действие | LOC |
|------|----------|-----|
| `src/chart/types.ts` | +`GoalOnlyInput` type | ~10 |
| `src/chart/services/trajectory-transformer.ts` | +`transformGoalOnly()` | ~25 |
| `src/chart/builders/chart-builder.ts` | Поддержка 3-го mode | ~10 |
| `nodes/show-results.ts` | Условный выбор по `searchMode` | ~15 |
| `nodes/validate-goal.ts` | +chart generation | ~20 |
| `nodes/explore.ts` | +chart generation | ~15 |

**Total: ~100 LOC**

---

## 3. Детальный план

### Фаза 1: searchPathfinders chart (~40 LOC)

**Проблема:** `show-results.ts` хардкодит `state.searchResults`

**Решение:** Условный выбор данных по `state.searchMode`

```typescript
// show-results.ts
const candidates = state.searchMode === "pathfinders"
  ? state.pathfinderResults.map(pf => ({
      userId: pf.userId,
      matchedContext: pf.matchedContext,
      path: pf.path,
      isWaymate: false,
      timeSinceMatchedMonths: pf.timeSinceTargetMonths,
    }))
  : state.searchResults;

const result = await generateTrajectoryChart({
  mode: "full",
  userTrajectory: state.userTrajectory,
  candidates,
  // ...
});
```

**AC:**
- [ ] show-results.ts выбирает данные по searchMode
- [ ] searchPathfinders генерирует chart с Goal Line

### Фаза 2: validate-goal chart + mode "goal-only" (~50 LOC)

**Особенности режима:**
- НЕТ `userTrajectory` (reversePathfinders ищут любого с нужной целью)
- НЕТ `adhocContext`
- ЕСТЬ `extractedGoal` → Goal Line
- ЕСТЬ траектории кандидатов

**Новый тип:**
```typescript
// types.ts
export type GoalOnlyInput = BaseChartInput & {
  mode: "goal-only";
  goalValues: GoalValues;
};
```

**Новая функция:**
```typescript
// trajectory-transformer.ts
export function transformGoalOnly(input: GoalOnlyTransformInput): ProcessedTrajectory[] {
  const colors = generateCandidateColors(input.candidates.length);
  return buildCandidateTrajectories(input.candidates, colors, input.existingGoal);
}
```

**Использование:**
```typescript
// validate-goal.ts
const chartResult = await generateTrajectoryChart({
  mode: "goal-only",
  candidates: candidates.map(c => ({ ... })),
  goalValues: extractGoalValues(extractedGoal),
  // ...
});
```

**AC:**
- [ ] `GoalOnlyInput` type
- [ ] `transformGoalOnly()` function
- [ ] validate-goal.ts генерирует chart
- [ ] Chart показывает Goal Line + траектории (без user)

### Фаза 3: explore chart (~20 LOC)

**Особенности:**
- ЕСТЬ `userTrajectory` или `adhocContext`
- НЕТ Goal

```typescript
// explore.ts
const chartResult = await generateTrajectoryChart({
  mode: state.userTrajectory.length > 0 ? "full" : "candidates-only",
  userTrajectory: state.userTrajectory,
  adhocContext: state.adhocContext,
  candidates: results,
  goalValues: undefined,
  // ...
});
```

**AC:**
- [ ] explore.ts генерирует chart
- [ ] Chart БЕЗ Goal Line

---

## 4. Риски

| Риск | Митигация |
|------|-----------|
| Type mismatch в transformer | Unit test на все типы |
| Пустой path у кандидатов | Fallback на `[matchedContext]` |
| UX перегруз (chart везде) | Можно выключить explore chart |

---

## 5. Quality Gates

- [ ] `npm run lint:fix` — 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Unit tests для `transformGoalOnly()`
- [ ] Smoke test: searchPathfinders → chart URL
- [ ] Smoke test: validate-goal → chart URL
- [ ] Smoke test: explore → chart URL

---

## 6. Промпт для продолжения

```
/mvp-implement tasks/features/FEAT-048-universal-chart-api.md

КОНТЕКСТ:
- Chart работает только для searchWaymates
- Нужно добавить для: searchPathfinders, validate-goal, explore
- Подход: Discriminated Union (расширение существующего паттерна)

ФАЗЫ:
1. Фаза 1: searchPathfinders chart (~40 LOC)
2. Фаза 2: validate-goal chart + mode "goal-only" (~50 LOC)
3. Фаза 3: explore chart (~20 LOC)

КЛЮЧЕВЫЕ РЕШЕНИЯ:
- 3 modes: "full" | "candidates-only" | "goal-only" (NEW)
- Конвертация типов inline в nodes (не в chart module)
- validate-goal: новый mode без user/adhoc, с Goal Line
```
