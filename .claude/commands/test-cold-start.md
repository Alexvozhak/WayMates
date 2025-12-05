---
name: test-cold-start
description: Тестирование cold-start-v2 agent (LangGraph). Следует плану из docs/facade/PLAN.md, распределяет информацию по 6 документам (FAQ, ADR, GLOSSARY, архитектура).
model: sonnet
---

# Cold-Start v2 Testing Workflow

> **Архитектура**: LangGraph StateGraph (nodes + routers), НЕ ToolMessage
> **Test Cases**: → `docs/facade/TEST-PLAN.md` (ЧТО тестируем)
> **Этот документ**: КАК писать тесты (инфраструктура, шаблоны, правила)

Ты реализуешь тестирование cold-start-v2 agent. **СТРОГО следуй плану**, не импровизируй.

**КРИТИЧНО**: Код в `src/facade/langchain/cold-start-v2/`, тесты в `tests/facade/agents/cold-start-v2/`.

---

## 🔍 Загрузи контекст (ОБЯЗАТЕЛЬНО в начале)

```bash
# 1. План (ГЛАВНЫЙ документ)
Read docs/facade/PLAN.md

# 2. FAQ (закрытые вопросы с решениями)
Read docs/facade/FAQ.md

# 3. ESLint правила
Read eslint.config.mjs

# 4. Test standards
Read .claude/routers/test/router.md

# 5. LangGraph архитектура (ОБЯЗАТЕЛЬНО)
Read src/facade/langchain/cold-start-v2/cold-start-graph.ts
Read src/facade/langchain/cold-start-v2/routers/decision-router.ts

# 6. Vitest конфигурация
Read vitest.config.ts
```

---

## 🚦 После загрузки контекста

**НЕ НАЧИНАЙ сразу!** Проверь в таком порядке:

1. **Открытые вопросы в FAQ.md** — если есть, предложи их решить первыми
2. **Задачи ⬜ в PLAN.md** — только если нет открытых вопросов

Через `AskUserQuestion` предложи:

- Если есть открытые Q → выбор из открытых вопросов
- Если нет открытых Q → выбор из задач ⬜

Пользователь выбирает с чего начать.

---

## 📚 6 документов: знай их scope

| #   | Документ                                  | Что туда                                  | Пример                               |
| --- | ----------------------------------------- | ----------------------------------------- | ------------------------------------ |
| 1   | `docs/facade/PLAN.md`                     | Статусы задач                             | `⬜ → ✅`                            |
| 2   | `docs/facade/FAQ.md`                      | Закрытые вопросы (1 предложение + ссылка) | "Timeout → 30 сек. → см. ADR-002"    |
| 3   | `docs/facade/GLOSSARY.md`                 | Термины домена                            | "Context = снимок карьеры"           |
| 4   | `docs/architecture/decisions/ADR-XXX.md`  | Архитектурные решения                     | "Почему U1-U18, а не новые fixtures" |
| 5   | `docs/architecture/facade/langchain/*.md` | Техническая архитектура                   | State machine, nodes, routers        |
| 6   | `.claude/commands/test-cold-start.md`     | Этот промпт                               | AI-инструкции                        |

---

## 🔀 Правила распределения информации

| Что узнал?                   | Куда?                             |
| ---------------------------- | --------------------------------- |
| Решил вопрос (короткий)      | `FAQ.md` (1 предложение + ссылка) |
| Решил вопрос (архитектурный) | `ADR-XXX.md` + в FAQ ссылка       |
| Новый термин                 | `GLOSSARY.md`                     |
| Техническая деталь           | `langchain/*.md`                  |
| Задача выполнена             | `PLAN.md` (✅)                    |

### FAQ формат (табличный)

```markdown
## Открытые вопросы

| #   | Вопрос        |
| --- | ------------- |
| Q23 | Новый вопрос? |

## Закрытые вопросы

| #   | Вопрос  | Ответ                          | Детали    |
| --- | ------- | ------------------------------ | --------- |
| Q1  | Вопрос? | Короткий ответ (1 предложение) | → ADR-001 |
```

**Workflow**: Открытый → решил → перенёс в закрытые с ответом + ссылкой

### DRY: один источник правды

```markdown
❌ Копировать текст в 3 места
✅ "→ см. ADR-001" или "→ см. код"
```

---

## 📝 Шаблон ADR (КРАТКИЙ, без воды)

```markdown
# ADR-XXX: [Название]

**Статус**: Принято
**Дата**: YYYY-MM-DD

## Контекст

[1-2 предложения: проблема]

## Решение

[Что выбрали]

## Альтернативы

- [x] — почему нет
- [Y] — почему нет

## Последствия

[1-2 строки: что это значит]
```

---

## ⚠️ КРИТИЧЕСКИЕ ТРЕБОВАНИЯ

### 1. Type Reuse

```bash
# ПЕРЕД созданием типа - проверь существующие
grep -r "export type YourType" src/shared/
grep -r "export type YourType" src/facade/
```

### 2. Imports

```typescript
// ✅ ПРАВИЛЬНО
import type { UserId } from "../../shared/schemas.js";
import { ColdStartAgent } from "./cold-start-agent.js";

// ❌ НЕПРАВИЛЬНО
import { type UserId, ColdStartAgent } from "..."; // смешанные
import { something } from "./module"; // без .js
```

### 3. Запрещено

| Что                | Почему               |
| ------------------ | -------------------- |
| `export default`   | ESLint запрет        |
| `export * from`    | Реэкспорты запрещены |
| `any` типы         | Type safety          |
| Функции > 60 строк | ESLint max-lines     |
| Глубина > 2        | ESLint max-depth     |

### 4. Testing Standards

**4 вопроса перед каждым assertion:**

1. Гарантировано Zod? → **SKIP**
2. Математическая гарантия? → **SKIP**
3. Проверяет бизнес-правило? → **KEEP**
4. Упадёт при регрессии? → **KEEP**

---

## 📋 Workflow

### При старте сессии

```bash
# 1. Загрузи план (ГЛАВНЫЙ документ)
Read docs/facade/PLAN.md

# 2. Загрузи FAQ (открытые вопросы)
Read docs/facade/FAQ.md

# 3. Загрузи ключевые ADR
Read docs/architecture/decisions/ADR-026-test-strategy-revision.md
Read docs/architecture/decisions/ADR-022-cold-start-test-strategy.md

# 4. Загрузи LangGraph архитектуру
Read src/facade/langchain/cold-start-v2/cold-start-graph.ts

# 5. Найди первую ⬜ задачу
# 6. Выполни её
# 7. Распредели информацию по документам
# 8. Отметь ✅ в PLAN.md
```

### При выполнении задачи

1. **Читай** контекст (файлы из задачи)
2. **Делай** минимально необходимое
3. **Проверяй** lint + tsc после каждого файла
4. **Записывай** новую информацию в нужный документ
5. **Отмечай** статус в PLAN.md

### При появлении вопроса

1. Добавь в `FAQ.md` → таблица "Открытые вопросы" (Q#, вопрос)
2. Реши вопрос (архитектурный → создай ADR, простой → ответ в 1 предложение)
3. **⚠️ ПРОВЕРЬ КОНФЛИКТЫ**: убедись что решение не противоречит существующим закрытым вопросам и ADR
4. Перенеси в таблицу "Закрытые вопросы" (Q#, вопрос, ответ, → ссылка)

### При завершении сессии

```bash
# Quality gates
npm run lint
npx tsc --noEmit
npm run test:facade:run  # когда тесты готовы
```

---

## 🛠️ Генерация тестовых историй

### Unpacking Prompt (для LibreChat/Telegram)

Этот промпт переиспользуется для:

- Генерации тестовых историй из U1-U18
- Проверки что agent собрал данные правильно
- Production use в LibreChat/Telegram

```markdown
Ты помогаешь пользователю рассказать свою карьерную историю.

У тебя есть JSON с контекстами и тропами пользователя.
Твоя задача: превратить его в естественный рассказ от первого лица.

Правила:

- Пиши от первого лица ("Я работал...")
- Упоминай: позицию, компанию/индустрию, навыки, локацию
- Хронологический порядок (от старого к новому)
- Естественный язык, как будто человек рассказывает другу

Пример:
JSON: { contexts: [{ position: "junior", domains: ["frontend"], skills: ["react"], ... }] }
Текст: "Я начинал как junior frontend разработчик, работал с React..."
```

---

## ❓ Когда спрашивать пользователя

**СПРОСИ через AskUserQuestion:**

- Неясно какой тип использовать
- Конфликт плана и кода
- Нужна бизнес-логика не из документации

**Формат вопросов:**

- Язык: русский
- Перед вопросом: краткий анализ вариантов + твоя рекомендация
- Options: на русском с описаниями

**НЕ СПРАШИВАЙ:**

- Очевидные технические решения
- Выбор между эквивалентными подходами
- Что делать при ошибке lint/tsc (просто исправь)

---

## 📊 Quality Gates

**После КАЖДОЙ задачи:**

```bash
npm run lint
npx tsc --noEmit
```

**После блока тестов:**

```bash
npm run test:facade:run
```

---

## 🏗️ Инфраструктура

**Запуск**: `npm run test:facade:setup` → `npm run test:facade:run` → `npm run test:facade:teardown`

**Env vars**: `.env.test` (GOOGLE*API_KEY, POSTGRES_URL, REDIS_URL, NEO4J*\*)

---

## 🤖 LLM-тесты

- **Timeout**: 60s (vitest.config.ts), для сложных flows — 120s inline
- **Flakiness**: проверяй структуру (`phase`, `contexts.length`), не exact values
- **Sequential**: тесты идут последовательно (rate limiting, предсказуемость)

→ см. ADR-020 (LLM test categories)

### При падении теста

Если причина неясна — включи LangSmith tracing (временно, квота 5k):

```bash
# .env.test — добавить на время отладки
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=waymates-cold-start
```

Затем запроси trace через SDK:

```typescript
import { Client } from "langsmith";
const client = new Client();
const runs = await client.listRuns({
  projectName: "waymates-cold-start",
  limit: 10,
});
// Покажет: LLM calls, tool calls, latency, errors
```

→ см. ADR-018 (LangSmith observability)

---

## 🧪 Написание тестов

**Test cases**: → `docs/facade/TEST-PLAN.md` (C01-C05, T01-T15)

**Helpers**: → `tests/facade/agents/cold-start/helpers/`

**Структура тестов**: → `tests/facade/agents/cold-start-v2/`

**Правила**:

1. **Contract tests (Tier 0)**: проверяй graph topology, router logic, invariants — БЕЗ LLM
2. **Integration tests**: проверяй phase transitions, не exact extraction
3. Используй fixtures U1-U18 + `generateStoryFromFixture()`
4. Каждый тест с бизнес-комментарием (зачем проверяем)

### Contract Tests (C01-C05) — LangGraph специфика

```typescript
// C01: Graph topology — edges в graph === routes в routers
// C02: Router exhaustiveness — все intent варианты покрыты
// C03: Invariant guards — parsedDecision NON-NULL после parse nodes
// C05: State completeness — все поля для всех фаз
```

→ см. `.claude/routers/test/router.md`

---

## 🚫 Антипаттерны

1. ❌ Создавать типы без grep проверки
2. ❌ Coverage theater (тесты для Zod валидации)
3. ❌ Дублировать информацию в документах
4. ❌ Inline type imports
5. ❌ Функции > 60 строк
6. ❌ Импровизировать вместо следования плану
7. ❌ Оставлять открытые вопросы без решения
8. ❌ Загружать fixtures без понимания какие нужны для задачи
9. ❌ **Додумки вместо проверки** — если не уверен на 100%, не выдумывай объяснение. Логируй, проверяй, копай. "Flaky test", "так и должно быть" — недопустимые отмазки
10. ❌ **Defensive coding на invariants** — `?.` и `?? "unknown"` прячут баги. Используй `AgentInvariantError` из `errors.ts`
11. ❌ **Сырой Error** — всегда через `errors.ts` (специфичный класс + контекст)
12. ❌ **Не предложить тест на смежный кейс** — после фикса: какие ещё flows затронуты?
