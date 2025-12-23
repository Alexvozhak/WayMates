# FEAT-040: SearchGraph Architecture Cleanup

**Статус:** PENDING
**Приоритет:** P1
**Источник:** Code review сессия 2025-12-23

---

## Проблема

SearchGraph накопил архитектурный долг:
- Дублирование схем и state полей
- Неконсистентный naming
- Баги в бизнес-логике
- Dead code
- enrichResponse async wrapper вместо чистой архитектуры

---

## Инвентаризация проблем

### Phase 1: Bugs (критичные)

#### 1.1 pathLimit не вычисляется
**Файл:** `src/facade/langGraph/search-graph/nodes/apply-filters.ts:48`

```typescript
// Сейчас (❌):
pathLimit: limit,

// Должно быть (✅):
const pathLimitRaw = parsed.filters.pathLimit ?? limit;
pathLimit: Math.min(pathLimitRaw, limit),
```

Бизнес-правило: `pathLimit ≤ limit` (см. shared/schemas.ts withPathLimitTransform).

#### 1.2 reasons отсутствуют в getForExtraction()
**Файл:** `src/facade/services/dictionaries-cache.ts`

LLM extraction промпт говорит "map to KNOWN REASONS" но не получает список.
Добавить `reasons: string[]` в ExtractionDictionaries.

---

### Phase 2: Dead code

#### 2.1 userService — удалить
**Git blame:** `f03e997` — добавлен при миграции, никогда не использовался.

Файлы:
- `src/facade/langGraph/shared/types.ts` — GraphDeps, hasUserService
- `src/facade/mcp-server/mcp-server.ts`
- `src/facade/mcp-server/tools/base-tool.ts`
- `src/facade/index.ts`
- `src/facade/services/auth.service.ts`

#### 2.2 hasUserService — дублирует проверки
```typescript
// Сейчас (дублирует hasConfigDeps):
return !!c && "coreClient" in c && "normalizer" in c && "userService" in c;

// Удалить вместе с userService
```

---

### Phase 3: State дублирование

#### 3.1 currentSearchParams vs appliedFilters
**Файл:** `src/facade/langGraph/search-graph/nodes/apply-filters.ts`

```typescript
// Возвращает ОБА с почти идентичными данными:
currentSearchParams: { excludedContextFields, ... },
appliedFilters: { excludedContextFields, ..., rejectedFields }
```

**Fix:** Одно поле `currentSearchParams` с optional `rejectedFields`.

#### 3.2 explorationResults vs searchResults (optional)
Можно объединить в `candidates`, семантику определять по phase.
Низкий приоритет — clarity vs минимизм.

---

### Phase 4: Naming cleanup

#### 4.1 existingGoal → storedGoal
`existingGoal` содержит Goal из БД. "stored" точнее.

#### 4.2 extractedGoal → targetContext
`extractedGoal` может быть как extracted из message, так и loaded из БД.
`targetContext` нейтральное название.

#### 4.3 goalSchema.targetCriteria → targetContext
```typescript
// Inconsistency:
createGoalInputSchema = { targetContext: ... }  // ✅
goalSchema = { targetCriteria: ... }  // ❌

// Fix: переименовать в goalSchema
```

#### 4.4 intent → orchestratorIntent
Три intent поля в state:
- `intent` — от orchestrator (перед графом)
- `searchUserIntent` — внутри графа
- `advisorIntent` — в advisor subflow

`intent` → `orchestratorIntent` для ясности.

---

### Phase 5: Schema consolidation

#### 5.1 appliedFiltersSchema не используется
**shared/schemas.ts:512** — определён но facade использует свой `targetSearchParamsWithFeedbackSchema`.

**Fix:** Использовать appliedFiltersSchema, удалить дубликат в facade/types.ts.

#### 5.2 Modification schemas — derive from base
```typescript
// Сейчас (дублирование):
currentSearchParamsModificationSchema = z.object({
  excludedContextFields: z.array(...).nullable(),
  ...
});

// Правильно:
currentSearchParamsModificationSchema = currentSearchParamsBaseSchema
  .omit({ userId: true })
  .partial();
```

#### 5.3 mcpSearchByTargetParamsSchema → facade
Это MCP concern, не должен быть в shared.

---

### Phase 6: enrichResponse removal

#### 6.1 Убрать enrichResponse
**Файл:** `src/facade/langGraph/search-graph/search-graph.ts:56-93`

Async wrapper вокруг sync stateToResponse. Причина — cache.getReasons() async.

#### 6.2 Статика в NlpFormatter
```typescript
// Вместо передачи в response:
availableFilters: null,  // enrichResponse patched
currentFilters: null,    // enrichResponse patched
options: OPTIONS.showResults,

// NlpFormatter знает сам:
- reasons (inject DictionariesCache)
- contextFields (статический enum)
- options (по phase)
```

#### 6.3 responseBuilders чистые
После рефакторинга responseBuilders возвращают только dynamic state data.

---

## Acceptance Criteria

### Phase 1
- [ ] pathLimit вычисляется как `Math.min(pathLimit, limit)`
- [ ] reasons добавлены в ExtractionDictionaries

### Phase 2
- [ ] userService удалён из GraphDeps
- [ ] hasUserService удалён
- [ ] Все импорты UserService удалены

### Phase 3
- [ ] appliedFilters объединён с currentSearchParams
- [ ] Одно поле с optional rejectedFields

### Phase 4
- [ ] existingGoal → storedGoal
- [ ] extractedGoal → targetContext
- [ ] goalSchema.targetCriteria → targetContext
- [ ] intent → orchestratorIntent

### Phase 5
- [ ] targetSearchParamsWithFeedbackSchema удалён, используется appliedFiltersSchema
- [ ] Modification schemas derive from base
- [ ] mcpSearchByTargetParamsSchema перемещён в facade

### Phase 6
- [ ] enrichResponse удалён
- [ ] NlpFormatter inject DictionariesCache
- [ ] responseBuilders sync, без null полей
- [ ] options убраны из response

### Quality Gates
- [ ] lint + tsc проходят
- [ ] Все тесты проходят (unit + integration + facade)

---

## Зависимости

- FEAT-039 ✅ (hints в NlpFormatter — NlpFormatter уже меняется)

---

## Риски

- **Большой scope** — много файлов затронуто
- **Breaking changes** — schema renames могут сломать тесты
- **Regression** — нужна полная test suite validation

---

## Рекомендация

Разбить на PR по phases:
1. PR #1: Phase 1 (bugs) — критичные фиксы
2. PR #2: Phase 2 (dead code) — простое удаление
3. PR #3: Phase 3-4 (state + naming) — рефакторинг
4. PR #4: Phase 5-6 (schemas + enrichResponse) — архитектура
