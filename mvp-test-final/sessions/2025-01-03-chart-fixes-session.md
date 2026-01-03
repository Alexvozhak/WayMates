# Session: Chart Fixes + Infrastructure Improvements

**Дата:** 2025-01-03
**Фокус:** Chart баги (Overlap, Spider, Labels) + Infrastructure (Redis AOF, facade:rebuild команды)

---

## Что сделано

### 1. Overlap — Now Sentinel Fix (ГЛАВНЫЙ FIX)

**Проблема:** Overlap показывал 0 даже когда данные совпадали.

**Причина:** Алгоритм считал overlap только для периодов (point N → point N+1). Последний контекст не имел "следующей точки" → не создавал период.

**Решение:** Добавлен "now sentinel" — виртуальная точка "сейчас" в конец каждой траектории.

**Файл:** `src/chart/services/trajectory-transformer.ts`
```typescript
function addNowSentinel(points: TrajectoryPoint[]): TrajectoryPoint[] {
  const lastPoint = points.at(-1)!;
  return [...points, { timestamp: Date.now(), values: { ...lastPoint.values }, ... }];
}
```

### 2. Overlap — Domains Intersection

**Проблема:** Domains сравнивались как строки (первый элемент массива), не как массивы.

**Решение:** Добавлен `rawArrays` в `TrajectoryPoint`, intersection-based matching для `ARRAY_OVERLAP_FIELDS`.

**Изменённые файлы:**
- `src/chart/types.ts` — `ARRAY_OVERLAP_FIELDS`, `rawArrays` в TrajectoryPoint
- `src/chart/services/trajectory-transformer.ts` — заполнение rawArrays.domains
- `src/chart/services/overlap-calculator.ts` — `checkArrayIntersection()`
- `src/chart/builders/html-renderer.ts` — client-side `checkFieldMatch()` с intersection

### 3. Overlap — excludedOverlapFields

**Проблема:** cityName не совпадал из-за регистра → overlap = 0.

**Решение:** excludedContextFields из поиска передаются в Chart → исключаются из overlap calculation.

**Изменённые файлы:**
- `src/chart/types.ts` — `excludedOverlapFields` в types
- `src/chart/index.ts`, `chart-builder.ts` — прокидывание
- `src/facade/langGraph/search-graph/chart-utils.ts` — конвертация
- Все 4 nodes (search-waymates, search-pathfinders, validate-goal, explore) — передача

### 4. Spider Chart Fixes

**Сделано:**
- Убраны проценты с radial axis (`ticktext: ['', '', '', '']`)
- Полупрозрачные fills (`fillcolor: traj.color + '40'/'30'`)

**Файл:** `src/chart/builders/html-renderer.ts`

### 5. Industry Labels Fix

**Проблема:** Y-axis labels слипались при много значений.

**Решение:** Динамический tickfont size: `levelCount > 12 ? 7 : levelCount > 8 ? 8 : 10`

### 6. createdAt Extraction (Cold-Start)

**Проблема:** Cold-start создавал contexts с `createdAt = new Date()` вместо исторических дат.

**Решение:** Prompt для LLM извлекать START DATE из preview period.

**Изменённые файлы:**
- `src/facade/langGraph/cold-start-v2/prompts.ts`
- `src/facade/langGraph/cold-start-v2/nodes/extract-context.ts`

### 7. Infrastructure

**Redis AOF Persistence:**
- `docker-compose.yml` — `command: redis-server --appendonly yes` + volume

**Две команды facade:rebuild:**
- `npm run facade:rebuild` — сохраняет checkpoints
- `npm run facade:rebuild:clean` — очищает checkpoints

### 8. Quick Test Script

**Файл:** `poc/test-chart-overlap.ts`

Быстрый тест chart (~10 сек) без полного cold-start workflow (~3 мин):
- Использует demo-alex из fixtures
- Передаёт userTrajectory для DTW
- Генерирует chart с Overlap + Spider

---

## Результаты тестов

| Batch | Результат | Время |
|-------|-----------|-------|
| demo-adhoc.yaml | **9/9 passed** | 62.8s |
| demo-cold-start.yaml | **21/21 passed** | 199.8s |

**Chart URLs (финальные):**
- Adhoc Pathfinders: https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/92de8abdbfe6be10b9776405aba2c4d3.html
- Cold-Start Pathfinders: https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/ee29bebf4f2e01ec8cf3c84203bcd090.html
- Cold-Start Waymates: https://pub-3a26a622b51948949e572dc94789c1c6.r2.dev/37ac862393f5ffd28b7534fd01385594.html

---

## Что осталось сделать

### К коммиту:

Все изменения готовы к коммиту:
- Chart fixes (overlap, DTW, spider, labels)
- Cold-start createdAt extraction
- Redis AOF persistence
- facade:rebuild split

**Не коммитить:**
- `poc/test-chart-overlap.ts`, `poc/test-overlap-calculation.ts` — debug tools
- `Profile-parsed.md`, `raw.md` — мусор (удалить)
- `tasks/features/FEAT-05*.md` — drafts

### Connection Lines (minor):

Чекбокс "Show connection lines" — не проверяли работает ли. Low priority.

---

## Ключевые инсайты

1. **Now Sentinel** — обязателен для overlap последнего контекста (period = lastDate → now)

2. **DTW требует userTrajectory** — Core API `search.pathfinders` считает DTW только если передать `userTrajectory` в params

3. **Adhoc vs Cold-Start charts:**
   - Adhoc: `mode: "candidates-only"` → нет DTW/Spider/Overlap
   - Cold-Start: `mode: "full"` → DTW + Spider + Overlap

4. **Quick test vs Batch:**
   - `poc/test-chart-overlap.ts` — ~10 сек, для быстрой проверки chart
   - batch yaml — ~3 мин, для full flow validation

---

## Команды для отладки

```bash
# Quick test chart (без LLM workflow)
set -a && source .env.test && set +a
npx tsx poc/test-chart-overlap.ts

# Rebuild без потери сессий
npm run facade:rebuild

# Batch тесты
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session batch-adhoc --reset --batch tests/e2e/batches/demo-adhoc.yaml
OPENROUTER_API_KEY=... npx tsx poc/mcp-chat.ts --session batch-cs --reset --batch tests/e2e/batches/demo-cold-start.yaml

# Очистка garbage users
MATCH (u:User) WHERE NOT u.userId STARTS WITH 'usr_019b0055' DETACH DELETE u
```

---

## Prompt для продолжения (после rewind)

```
Продолжаем сессию Chart Fixes. Прочитай: mvp-test-final/sessions/2025-01-03-chart-fixes-session.md

Статус:
- ✅ Overlap работает (now sentinel + domains intersection + excludedOverlapFields)
- ✅ Spider chart (прозрачность + без процентов)
- ✅ Industry labels (dynamic tickfont)
- ✅ createdAt extraction (исторические даты)
- ✅ Batch тесты: adhoc 9/9, cold-start 21/21
- ✅ Infrastructure: Redis AOF, facade:rebuild split

Всё готово к коммиту. Создать коммит?
```
