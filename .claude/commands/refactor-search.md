---
name: refactor-search
description: Рефакторинг архитектуры поиска — searchWaymates, searchPathfinders, reverseSearchPathfinders
model: opus
allowed-tools:
  [
    "Read",
    "Edit",
    "Write",
    "Grep",
    "Glob",
    "Bash(npm run:*)",
    "Bash(npx tsc:*)",
    "Bash(npx vitest:*)",
    "Bash(git status:*)",
    "Bash(git log:*)",
    "Bash(git show:*)",
    "Bash(docker logs:*)",
    "Bash(set -a && source .env.test && set +a && npx tsx:*)",
    "TodoWrite",
    "AskUserQuestion",
    "mcp__neo4j-cypher__read_neo4j_cypher",
    "mcp__neo4j-cypher__get_neo4j_schema",
    "mcp__sequential-thinking__sequentialthinking",
  ]
---

# Refactor Search Architecture

> **Роль**: Реализатор архитектурного рефакторинга
> **Цель**: Разделить поиск на 3 семантически чистых режима
> **База знаний**: `mvp-test-final/KNOWLEDGE-BASE.md` (секция Search Architecture)

---

## 🎯 Бизнес-логика (КРИТИЧНО понять перед кодом)

### Три режима поиска

| Режим | Кого ищем | Recency на | Требует Goal |
|-------|-----------|------------|--------------|
| **searchWaymates** | Однопутники с ТЕМ ЖЕ текущим контекстом | текущий контекст кандидата | Нет |
| **searchPathfinders** | Кто прошёл ОТ нашего контекста К нашей цели | целевой контекст кандидата | ДА |
| **reverseSearchPathfinders** | Кто достиг target (любой старт) | целевой контекст кандидата | ДА |

### Ключевые отличия

1. **Waymates** = peers в одной лодке СЕЙЧАС
   - Match: candidate.currentContext = our.current
   - Recency: "он ещё там? не ушёл?"

2. **Pathfinders** = proof of transition (наш путь возможен)
   - Match 1: candidate.history содержит our.current (был где мы)
   - Match 2: candidate.history содержит our.goal (достиг куда мы хотим)
   - Recency на goal: "он недавно достиг цели?"

3. **ReversePathfinders** = reverse engineering (откуда приходят на target)
   - Match: candidate.history содержит target
   - Recency на target: "он недавно достиг target?"

---

## 📚 Загрузить при старте

```bash
Read mvp-test-final/KNOWLEDGE-BASE.md     # Search Architecture секция
Read src/core/search-manager.ts           # Текущая реализация
Read src/cypher/queries/search.ts         # Cypher queries
Read src/core/routers/search.ts           # tRPC router
Read eslint.config.mjs                    # ESLint constraints
```

---

## 📋 Фазы работы

### Фаза 1: reverseSearchPathfinders (rename) — ~40 LOC

**Что делаем:** Переименование searchByTarget → reverseSearchPathfinders

**Файлы:**
- `src/cypher/queries/search.ts` — rename `buildTargetSearchWithPathsQuery` → `buildReversePathfinderSearchQuery`
- `src/cypher/index.ts` — update export
- `src/core/search-manager.ts` — rename `searchByTarget` → `reverseSearchPathfinders`
- `src/core/routers/search.ts` — rename `byTarget` procedure → `reversePathfinders`
- `src/facade/langGraph/search-graph/nodes/validate-goal.ts` — update call
- `tests/core/integration/search-manager/target-search.integration.ts` — rename test descriptions

**Критерий завершения:** tsc + lint pass, тесты проходят

---

### Фаза 2: searchWaymates (refactor) — ~95 LOC

**Что делаем:** Объединить searchAdhoc + searchByUser, убрать мёртвый pathfinder код

**Файлы:**
- `src/cypher/queries/search.ts`:
  - Убрать pathfinder CASE (мёртвый код, строки ~167-179)
  - Переименовать `buildCurrentSearchQuery` → `buildWaymatesSearchQuery`
- `src/cypher/index.ts` — update export
- `src/core/search-manager.ts`:
  - Убрать `searchAdhoc`, `searchByUser`
  - Новый метод `searchWaymates(params: WaymatesSearchParams)`
  - `WaymatesSearchParams = { referenceContext?, userId?, ... }` — adhoc vs DB
- `src/core/routers/search.ts` — новый procedure `waymates`
- `src/facade/langGraph/search-graph/nodes/explore.ts` — update call
- `src/shared/schemas.ts` — `WaymatesSearchParams` type
- Тесты: обновить expectations (candidateType теперь только 'waymate' или null)

**Критерий завершения:** tsc + lint pass, тесты проходят

---

### Фаза 3: searchPathfinders (new) — ~185 LOC

**Что делаем:** Новый Cypher запрос с двойным матчем

**Файлы:**
- `src/cypher/queries/search.ts`:
  - NEW `buildPathfinderSearchQuery` — сложный запрос:
    ```cypher
    // Match 1: кандидат имел контекст как у нас
    MATCH (candidate)-[:HAS_CONTEXT]->(startCtx:Context)
    WHERE startCtx matches $referenceContext

    // Match 2: кандидат достиг нашей цели
    MATCH (candidate)-[:HAS_CONTEXT]->(goalCtx:Context)
    WHERE goalCtx matches $targetContext
      AND goalCtx.createdAt > startCtx.createdAt
      AND age(goalCtx) <= $recencyThresholdMonths

    // Collect path
    ```
- `src/cypher/index.ts` — export
- `src/core/search-manager.ts` — NEW `searchPathfinders` method
- `src/core/routers/search.ts` — NEW `pathfinders` procedure
- `src/facade/langGraph/search-graph/nodes/validate-goal.ts` — call pathfinders вместо waymates для pathfinder данных
- `src/shared/schemas.ts` — `PathfinderSearchParams` type
- NEW tests: `tests/core/integration/search-manager/pathfinders.integration.ts`

**Критерий завершения:** tsc + lint pass, новые тесты проходят

---

## 🔍 Pre-Action Declaration (ОБЯЗАТЕЛЬНО)

**Перед КАЖДЫМ изменением кода:**

```markdown
- **Проблема**: [что решаем]
- **Решение**: [как решаем]
- **Файл**: [какой файл меняем]
- **Источник**: [doc/код/додумал — откуда знаю что так правильно]
- **Уверенность**: X% — [почему]
```

---

## 🧪 Тестирование

**В конце ВСЕХ фаз:**

```bash
npx tsc --noEmit
npm run lint:fix
npm run test:integration:run
```

**Ручное тестирование (опционально):**

```bash
set -a && source .env.test && set +a
npx tsx poc/mcp-chat.ts --reset
npx tsx poc/mcp-chat.ts "я backend разработчик"
```

---

## 📋 ESLint Constraints (помнить!)

| Правило | Лимит | Что делать |
|---------|-------|------------|
| max-lines-per-function | 60 | Разбивать на helpers |
| max-depth | 2 | Early return, guard clauses |
| complexity | 8 | Упрощать логику |

---

## 🚫 ЗАПРЕТЫ

| # | Запрет | Вместо этого |
|---|--------|--------------|
| 1 | Код без Pre-Action | Сначала описать план |
| 2 | `any` типы | Явные типы |
| 3 | `export default` | Named exports |
| 4 | Смешанные импорты | `import type` отдельно |
| 5 | Функции > 60 LOC | Разбивать |
| 6 | Глубина > 2 | Early return |
| 7 | Угадывать бизнес-логику | Спросить если < 90% |
| 8 | Импровизация | Строго по фазам |

---

## ✅ Критерии завершения

- [ ] Pre-Action Declaration для каждого изменения
- [ ] Session log обновлён (sessions/)
- [ ] Все 3 фазы завершены
- [ ] tsc: 0 errors
- [ ] lint: 0 errors
- [ ] integration tests: pass
- [ ] Бизнес-логика соответствует таблице (Waymates/Pathfinders/Reverse)

---

## 📝 Session Log

Файл: `sessions/YYYY-MM-DD-refactor-search.md`

Формат:
```markdown
## Фаза N: [название]

### Что сделано
1. **[файл]** — [изменение]

### Проблемы
- [если были]

### Инсайты
- [что узнали]
```

---

## 💡 Полезные паттерны

### Adhoc vs DB — единый метод

```typescript
async searchWaymates(params: WaymatesSearchParams): Promise<...> {
  const referenceContext = params.referenceContext
    ?? await this.resolveContext(params.userId!);

  // единая логика поиска
}
```

### Guard Clause для уменьшения глубины

```typescript
function process(data: Data | null): Result {
  if (!data) return { error: "No data" };

  // основная логика на глубине 1
}
```
