# Отчёт о падающих тестах

**Дата**: 2025-12-29
**Порядок прогона**: Telegram → Core → Facade

---

## Сводка

| Модуль | Всего тестов | Прошло | Упало |
|--------|--------------|--------|-------|
| Telegram | 9 | 8 | 1 |
| Core (unit + integration) | 154 | 154 | 0 |
| Facade | 121 | 104 | 17 |
| **Итого** | **284** | **266** | **18** |

---

## Упавшие тесты

### Telegram Bot (1 тест)

| № | Тест | Ошибка | Возможная причина |
|---|------|--------|-------------------|
| 1 | **E2E-SG-01**: adhoc → confirm → explore → filters → goal → save returns pathfinders | `expected 'asking_adhoc_context' to be 'confirming_adhoc_context'` | **Routing баг**: `startAdhoc` intent не роутится в `confirming` фазу. LLM вместо подтверждения экстракции запрашивает контекст повторно. Проверить `routeAfterParseSearchIntent` и prompt для adhoc extraction. |

---

### Facade (17 тестов)

#### Normalizer (4 теста)

| № | Тест | Ошибка | Возможная причина |
|---|------|--------|-------------------|
| 2 | **FN2**: Fuzzy match via LLM - typo corrected to canonical | `expected undefined to deeply equal ['python']` | **Normalizer не возвращает skills**. Вероятно, изменён формат ответа от LLM или парсинг `skills` поля. Проверить `FacadeNormalizer.normalize()` и structured output schema. |
| 3 | **FN3**: Save unverified term - unknown skill created with verified=false | `expected undefined to deeply equal ['quantumhyperlang']` | Та же причина — `result.skills` равен `undefined`. |
| 4 | **FN4**: Skills complexity=null - new skill created with null complexity | `expected undefined to deeply equal ['brandnewskill123']` | Та же причина — `result.skills` равен `undefined`. |
| 5 | **FN6**: Full UserContext - all fields normalized correctly | `expected undefined to be 'fintech'` | `result.industry` равен `undefined`. Normalizer возвращает неполный объект. |

---

#### Cold-Start V2 (2 теста)

| № | Тест | Ошибка | Возможная причина |
|---|------|--------|-------------------|
| 6 | **TC-P8**: Minimal CV (single position) | `expected 'story_gathering' to be 'awaiting_plan_confirmation'` | **CV парсинг**: Минимальное CV (1 позиция) не распознаётся как достаточное для плана. Граф остаётся в `story_gathering` вместо перехода в `awaiting_plan_confirmation`. Проверить логику валидации CV в `plan_career` node. |
| 7 | **TC-E4**: Context correction via edit flow | `InvalidStateError: currentEntityContext is missing` | **State corruption**: После edit flow `currentEntityContext` не заполняется. Баг в `apply_context_edit` или `validate_context` nodes. |

---

#### Search Graph (10 тестов)

| № | Тест | Ошибка | Возможная причина |
|---|------|--------|-------------------|
| 8 | **TC-SG-ADV1**: question from showing_results → advising phase | `expected 'asking_search_mode' to be 'showing_results'` | **Routing**: После `save` граф переходит в `asking_search_mode` вместо `showing_results`. Проблема в `routeAfterSetGoal` — не выполняется поиск после сохранения цели. |
| 9 | **TC-SG-ADV3**: exit advisor mode with done | `expected 'advising' to be 'showing_results'` | **Intent parsing**: "спасибо, всё понятно" не распознаётся как `done` intent. LLM классифицирует как `continue` и остаётся в advising. |
| 10 | **TC-SG-E2E-01**: adhoc context → confirm → explore → goal → search results | `expected 'asking_adhoc_context' to be 'confirming_adhoc_context'` | Та же проблема что в Telegram E2E-SG-01. Adhoc экстракция не триггерит confirming фазу. |
| 11 | **TC-SG-E2E-02**: no context → asking_adhoc_context → provide context → confirm | `expected 'asking_adhoc_context' to be 'confirming_adhoc_context'` | Та же причина — adhoc не переходит в confirm. |
| 12 | **TC-SG-GC2**: has goal → show goal → confirm → search | `expected 'asking_search_mode' to be 'showing_results'` | **Routing**: `save` после показа goal не переходит в `showing_results`. Тот же баг что в TC-SG-ADV1. |
| 13 | **TC-SG-PS1**: set_goal saves to Neo4j | `expected 'asking_search_mode' to be 'showing_results'` | Тот же routing баг после `save`. |
| 14 | **TC-SG-PS2**: delete_goal removes from Neo4j | `expected 'asking_search_mode' to be 'showing_results'` | Тот же routing баг. |
| 15 | **TC-SG-SR2**: filter intent → apply_filters → search (has goal) | `expected 'asking_search_mode' to be 'showing_results'` | Тот же routing баг. |
| 16 | **TC-SG-VC1**: existing goal → validate → confirm → search | `expected 'asking_search_mode' to be 'showing_results'` | Тот же routing баг после `save`. |
| 17 | **TC-SG-VC2**: new goal → clarify → save | `expected 'asking_search_mode' to be 'showing_results'` | Тот же routing баг. |

---

#### Upsert-Context (1 тест)

| № | Тест | Ошибка | Возможная причина |
|---|------|--------|-------------------|
| 18 | **TC-UC-E1**: Happy path — full context → saved | `expected 'backend developer' to be 'developer'` | **Role extraction**: LLM извлекает "backend developer" вместо "developer". Prompt для role extraction не уточняет что role = профессия без domain. |

---

## Группировка по root cause

### 1. Search Graph: Routing после `save` (8 тестов: #8, #12, #13, #14, #15, #16, #17 + частично #9)

**Симптом**: `save` intent переводит в `asking_search_mode` вместо `showing_results`.

**Root cause**: В `routeAfterSetGoal` или связанных роутерах отсутствует переход в `search` node после сохранения цели.

**Файлы для проверки**:
- `src/facade/langGraph/search-graph/routers.ts`
- `src/facade/langGraph/search-graph/nodes/set-goal.ts`

---

### 2. Adhoc Context: Extraction не переходит в Confirm (3 теста: #1, #10, #11)

**Симптом**: После ввода контекста остаёмся в `asking_adhoc_context` вместо `confirming_adhoc_context`.

**Root cause**: `parse_adhoc_intent` возвращает `ask` вместо `confirm`. Возможно, LLM не находит достаточно данных или prompt не указывает на confirmation.

**Файлы для проверки**:
- `src/facade/langGraph/search-graph/nodes/parse-adhoc-intent.ts`
- `src/facade/langGraph/search-graph/prompts.ts` (adhoc extraction prompt)

---

### 3. Normalizer: Undefined fields (4 теста: #2, #3, #4, #5)

**Симптом**: `result.skills`, `result.industry` равны `undefined`.

**Root cause**: `FacadeNormalizer.normalize()` не возвращает эти поля. Возможно, structured output изменился или не парсится.

**Файлы для проверки**:
- `src/facade/services/facade-normalizer.ts`
- Zod schema для normalized response

---

### 4. Cold-Start V2: State management (2 теста: #6, #7)

**TC-P8**: Минимальное CV не генерирует план.
**TC-E4**: `currentEntityContext` теряется после edit.

**Файлы для проверки**:
- `src/facade/langGraph/cold-start-v2/nodes/plan-career.ts`
- `src/facade/langGraph/cold-start-v2/nodes/apply-context-edit.ts`

---

### 5. Role Extraction (1 тест: #18)

**Симптом**: LLM возвращает "backend developer" вместо "developer".

**Root cause**: Prompt для role extraction не указывает что role = профессия без seniority/domain.

**Файлы для проверки**:
- `src/facade/langGraph/upsert-context/prompts.ts`

---

## Приоритеты исправления

| Приоритет | Root Cause | Кол-во тестов | Рекомендация |
|-----------|------------|---------------|--------------|
| **P0** | Search Graph routing после save | 8 | Критично для MVP — поиск не работает |
| **P0** | Adhoc extraction → confirm | 3 | Критично — adhoc flow сломан |
| **P1** | Normalizer undefined fields | 4 | Влияет на нормализацию данных |
| **P1** | Cold-Start state management | 2 | CV upload и edit flow сломаны |
| **P2** | Role extraction prompt | 1 | Косметический — LLM добавляет лишнее |
