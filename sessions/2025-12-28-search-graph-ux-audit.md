# Session: Аудит UX и архитектуры search-graph

**Дата:** 2025-12-28
**Ветка:** `feature/search-refactor`
**Статус:** ✅ IMPLEMENTATION COMPLETE

---

## Контекст

Продолжение работы после `clarificationText-refactor` и `search-unification-implementation`. Фокус на аудите UX: интенты, ноды, чарты, interrupts.

---

## Фаза 1: Аудит интентов и нод (DONE)

### Выводы

**Интенты:**
- 13 интентов в системе, большинство с чёткой ЗО
- Проблемные: `proceed` (перегружен), `clarify` (контекстно-зависим)

**Ноды:**
- 26 нод, все с чёткой ЗО, SRP соблюдается

**Чарты:**
- explore: генерирует (candidates-only/full)
- validate_goal: генерирует (goal-only)
- show_results: НЕ генерирует в adhoc mode — **БАГ**

**Facets fallback:**
- explore: есть
- validate_goal: есть
- show_results: **НЕТ** — потенциальный баг при >10 кандидатах

---

## Фаза 2: Анализ interrupts (DONE)

### Текущее состояние

**Сценарий: adhoc + цель ЕСТЬ + хочу waymates**
```
confirm_adhoc_context [INTERRUPT 1]
→ proceed → extract_goal (ТЕРЯЕТ существующую цель!)
→ show_goal [INTERRUPT 2]
→ set_goal → ask_search_mode [INTERRUPT 3]
→ search_waymates → show_results [INTERRUPT 4]
```
**4 interrupts + теряем цель!**

### Проблемы routing в confirming_adhoc_context

1. `proceed` → `extract_goal` ВСЕГДА, даже если цель есть
2. Нет `searchWaymates`/`searchPathfinders` интентов
3. Нет `validate` интента
4. `clarify` ведёт только к профилю, не к цели

---

## Фаза 3: Research conversational UX (DONE)

Создан файл: `sessions/2025-12-28-conversational-ux-research.md`

### Ключевые findings

- **Intent-Driven** vs **Phase-Driven** — разные парадигмы UX
- Confidence thresholds (90%/75%/50%) для автономности
- Streaming для "живости"

### Решение

**Полная переписка — overkill.** Точечные фиксы дадут 80% результата.

---

## Фаза 4: Архитектурное решение (DONE)

### Проблема

LLM НЕ знает про `hasGoal` — видит одинаковые интенты всегда. `hasGoal` влияет только на routing, не на доступность интентов.

### Решение (согласовано)

**Одна точка проверки hasGoal — в `createConfirmingRoutes`:**

```typescript
function createConfirmingRoutes(hasGoal: boolean): RouteMap {
  if (hasGoal) {
    return {
      searchWaymates: NODE.search_waymates,
      searchPathfinders: NODE.search_pathfinders,
      validate: NODE.validate_goal,
      editGoal: NODE.load_existing_goal,
      editProfile: NODE.load_context,
      ask: NODE.generate_answer,
      cancel: NODE.cancel,
      unknown: NODE.clarify_intent,
    };
  } else {
    return {
      explore: NODE.explore,
      setGoal: NODE.extract_goal,
      editProfile: NODE.load_context,
      ask: NODE.generate_answer,
      cancel: NODE.cancel,
      unknown: NODE.clarify_intent,
    };
  }
}
```

**Результат:**
- hasGoal=true → LLM видит: searchWaymates, searchPathfinders, validate, editGoal, editProfile
- hasGoal=false → LLM видит: explore, setGoal, editProfile
- Routing простой — без условий hasGoal

---

## Фаза 5: Реализация (DONE)

### Коммиты

- `c4a692b` — routing refactor + show_results fix
- `63ee610` — docs: testing matrix + --telegramId docs

### Что реализовано

1. **state.ts** — добавлены интенты: `setGoal`, `editGoal`, `editAdhoc`
2. **classification.ts** — добавлены INTENT_DESCRIPTIONS
3. **search-router.ts** — константы `CONFIRMING_WITH_GOAL_ROUTES`, `CONFIRMING_NO_GOAL_ROUTES`
4. **show_results.ts** — candidates-only chart для adhoc mode
5. **poc/mcp-chat.ts** — опция `--telegramId` для profile flow тестирования

### Manual тесты (все ✅)

| From Phase | Input | Intent | To Phase |
|------------|-------|--------|----------|
| confirming_adhoc (no goal) | "покажи похожих" | explore | showing_exploration_candidates |
| confirming_adhoc (no goal) | "хочу стать CTO" | setGoal | showing_goal |
| confirming_adhoc (no goal) | "нет, я middle" | editAdhoc | confirming_adhoc |
| asking_search_mode | "покажи проводников" | searchPathfinders | showing_results |
| showing_goal (profile+goal) | "покажи кто достиг" | validate | asking_after_validate_candidates |
| asking_after_validate (profile) | "хочу изменить цель" | change | showing_goal |

---

## Что делать дальше

### Из этой сессии (опционально)
1. Покрыть больше кейсов в матрице тестирования (`tests_report.md`)
2. Тестирование cold-start-v2 графа
3. Тестирование orchestrator интентов

### Из search-unification-implementation.md (⏳ не сделано)
1. **Интеграционные тесты** — `npx vitest run tests/core/integration`
2. **Smoke test pathfinders** — `npx tsx poc/test-pathfinders.ts`
3. **E2E Telegram test** — проверить поисковый flow
4. carryVars → константы (minor, читаемость)

### Из clarificationText-refactor.md (⏳ не сделано)
1. **ask intent тестирование** — "что ты умеешь?" после рефакторинга
2. **Токсичный пользователь** — edge cases (gibberish, смена темы, отмена)

---

## Полезные ссылки

- `sessions/2025-12-28-conversational-ux-research.md` — research best practices
- `sessions/2025-12-28-clarificationText-refactor.md` — предыдущий рефакторинг
- `sessions/2025-12-28-search-unification-implementation.md` — унификация waymates/pathfinders

---

## Рефлексия сессии (фаза реализации)

### Ошибки и корректировки

1. **Назвал интент `editProfile` вместо `editContext`/`editAdhoc`**
   - Пользователь: "editContext, не профайл, откуда ты его вообще взял"
   - Урок: Использовать терминологию проекта (adhocContext, не profile)

2. **Предложил inline routing вместо констант**
   - Пользователь: "вынести в константы? если они не динамические?"
   - Урок: Статичные данные → константы (как EXPLORATION_ROUTES, SEARCH_MODE_ROUTES)

3. **Формат матрицы тестирования был неоднозначным**
   - Первый формат: `| Дата | Коммит | Test Case | Flow | Intent | Result |`
   - Пользователь: "нет ли неоднозначности"
   - Исправлено: `| Коммит | From Phase | Input | Intent | To Phase | Result |`
   - Урок: From Phase + To Phase однозначно описывают transition

4. **Пытался передать userId напрямую вместо telegramId**
   - Реальность: `findByTelegramId` ищет в Postgres, не в Neo4j
   - Урок: Понимать какой сервис за что отвечает (Postgres = facade.users, Neo4j = граф)

5. **Добавил примеры в промпт когда не просили**
   - Пользователь: "давай короче и без примеров, уже есть"
   - Урок: Минимализм в документации — ссылаться на существующее

---

## Промпт для rewind

```
Прочитай sessions/2025-12-28-search-graph-ux-audit.md — статус COMPLETE.

СДЕЛАНО:
- Routing refactor: CONFIRMING_WITH_GOAL_ROUTES / CONFIRMING_NO_GOAL_ROUTES
- Интенты: setGoal, editGoal, editAdhoc
- show_results: candidates-only chart для adhoc
- mcp-chat.ts: --telegramId для profile flow
- Матрица тестирования в tests_report.md

КОММИТЫ: c4a692b, 63ee610, f2f5759

БЭКЛОГ (⏳ не сделано из связанных сессий):
1. Интеграционные тесты — npx vitest run tests/core/integration
2. Smoke test pathfinders — npx tsx poc/test-pathfinders.ts
3. E2E Telegram test
4. ask intent тестирование — "что ты умеешь?"
5. Токсичный пользователь — edge cases

См. секцию "Что делать дальше" в файле сессии.
```
