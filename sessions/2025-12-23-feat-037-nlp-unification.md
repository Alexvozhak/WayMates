# Сессия: FEAT-037 — Унификация NLP архитектуры

**Дата:** 2025-12-23
**Задача:** Проработка и планирование FEAT-037 (перенос LLM formatting из Telegram в Facade)

---

## Фаза 1: Глубокий анализ текущего состояния

### Что сделано

1. **Проанализирован git history** (3229e98..HEAD) — 9 коммитов по telegram, 23 по facade
2. **Выявлена тенденция:** движение к thin client (коммит 476a451 — архитектурный принцип)
3. **Инвентаризация текущего состояния:**

| Source | Возвращает | Telegram делает |
|--------|------------|-----------------|
| SystemMessage | Full NLP ✅ | Translate only |
| ColdStart | JSON + short message | LLM formatting ❌ |
| SearchGraph | JSON only (no message!) | LLM formatting ❌ |
| Upsert*, Update* | JSON + short message | LLM formatting ❌ |

### Ключевые находки

- **SearchGraph вообще не имеет message field** — только structured data
- **3 разных паттерна** в одном API — inconsistency
- **Telegram имеет 3 Presenter'а** с 40-44 строчными LLM промптами каждый

---

## Фаза 2: Обсуждение архитектуры

### Ключевые решения

1. **MCP остаётся** — будущие ручки могут возвращать JSON, optionality важна
2. **NLP в Facade** — клиент не должен знать бизнес-логику
3. **GraphManager возвращает NLP** — как FlowGuardChecker и QueryExecutor
4. **5 промптов по графам** — единообразно, каждый граф = свой промпт

### Финальная архитектура

```
БЫЛО:                              БУДЕТ:
GraphManager → JSON                GraphManager → NLP
Telegram → LLM format (3 класса)   Telegram → translate (1 класс)
```

---

---

## Фаза 3: Реализация FEAT-037 ✅

### Что сделано

1. **NlpFormatter** — новый сервис `src/facade/services/nlp-formatter/`
   - 5 промптов (type-safe с PHASE константами)
   - Форматирует structured data → English NLP

2. **GraphManager** — возвращает `{ result, message, activeGraph }`
   - `result` — structured data для UI/кнопок
   - `message` — full NLP для отображения

3. **Schema** — `message` на верхнем уровне ConverseResponse
   - SystemMessage упрощён (убран `content`, текст в `message`)

4. **Telegram** — thin client
   - Удалены SearchGraphPresenter, CrudGraphPresenter
   - format-response: только translate если `lang !== "en"`

### Финальный API

```typescript
{
  result: { phase: "showing_results", candidates: [...], goal: {...} },
  message: "🎯 Found 5 people who achieved your goal...",
  activeGraph: "search"
}
```

### Quality Gates

- ✅ lint
- ✅ tsc
- ✅ unit tests (67/67)
- ✅ telegram integration (9/9)
- ✅ facade integration (sample)

---

## Что делать следующей сессией

1. **Коммит FEAT-037** — изменения готовы
2. **Обновить FEAT-037.md** — статус DONE
3. **Прогнать полный test suite** — убедиться что всё стабильно

---

## Артефакты

| Артефакт | Путь |
|----------|------|
| **План реализации** | `tasks/features/FEAT-037-unified-nlp-architecture.md` |
| **NlpFormatter** | `src/facade/services/nlp-formatter/` |
| **Обновлённый GraphManager** | `src/facade/services/orchestrator/graph-manager.service.ts` |
| **Упрощённый format-response** | `src/telegram-bot/presenters/format-response.ts` |

**Удалено:**
- `src/telegram-bot/presenters/search-graph-presenter.ts`
- `src/telegram-bot/presenters/crud-graph-presenter.ts`

---

## Рефлексия

### Наставления от пользователя

| Наставление | Контекст | Вывод |
|-------------|----------|-------|
| **"harder thinking"** | Нужен глубокий анализ | ultrathink для сложных вопросов |
| **"не старайся угодить"** | Объективное мнение про MCP | Честный анализ > подтверждение ожиданий |
| **"единообразно"** | 3 промпта → 5 | N сущностей = N конфигов |
| **"lint:fix вызывай"** | Ручные правки импортов | ESLint --fix удаляет unused imports автоматически |
| **"мб переобозвать?"** | createSystemMessage, nlpMessage | Следить за именованием при изменении семантики |
| **"дублирование?"** | content + message | Один источник истины, не дублировать данные |
| **"skip LLM для en"** | Перевод на английский | Оптимизация: если lang=en — не вызывать LLM |

### Инсайты

1. **Тенденция важнее текущего состояния** — git history показывает направление
2. **message на верхнем уровне** — проще чем добавлять в каждый graph response
3. **lint:fix для cleanup** — удаляет unused imports автоматически
4. **Skip LLM для default language** — экономия вызовов

### Как делать правильно

- Анализировать git history для архитектурных решений
- Использовать lint:fix для автоматического cleanup импортов
- Ставить данные на одном уровне (не дублировать)
- Оптимизировать LLM вызовы (skip если не нужно)
- Переименовывать при изменении семантики

### Как делать неправильно

- Ручной cleanup импортов (lint:fix делает автоматически)
- Дублировать данные в разных местах (content + message)
- Вызывать LLM когда не нужно (перевод en→en)
- Оставлять старые имена при новой семантике

---

## Changelog

| Время | Изменение |
|-------|-----------|
| Фаза 1 | Глубокий анализ git history и текущего состояния |
| Фаза 2 | Обсуждение MCP, NLP в Facade, количества промптов |
| Фаза 3 | Реализация FEAT-037: NlpFormatter, GraphManager, Telegram thin client |
