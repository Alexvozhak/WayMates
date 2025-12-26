# Session: Intent Classification Refactoring

**Дата:** 2025-12-27
**Ветка:** `feature/search-refactor`
**Статус:** ✅ COMPLETED

---

## Контекст

Ручное тестирование UX бота через `poc/mcp-chat.ts`. Обнаружен критический баг: "глянь похожих" в фазе `confirming_adhoc_context` → cancel.

---

## Фаза 1: Диагностика

### Что обнаружили

| # | Проблема | Причина |
|---|----------|---------|
| 1 | "глянь похожих" → `searchWaymates` intent → fallback на `cancel` | Intent `searchWaymates` не в routing для `confirming_adhoc_context` |
| 2 | LLM выбирает invalid intent (searchWaymates) хотя PHASE_CONTEXT говорит "Valid: proceed, clarify, ask, cancel" | Prompt показывает ВСЕ intent descriptions, LLM игнорирует "Valid:" constraint |

### Архитектурный анализ

**Два уровня intent classification:**
1. **Orchestrator** (`classifyIntent`) — какой граф запустить
2. **Graph-internal** (`parseUserIntent`) — куда роутить внутри графа

**Проблема:** `parseUserIntent` показывает ВСЕ intent descriptions в prompt. LLM семантически матчит "глянь похожих" → `searchWaymates` ("wants similar people"), игнорируя Valid constraint.

**Router как single source of truth:** `createIntentRoutes(flags)[phase]` уже знает какие intents валидны для какой фазы. Но prompt не использует эту информацию.

---

## Фаза 2: Архитектурное решение

### Убрали дублирование

**Было (3 источника правды):**
1. `INTENT_DESCRIPTIONS` — описания всех интентов
2. `PHASE_CONTEXT` — valid интенты по фазам (строки!)
3. `createIntentRoutes()` — маппинг intent → node

**Стало (2 источника правды):**
1. `INTENT_DESCRIPTIONS` — описания всех интентов
2. `createIntentRoutes()` — единственный source of truth для valid intents

### Реализовано

| Файл | Изменение |
|------|-----------|
| `search-router.ts` | +`getValidIntentsForPhase(phase, flags)` — извлекает valid intents из router |
| `search-router.ts` | +`export RouteFlags`, `export createIntentRoutes` |
| `classification.ts` | Удалён `PHASE_CONTEXT`, prompt строится динамически из valid intents |
| `parse-intent.ts` | Signature: `parseUserIntent(message, phase, flags)` |
| `parse-search-intent.ts` | Передаёт flags в parseUserIntent |
| `apply-filters.ts` | Убран re-parse (был двойной LLM вызов) |

### Убрали двойной LLM вызов

**Было:**
```
parse_search_intent → parseUserIntent() → intent="filter"
    ↓
apply_filters → parseUserIntent() СНОВА!
```

**Стало:**
```
parse_search_intent → parseUserIntent() → intent="filter", currentSearchParams extracted
    ↓
apply_filters → просто читает currentSearchParams из state
```

---

## Фаза 3: Новый intent `explore`

### Проблема

`proceed` = "agrees to continue WITHOUT new info". Не покрывает "глянь похожих" семантически.

### Решение

Добавили intent `explore`:
- **Semantic:** "User wants to SEE SIMILAR PEOPLE without setting a goal"
- **Routing:** `explore: hasGoal ? NODE.search_waymates : NODE.explore`

### Изменения

| Файл | Изменение |
|------|-----------|
| `state.ts` | `SIMPLE_INTENTS += "explore"` |
| `classification.ts` | `INTENT_DESCRIPTIONS.explore` |
| `search-router.ts` | `confirmingRoutes.explore = hasGoal ? NODE.search_waymates : NODE.explore` |

### Умная маршрутизация

| Сценарий | Intent | hasGoal | Роутинг | UI |
|----------|--------|---------|---------|-----|
| Новый юзер + "глянь похожих" | explore | false | NODE.explore | Browse candidates |
| Юзер с целью + "глянь похожих" | explore | true | NODE.search_waymates | Results (waymates) |

---

## Что нужно проверить после rewind

1. **Тест flow:** `mcp-chat.ts --reset` → "Я backend, TypeScript, Россия" → "middle" → "глянь похожих"
   - Ожидание: `explore` intent → NODE.explore → showing_exploration_candidates

2. **Тест с goal:** Если у юзера есть сохранённая цель, "глянь похожих" должен идти в NODE.search_waymates

3. **Lint/tsc:** Убедиться что `hasGoal` используется (была lint ошибка unused var)

---

## Открытый вопрос

> "Юзер с goal теряет фильтрацию" - ты уверен?

**Ответ:** НЕТ, не теряет! `explore: hasGoal ? NODE.search_waymates : NODE.explore`.
- Если hasGoal=true → NODE.search_waymates (фильтрация по цели)
- Если hasGoal=false → NODE.explore (все кандидаты)

**Но:** NODE.explore вызывает тот же search что и NODE.search_waymates. Разница в UI — explore показывает "browse" фазу, search_waymates показывает "results" фазу.

---

## Артефакты

- `mvp-test-final/tests_report.md` — баг #8 (IN_PROGRESS)
- `search-router.ts:103-110` — новые confirmingRoutes
- `classification.ts:54-55` — explore description

---

## Рефлексия

### Ошибка: Не понял семантику `proceed` vs `explore`

**Паттерн:** Думал что `proceed` = "любое согласие продолжить". На самом деле `proceed` = "согласие БЕЗ новой информации".

**Первопричина:** Не вчитался в описание intent. "agrees to continue WITHOUT adding new info" — ключевое слово WITHOUT.

**Урок:** "глянь похожих" = новая информация (что хочет пользователь). Это не proceed.

### Ошибка: Prompt показывал все intents

**Паттерн:** PHASE_CONTEXT говорил "Valid: X, Y, Z", но INTENT_DESCRIPTIONS показывали все 12 интентов.

**Первопричина:** LLM делает semantic matching по descriptions, игнорирует constraints.

**Урок:** Prompt должен показывать ТОЛЬКО valid intents. Router = source of truth.

---

## Промпт для rewind

```
Продолжаю сессию из `sessions/2025-12-27-intent-classification-refactor.md`.

Контекст: Реализовали фикс intent classification — добавили `explore` intent, убрали дублирование (PHASE_CONTEXT → derive from router).

Нужно:
1. Проверить lint/tsc
2. Пересобрать facade: `npm run facade:rebuild`
3. Протестировать: `mcp-chat.ts --reset` → "Я backend, TypeScript, Россия" → "middle" → "глянь похожих"
4. Ожидание: intent=explore → explore node → showing_exploration

Если работает — закрыть баг #8 в tests_report.md.
```

---

## Фаза 4: Верификация (2025-12-27)

### Тест

```
mcp-chat.ts --reset
→ "Я backend, TypeScript, Россия" → asking_adhoc_context
→ "middle" → confirming_adhoc_context
→ "глянь похожих" → showing_exploration_candidates ✅
```

### Логи

```
intent: "explore"
reasoning: "The user is asking to see similar people without specifying a particular goal, indicating a desire to browse options."
```

### Результат

**Баг #8 FIXED** — intent classification теперь работает корректно.
