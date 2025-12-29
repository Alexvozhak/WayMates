# Session: Cold-Start MVP Readiness Check

**Дата:** 2025-12-29
**Фокус:** Анализ FEAT-051, проверка готовности cold-start к MVP
**Команда:** `/manual-test-debug` с FEAT-051

---

## Фаза 1: Анализ проблем из FEAT-051

### Что проверяли
- P0: Слишком много required полей (9+)
- P0: Extraction не извлекает implicit info (Москва → RU)
- P1: Clarification UX
- P1: Skip optional

### Результаты проверки

| Проблема | Ожидание | Факт |
|----------|----------|------|
| Implicit extraction | Не работает | ✅ РАБОТАЕТ (Москва→ru, Питер→ru) |
| Position normalization | Не работает | ✅ РАБОТАЕТ (middle, team lead) |
| Skills/domains | Не из словаря | ✅ РАБОТАЕТ |
| Батчинг missing fields | По одному | ✅ УЖЕ БАТЧИТ |

**Вывод:** Большинство P0 проблем из FEAT-051 уже решены или не воспроизводятся.

---

## Фаза 2: Найденные реальные проблемы

### Проблема 1: Intent classification
**Симптом:** "Расскажу о себе" + описание → adhoc вместо cold-start

**Причина:** Описание `startAdhoc` было слишком широким ("describes their professional identity")

**Fix:** `intent-classifier.ts` — изменены описания интентов:
- `startStory`: фокус на SHARING information
- `startAdhoc`: фокус на SEARCHING candidates

### Проблема 2: Plan hallucination
**Симптом:** Пользователь описывает 1 позицию → LLM придумывает 4 + курсы

**Причина:** Пример в промпте показывал 3 позиции с trails, LLM копировал паттерн

**Fix:** `prompts.ts` — добавлены семантические правила:
- Считать позиции явно описанные пользователем
- Возвращать ровно столько, сколько описано
- Не инферить career progression

---

## Фаза 3: Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `src/facade/services/orchestrator/intent-classifier.ts` | Семантика startStory/startAdhoc |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | Правила против галлюцинаций позиций |
| `tests/e2e/batches/mvp-*.yaml` | 3 новых batch теста |

---

## Фаза 4: Результаты тестирования

### Все batch тесты проходят

| Batch | Результат |
|-------|-----------|
| cold-start-happy-path | ✅ 4/4 |
| cold-start-clarification-flow | ✅ 7/7 |
| cold-start-normalization | ✅ 2/2 |
| cold-start-revert-field | ✅ 3/3 |
| mvp-position-normalization | ✅ 3/3 |
| mvp-implicit-extraction | ✅ 3/3 |
| mvp-skills-domains | ✅ 3/3 |

---

## Что осталось проверить

1. **Группировка clarification** — что происходит при 3+ missing fields
2. **Skip optional** — работает ли "нет" / "пропустить"
3. **Lint + tsc** — не запускали перед коммитом

---

## Что осталось сделать (не блокеры MVP)

| Задача | Приоритет | Оценка |
|--------|-----------|--------|
| citizenships default из countryCode | Nice to have | 30 мин |
| Явная подсказка skip optional | P2 | 1 час |
| Tech debt (state cleanup) | После MVP | — |

---

## Ключевые выводы

1. **Cold-start готов к MVP** — основные extraction/normalization работают
2. **FEAT-051 переоценил проблемы** — implicit extraction уже работает
3. **Реальные проблемы были другие** — intent classification, plan hallucination

---

## Фаза 5: Финальная проверка (продолжение)

### Дополнительно исправлено

**Plan hallucination v2** — LLM всё ещё выдумывал данные из-за примеров в Zod describe

**Fix:** `schemas.ts`
- Добавлены `CONTEXT_REQUIRED_FIELDS`, `TRAIL_REQUIRED_FIELDS` (type-checked arrays)
- Динамическая генерация describe: `Summary of: ${CONTEXT_FIELDS_DESC}`
- Убраны примеры "Junior Backend в Яндексе 2020-2022"

### Результаты финальных тестов

| Тест | Результат |
|------|-----------|
| Clarification 3+ missing | ✅ Группирует |
| Skip optional | ✅ Работает (не блокирует) |
| Implicit extraction | ✅ Питер→ru |
| Plan hallucination | ✅ Исправлено |
| npm run lint:fix | ✅ 0 errors |
| npx tsc --noEmit | ✅ OK |

### FEAT-051 статус

**DONE** — все P0/P1 проблемы проверены и либо работают, либо исправлены.

---

## Изменённые файлы (полный список)

| Файл | Изменение |
|------|-----------|
| `src/facade/services/orchestrator/intent-classifier.ts` | startStory/startAdhoc семантика |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | Убраны примеры, extraction rules |
| `src/shared/schemas.ts` | CONTEXT_REQUIRED_FIELDS, динамический describe |
| `tasks/features/FEAT-051-*.md` | Статус → DONE |

---

## Фаза 6: Анализ покрытия (Explore agent)

### Что покрыто существующими batch тестами

| Batch файл | Что тестирует | Финальная фаза |
|------------|---------------|----------------|
| cold-start-happy-path | Single context, full flow | saved ✅ |
| cold-start-clarification-flow | Multi-turn story + clarification | saved ✅ |
| cold-start-normalization | STRICT field normalization | awaiting_context_confirmation ⚠️ |
| cold-start-revert-field | Revert после normalization | awaiting_context_confirmation ⚠️ |
| mvp-position-normalization | Position extraction | awaiting_context_confirmation ⚠️ |
| mvp-implicit-extraction | City→country inference | awaiting_context_confirmation ⚠️ |
| mvp-skills-domains | Skills/domains extraction | awaiting_context_confirmation ⚠️ |

### Критические пробелы (P0 для MVP)

| # | Сценарий | Описание | Файл для создания |
|---|----------|----------|-------------------|
| 1 | **Multiple contexts** | 2-3 позиции, навигация Context #1 → #2 → Final | `cold-start-multi-context.yaml` |
| 2 | **Cancel at story_gathering** | Отмена во время сбора истории | `cold-start-cancel-story.yaml` |
| 3 | **Cancel at plan_confirmation** | Отмена после показа плана | `cold-start-cancel-plan.yaml` |
| 4 | **Cancel at context_confirmation** | Отмена при подтверждении контекста | `cold-start-cancel-context.yaml` |
| 5 | **Max clarification → failed** | 4+ раундов clarification → PHASE.failed | `cold-start-max-rounds.yaml` |

### Важные пробелы (P1)

| # | Сценарий | Описание |
|---|----------|----------|
| 6 | Edit → re-edit | Две правки подряд на одном контексте |
| 7 | Unknown intent → clarify_intent | Неоднозначный ответ → бот уточняет |
| 8 | "готово" detection | Разные формулировки завершения |
| 9 | Final с 3+ contexts + trails | Показ итогового preview |

### Конкретные рекомендации

**1. Multi-context batch (`cold-start-multi-context.yaml`):**
```yaml
steps:
  - message: "Расскажу историю. Сначала был junior в Москве, Python. Потом middle в Питере, Go."
  - message: "закончил"  # → awaiting_plan_confirmation (2 позиции)
  - message: "да"        # → awaiting_clarification (context #1)
  - message: "гражданство РФ"
  - message: "подтверждаю" # → awaiting_clarification (context #2)
  - message: "гражданство РФ"
  - message: "подтверждаю" # → awaiting_final_confirmation
  - message: "сохранить"   # → saved
```

**2. Cancel matrix (4 файла):**
- На каждой фазе: `"отмена"` / `"выход"` → phase: cancelled

**3. Max rounds batch:**
- Давать пустые/неполные ответы 4 раза подряд → phase: failed

**4. Расширить существующие тесты:**
- Добавить шаги до `saved` для тестов которые останавливаются на `awaiting_context_confirmation`

---

## Что осталось сделать

| Задача | Приоритет |
|--------|-----------|
| Batch тесты: multi-context flow | P0 |
| Batch тесты: cancel на разных фазах | P0 |
| Batch тесты: max-rounds → failed | P1 |
| Расширить существующие тесты до saved | P1 |

---

## Инсайты для guidelines.md

Добавить:
- **1.1 (расширение):** Примеры в Zod .describe() также влияют на LLM — убирать конкретику

---

## Prompt для продолжения после rewind

```
Продолжаю сессию cold-start MVP readiness — создание batch тестов.

Контекст: /home/alex/projects/WayMatesRemote/mvp-test-final/sessions/2025-12-29-cold-start-mvp-readiness.md

Сделано (фазы 1-5):
- FEAT-051 закрыт (DONE)
- Plan hallucination исправлен (schemas.ts — CONTEXT_REQUIRED_FIELDS + динамический describe)
- Все P0/P1 проблемы из FEAT-051 проверены и работают
- lint + tsc прошли

Осталось (фаза 6 — batch тесты для полного покрытия):

P0 — создать файлы:
1. cold-start-multi-context.yaml — 2 позиции, навигация Context #1 → #2 → Final → saved
2. cold-start-cancel-story.yaml — отмена на story_gathering
3. cold-start-cancel-plan.yaml — отмена на plan_confirmation
4. cold-start-cancel-context.yaml — отмена на context_confirmation
5. cold-start-max-rounds.yaml — 4+ раундов clarification → failed

P1 — расширить существующие:
- Тесты с awaiting_context_confirmation → довести до saved

См. детали в Фазе 6 файла сессии (примеры yaml, рекомендации).

Инфра: docker ps | grep waymates
Сессия mcp-chat: --session mvp9+
```
