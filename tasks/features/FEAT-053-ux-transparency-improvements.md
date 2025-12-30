# FEAT-053: UX Transparency — Фильтры, Feedback, Salary

**Status**: PLANNING
**Priority**: P1
**Component**: Facade (NLP prompts, Cold-Start extraction, Chart)
**Created**: 2025-12-30
**Depends on**: a0a4993 (discriminated union для results)
**Blocks**: -

---

## Проблема

1. **appliedFilters не показываются** — данные передаются в response, но NLP не инструктирован их отображать
2. **feedback/salary не извлекаются** — в cold-start NLP говорит предлагать, но extraction prompt не содержит инструкций
3. **salary не в chart** — траектории кандидатов могут содержать salary, но chart его не отображает
4. **0 результатов — нет контекста** — пользователь не понимает почему пусто

---

## Обязательно прочитать перед началом работ

| Файл | Зачем |
|------|-------|
| `mvp-test-final/BUSINESS-LOGIC-MVP.md` | Бизнес-логика, режимы поиска, UX-требования |
| `mvp-test-final/KNOWLEDGE-BASE.md` | Архитектура, data flow, терминология |
| `.claude/context/guidelines.md` | Паттерны ошибок, правила промптов |
| `src/facade/services/nlp-formatter/prompts.ts` | Текущие NLP инструкции |
| `src/facade/langGraph/search-graph/response-builders.ts` | Какие данные передаются в каждой фазе |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | Extraction prompts |
| `src/shared/schemas.ts` | Схемы UserContext (feedback, salary), appliedFilters |
| `sessions/2025-12-30-test-fixes-session.md` | Контекст параллельной сессии (discriminated union) |

---

## Решение

### Часть 1: appliedFilters в NLP prompts

**Фазы с appliedFilters:**
- `showing_exploration_candidates`
- `showing_exploration_facets`
- `asking_after_validate_candidates`
- `asking_after_validate_facets`
- `showing_waymate_results`
- `showing_pathfinder_results`
- `showing_results_facets`

**Формат отображения (семантика):**

```
🔍 Поиск: без фильтров
📊 Найдено: 45 кандидатов
```

```
🔍 Поиск: переходы за последние 12 месяцев
📊 Найдено: 12 pathfinders
```

```
🔍 Поиск: исключены смены должности
⚠️ Не применено: "startups" (не распознано)
📊 Найдено: 8 кандидатов
```

**При 0 результатах:**
```
📊 Результат: 0 pathfinders

🔍 Искали:
  - Цель: senior backend, fintech
  - Давность: 12 месяцев

💡 Можно: убрать фильтр давности, расширить industry, изменить цель.
```

---

### Часть 2: optionalFields в confirming_adhoc_context

**Требование:** Показывать optional поля для возможности дополнить контекст.

**Формат:**
```
✅ FILLED:
  Position: senior
  Role: backend
  Country: DE
  Domains: fintech

⚪ OPTIONAL (можно добавить):
  skills, industry, companySize, birthYear, educationLevel, languages

Что дальше: глянуть похожих или задать цель?
```

---

### Часть 3: feedback/salary в Cold-Start extraction

**Текущее состояние:**
- В `CONTEXT_OPTIONAL_FIELDS`: `salaryExact`, `salaryMin`, `salaryMax`, `feedback`
- В NLP prompts: упоминаются как optional
- В extraction prompts: **НЕТ инструкций извлекать**

**Решение:** Добавить в `contextExtractionPrompt`:

```
OPTIONAL FIELDS (include ONLY if user explicitly mentioned):
- salaryExact: exact annual salary in USD (if user gives precise number)
- salaryMin/salaryMax: salary range in USD (if user gives range like "100-150k")
  Note: Use EITHER exact OR range, not both
- feedback: user's personal reflection on this position (max 200 chars)
  Extract key insight, not verbatim quote
```

---

### Часть 4: salary в Chart

**Текущее состояние:**
- Chart показывает: position, role, skills, dates
- Salary есть в UserContext, но не отображается

**Решение:** Добавить salary как отдельный аспект в chart.

**Формат отображения:**
- Exact: `$120K`
- Range: `$100K-150K`
- Not specified: не показывать

**Файлы:**
- `src/chart/types.ts` — добавить salary в ChartContext
- `src/chart/services/trajectory-transformer.ts` — трансформация salary
- `src/chart/builders/chart-builder.ts` — рендеринг salary

---

## План работ

### Этап 1: NLP prompts для appliedFilters (~30 LOC)

**Файл:** `src/facade/services/nlp-formatter/prompts.ts`

1. Добавить инструкцию в `SEARCH_PHASE_DESCRIPTIONS` для каждой фазы с appliedFilters
2. Формат: семантический (не hardcoded strings)
3. Обработка rejectedFields/rejectedReasons

### Этап 2: optionalFields в confirming_adhoc (~10 LOC)

**Файл:** `src/facade/services/nlp-formatter/prompts.ts`

1. Обновить `confirming_adhoc_context` description
2. Показывать optionalFields из response data

### Этап 3: feedback/salary в extraction (~20 LOC)

**Файл:** `src/facade/langGraph/cold-start-v2/prompts.ts`

1. Добавить OPTIONAL FIELDS секцию в `contextExtractionPrompt`
2. Указать формат salary (exact vs range)
3. Указать формат feedback (extract insight, not quote)

### Этап 4: salary в Chart (~50 LOC)

**Файлы:**
- `src/chart/types.ts`
- `src/chart/services/trajectory-transformer.ts`
- `src/chart/builders/chart-builder.ts`

1. Расширить ChartContext типом salary
2. Трансформировать salary из UserContext
3. Рендерить как badge/label

---

## Тестирование

### Manual testing (mcp-chat.ts)

```bash
# Подготовка
npm run test:telegram:setup
set -a && source .env.test && set +a

# Тест 1: appliedFilters (exploration)
npx tsx poc/mcp-chat.ts --session ux1 --reset
npx tsx poc/mcp-chat.ts --session ux1 "я backend senior, DE"
npx tsx poc/mcp-chat.ts --session ux1 "покажи похожих"
# Ожидание: "🔍 Поиск: без фильтров"

# Тест 2: appliedFilters (с фильтром)
npx tsx poc/mcp-chat.ts --session ux1 "только за последние 6 месяцев"
# Ожидание: "🔍 Поиск: переходы за последние 6 месяцев"

# Тест 3: 0 результатов
npx tsx poc/mcp-chat.ts --session ux2 --reset
npx tsx poc/mcp-chat.ts --session ux2 "я CTO, Antarctica"
npx tsx poc/mcp-chat.ts --session ux2 "хочу стать CEO"
npx tsx poc/mcp-chat.ts --session ux2 "проверь"
# Ожидание: показать искали + предложения

# Тест 4: optionalFields
npx tsx poc/mcp-chat.ts --session ux3 --reset
npx tsx poc/mcp-chat.ts --session ux3 "я backend junior, US, fintech"
# Ожидание: "⚪ OPTIONAL: skills, industry..."

# Тест 5: salary extraction (cold-start)
npx tsx poc/mcp-chat.ts --session ux4 --reset
npx tsx poc/mcp-chat.ts --session ux4 "расскажи историю"
npx tsx poc/mcp-chat.ts --session ux4 "работал backend в Яндексе, зарплата была 300к рублей, потом ушёл в стартап на 5к долларов"
# Ожидание: salary извлечён в context
```

### Integration tests

```bash
# После изменений
npm run lint:fix
npx tsc --noEmit
npm run test:facade:run
```

---

## Acceptance Criteria

- [ ] appliedFilters отображаются во всех 7 фазах с фильтрами
- [ ] rejectedFields показываются как "не применено"
- [ ] 0 результатов показывает контекст поиска + предложения
- [ ] optionalFields в confirming_adhoc_context
- [ ] salary извлекается в cold-start (exact или range)
- [ ] feedback извлекается в cold-start
- [ ] salary отображается в chart
- [ ] Все тесты проходят

---

## Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `src/facade/services/nlp-formatter/prompts.ts` | appliedFilters инструкции, optionalFields |
| `src/facade/langGraph/cold-start-v2/prompts.ts` | salary/feedback в extraction |
| `src/chart/types.ts` | SalaryInfo тип |
| `src/chart/services/trajectory-transformer.ts` | salary transformation |
| `src/chart/builders/chart-builder.ts` | salary rendering |

---

## Связанные документы

- `sessions/2025-12-30-career-strategy-session.md` — анализ задачи
- `sessions/2025-12-30-test-fixes-session.md` — discriminated union для results
- `mvp-test-final/tests_report.md` — матрица тестирования
