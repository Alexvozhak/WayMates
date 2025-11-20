# Creative: Path Collection Architecture Refactoring - 2025-11-06

## Context

Рефакторинг архитектуры сбора траекторий (path collection) для унификации standalone/batch подходов и упрощения кодовой базы.

**Source**: [PATH_COLLECTION_ARCHITECTURE.md](../docs/architecture/PATH_COLLECTION_ARCHITECTURE.md)

---

## Key Architectural Decisions

### Decision 1: Убрать параметр `direction`

**Rationale:**
- `direction: 'forward' | 'backward'` не имеет бизнес-смысла
- Оба направления возвращают одинаковый результат (путь от start до end)
- Forward: `(start)-[:NEXT_CONTEXT*]->(end)`
- Backward: `(end)<-[:PREVIOUS_CONTEXT*]-(start)`

**Implementation:**
```typescript
// ❌ БЫЛО
buildPathQuery({ direction: 'forward' | 'backward' })

// ✅ СТАЛО
buildPathQuery()  // Всегда backward по PREVIOUS_CONTEXT
```

**Impact**: Упрощение API, меньше параметров

---

### Decision 2: Унифицировать на contextIds (один метод)

**Problem:**
Два разных метода для одного use case "построить траекторию до контекста":
- `collectUserTrajectory(userId)` → userId → current_context_id → path
- `collectContextTrajectories(contextIds)` → contextIds → paths

**Key Insight:**
В обоих случаях строим **траекторию до контекста**! Разница только в том, откуда берем contextId.

**Solution:**
ОДИН метод - всегда работаем с contextIds. Caller (SearchManager) получает current_context_id сам.

```typescript
// ✅ Unified method
class PathCollectorService {
  async collectTrajectories(
    contextIds: string[]
  ): Promise<Array<{contextId: string, path: UserContext[]}>>
}

// Caller получает contextId
const user = await getUser(userId);
const userPaths = await pathCollector.collectTrajectories([user.current_context_id]);
```

**Separation of Concerns:**
- **PathCollectorService**: "Я строю траектории до контекстов. Мне все равно откуда contextId"
- **SearchManager**: "Я знаю бизнес-логику. Для DTW нужен current_context_id - я его получу"

---

### Decision 3: Упростить buildPathQuery (убрать config)

**Problem:**
Сложный конфиг с множеством параметров:
```typescript
export type PathQueryConfig = {
  mode: 'standalone' | 'batch' | 'fragment';
  endpoint: {
    type: 'user' | 'context';
    idParam: string;
  };
  direction: 'forward' | 'backward';
  excludeReasons?: string[];
  preserveVariables?: string[];
};
```

**Solution:**
Простая функция с одним параметром:
```typescript
export function buildPathQuery(
  excludeReasons?: string[]
): string {
  // Всегда batch, всегда backward, всегда contextIds
}
```

**Преимущества:**
- Убрана сложность (mode, endpoint, direction)
- Всегда batch (UNWIND)
- Всегда backward
- Всегда contextIds
- Универсальный алиас `id`

---

### Decision 4: Cypher возвращает универсальный алиас

**Problem:**
Conditional mapping в TypeScript:
```typescript
return result.records.map(rec => ({
  id: rec.get(endpointType === 'current' ? 'userId' : 'contextId'),  // ← Conditional!
  path: rec.get('path')
}));
```

**Solution:**
```cypher
-- ✅ Всегда одинаково
RETURN id AS id, path AS path
```

```typescript
// ✅ Упрощенный маппинг
return result.records.map(rec => ({
  contextId: rec.get('id'),     // ← Всегда 'id'
  path: rec.get('path')
}));
```

---

### Decision 5: Без обратной совместимости

**Rationale:**
- PathCollectorService - internal class
- Единственный consumer - SearchManager (мы его контролируем)
- Integration tests проверят регрессию
- Публичный API (MCP tools) не меняется

**Implementation:**
Меняем сигнатуру напрямую, без deprecated wrappers (временно добавляем deprecated для инкрементального рефакторинга).

---

## TYPE SCHEMA

```typescript
// === PATH COLLECTION TYPES ===

import { z } from "zod";
import { UserContextSchema } from "./schemas.js";

/**
 * Result of batch path collection query
 */
export const PathBatchResultSchema = z.object({
  contextId: z.string().describe("Context ID for which trajectory was collected"),
  path: z.array(UserContextSchema).describe("Trajectory from career start to this context")
});

export type PathBatchResult = z.infer<typeof PathBatchResultSchema>;
```

**Note:** Единственный тип - PathBatchResult (без дублирования CollectTrajectoriesResult).

---

## Critical Bugs Found (Reviewer Agent)

### Bug #1: 🔴 excludedReasons missing (DATA CORRUPTION!)

**Impact:** User trajectory загружается БЕЗ фильтрации, candidates С фильтрацией → DTW метрики некорректны!

**Fix:** Добавить параметр `excludedReasons` в `computeDTWScores`.

### Bug #2: 🔴 current_context_id can be null

**Impact:** Crash при `MATCH (end:Context {context_id: null})`.

**Fix:** Валидация в `getUser()` helper.

### Bug #3: 🟡 rec.get('path') can be null

**Impact:** Crash если все contexts отфильтрованы.

**Fix:** Null safety check перед `.map()`.

### Bug #4: 🟡 UserContextSchema.parse() without try/catch

**Impact:** Generic ZodError без контекста.

**Fix:** Wrap в try/catch с contextId в error message.

### Bug #5: 🟡 Empty contextIds array

**Impact:** Unnecessary DB query.

**Fix:** Early return if `contextIds.length === 0`.

---

## Implementation Sequence

**9 инкрементальных шагов** (вместо breaking changes):

1. Упростить `buildPathQuery` (убрать config)
2. Добавить `PathBatchResultSchema` в schemas.ts
3. **Добавить новый метод** `collectTrajectories` (НЕ удаляя старый!)
4. Добавить `getUser` helper в SearchManager
5. Обновить `computeDTWScores` с фиксом Bug #1
6. **ПРОМЕЖУТОЧНАЯ ВАЛИДАЦИЯ** через Neo4j MCP
7. Удалить deprecated методы
8. Удалить `dtw-query-builder.ts`
9. **ФИНАЛЬНАЯ ВАЛИДАЦИЯ** через Neo4j MCP

**Validation:** Через Neo4j MCP (не integration tests - старые invalid, новых нет).

---

## Validation Results (Planner Agent)

**Status:** ⚠️ APPROVED WITH CONDITIONS

**Key Feedback:**
1. TYPE SCHEMA duplication → использовать один PathBatchResult
2. Implementation sequence error → инкрементальная последовательность (9 шагов)
3. Дополнительные риски:
   - getUser делает дополнительный запрос (🟡 MEDIUM)
   - Пустой массив contextIds (🟡 LOW)
   - Null current_context_id (🔴 HIGH)

---

## Validation Results (Reviewer Agent)

**Status:** ❌ CRITICAL BUGS FOUND

**5 критических багов** (описаны выше в разделе Critical Bugs Found).

**Corrected Code:** Полные исправленные версии в [PATH_COLLECTION_ARCHITECTURE.md](../docs/architecture/PATH_COLLECTION_ARCHITECTURE.md#итоговый-исправленный-код).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking change в PathCollectorService | Integration tests выявят consumers |
| getUser может быть медленным | Кэшировать или получать вместе с user search |
| Fragment mode все еще сложный | Не трогаем (Phase 2 с PROFILE) |

---

## Преимущества финального плана

| Аспект | До | После |
|--------|----|----|
| **Методов в PathCollectorService** | 2 (user + context) | 1 (unified) |
| **Параметров в buildPathQuery** | 6 (mode, endpoint, direction, etc.) | 1 (excludeReasons) |
| **Conditional logic** | userId vs contextId | Всегда contextId |
| **Cypher queries** | 3 варианта (standalone/batch/fragment) | 1 batch |
| **Direction параметр** | forward/backward | Всегда backward |
| **Separation of Concerns** | Смешано | Четкое разделение |

---

## What NOT to do (Phase 2)

❌ НЕ менять buildMatchedContextBase (Phase 2)
❌ НЕ менять target-query-builder (Phase 2)
❌ НЕ удалять fragment mode (Phase 2)
❌ НЕ делать performance benchmark (YAGNI)

---

## Related Documents

- [PATH_COLLECTION_ARCHITECTURE.md](../docs/architecture/PATH_COLLECTION_ARCHITECTURE.md) - полная документация
- [path-collector.service.ts](../src/core/path-collector.service.ts) - текущая реализация
- [path-query-builder.ts](../src/core/path-query-builder.ts) - query builder для рефакторинга

---

## Next Steps

1. ✅ Приступить к шагу 1 (упростить buildPathQuery)
2. Следовать 9-шаговому плану
3. Валидация через Neo4j MCP после шагов 6 и 9

---

**Tags:** #architecture #refactoring #path-collection #batch-query #separation-of-concerns #type-schema
