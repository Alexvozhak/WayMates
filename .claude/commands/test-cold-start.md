---
name: test-cold-start
description: Тестирование cold-start-v2 agent (LangGraph). Следует coverage схеме из COLD-START-COVERAGE.md. Формат JSDoc (Given/Then). Деление по этапам workflow.
model: opus
---

# Cold-Start v2 Testing Workflow

> **Архитектура**: LangGraph StateGraph (nodes + routers), НЕ ToolMessage
> **Coverage Strategy**: → `docs/facade/COLD-START-COVERAGE.md` (схема тестирования)
> **Этот документ**: КАК писать тесты (инфраструктура, шаблоны, правила)

Ты реализуешь тестирование cold-start-v2 agent. **СТРОГО следуй схеме**, не импровизируй. Будь максимально бдительным, подозрительным, не спеши делать выводы и подгонять тесты под бизнес-код. **ТВОЯ ОСНОВНАЯ ЗАДАЧА - НАЙТИ ОШИБКИ В БИЗНЕС КОДЕ, А НЕ COVERAGE С ФИКТИВНЫМИ ТЕСТАМИ СДЕЛАТЬ!!!**

**КРИТИЧНО**: Код в `src/facade/langGraph/cold-start-v2/`, тесты в `tests/facade/agents/cold-start-v2/`.

---

## 🔍 Загрузи контекст (ОБЯЗАТЕЛЬНО в начале)

```bash
# 1. Coverage схема (ГЛАВНЫЙ документ)
Read docs/facade/COLD-START-COVERAGE.md

# 2. FAQ (закрытые вопросы с решениями)
Read docs/facade/FAQ.md

# 3. ESLint правила
Read eslint.config.mjs

# 4. Test standards
Read .claude/routers/test/router.md

# 5. LangGraph архитектура
Read .claude/routers/langgraph/router.md

# 6. Vitest конфигурация
Read vitest.config.ts
```

---

## 🚦 После загрузки контекста

**НЕ НАЧИНАЙ сразу!** Посмотри Coverage Matrix в COLD-START-COVERAGE.md и предложи пользователю через `AskUserQuestion`:

1. **Какие gaps закрывать** (критичные P0, важные P1, или другое)
2. **Или актуализировать существующие тесты** (переименовать T01 → TC-P1 и т.д.)

Пользователь выбирает с чего начать.

---

## 📚 Документы: знай их scope

| #   | Документ                                  | Что туда                                  | Пример                               |
| --- | ----------------------------------------- | ----------------------------------------- | ------------------------------------ |
| 1   | `docs/facade/COLD-START-COVERAGE.md`      | Coverage схема, gaps, migration plan      | Coverage Matrix, TC-P1..TC-I5        |
| 2   | `docs/facade/FAQ.md`                      | Закрытые вопросы (1 предложение + ссылка) | "Timeout → 30 сек. → см. ADR-002"    |
| 3   | `docs/facade/GLOSSARY.md`                 | Термины домена                            | "Context = снимок карьеры"           |
| 4   | `docs/architecture/decisions/ADR-XXX.md`  | Архитектурные решения                     | "Почему U1-U18, а не новые fixtures" |
| 5   | `docs/architecture/facade/langGraph/*.md` | Техническая архитектура                   | State machine, nodes, routers        |
| 6   | `.claude/commands/test-cold-start.md`     | Этот промпт                               | AI-инструкции                        |

---

## 🔀 Правила распределения информации

| Что узнал?                   | Куда?                             |
| ---------------------------- | --------------------------------- |
| Решил вопрос (короткий)      | `FAQ.md` (1 предложение + ссылка) |
| Решил вопрос (архитектурный) | `ADR-XXX.md` + в FAQ ссылка       |
| Новый термин                 | `GLOSSARY.md`                     |
| Техническая деталь           | `langGraph/*.md`                  |
| Обнаружил gap в покрытии     | `COLD-START-COVERAGE.md` (gaps)   |

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

### При выполнении задачи

1. **Читай** контекст (файлы из задачи)
2. **Делай** минимально необходимое
3. **Проверяй** lint + tsc после каждого файла
4. **Записывай** новую информацию в нужный документ
5. **Отмечай** статус в PLAN.md

### При появлении вопроса

1. Предложи пользователю опции добавить вопрос в `FAQ.md` → таблица "Открытые вопросы" (Q#, вопрос) или решить сейчас

### При получении ответа на вопрос

1. **⚠️ ПРОВЕРЬ КОНФЛИКТЫ**: убедись что ответ не противоречит существующим закрытым вопросам и ADR
2. Если ответ решает открытый вопрос (если решение найдено и одобрено), то перенеси вопрос из таблицы "Открытые вопрос" в таблицу "Закрытые вопросы" (Q#, вопрос, ответ, → ссылка)

## ❓ Когда спрашивать пользователя

**СПРОСИ через AskUserQuestion:**

- Неясно какой тип использовать
- Конфликт плана и кода
- Нужна бизнес-логика не из документации

**Формат вопросов:**

- Язык: русский
- Перед вопросом: анализ вариантов + короткие примеры + сравнение примеров + твоя рекомендация
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
- **Sequential**: тесты идут последовательно (rate limiting, предсказуемость)
- **Assertions**: проверяй структуру (`phase`, `contexts.length`), не exact values

→ см. ADR-020 (LLM test categories)

### 🚨 При падении теста — ОБЯЗАТЕЛЬНЫЙ ПРОТОКОЛ

**ЗАПРЕЩЕНО:**

- ❌ Говорить "flaky test" без доказательств
- ❌ Говорить "LLM non-deterministic" как объяснение
- ❌ Говорить "так и должно быть" / "expected behavior"
- ❌ Пропускать тест без root cause analysis
- ❌ Добавлять retry/skip как "решение"

**ОБЯЗАТЕЛЬНЫЙ АЛГОРИТМ:**

```
1. ЧИТАЙ ERROR MESSAGE — дословно, без интерпретации
2. ЧИТАЙ STACK TRACE — найди точный файл и строку
3. ВКЛЮЧИ LANGSMITH → см. ADR-018 (СРАЗУ, не откладывай!)
4. ЛОГИРУЙ state перед падением — добавь console.log в тест
5. СРАВНИ с успешным прогоном — что изменилось?
6. ПРОВЕРЬ входные данные — fixture корректен?
7. ПРОВЕРЬ assertions — тест проверяет правильную вещь?
8. НАЙДИ ROOT CAUSE — конкретная строка кода с багом
9. ИСПРАВЬ КОД, не тест (если баг в коде)
```

**LangSmith — СРАЗУ при первой ошибке** → `ADR-018-langsmith-observability.md`

**Если тест падает ИНОГДА:**

1. Запусти 5 раз подряд → записи сколько упало
2. Если >1 падение → это НЕ flaky, это баг в коде
3. Найди паттерн: какие входные данные вызывают падение
4. Исправь код чтобы обрабатывал все варианты
5. Во время разбирательств не трать время на правки некритичных (стилевых) ошибок eslint и ts (исправишь, когда тест пройдет)

---

## 🧪 Написание тестов

**Coverage схема**: → `docs/facade/COLD-START-COVERAGE.md` (полная картина)

**Helpers**: → `tests/facade/agents/cold-start/helpers/`

**Структура тестов**: → `tests/facade/agents/cold-start-v2/` (по этапам workflow)

---

### Формат теста (JSDoc + Given/Then)

```typescript
/**
 * TC-P1: Story → Plan creation
 *
 * Что тестируем:
 * Система извлекает из текстовой истории карьерные позиции и траектории обучения.
 * LLM парсит неструктурированный текст и создаёт queue с contextId для каждой позиции.
 *
 * Given:
 * - Story: "Я работал джуном 2 года, потом мидлом 3 года"
 * - Phase: story_gathering
 *
 * Then:
 * - Phase: awaiting_plan_confirmation
 * - Queue содержит 2 контекста с preview
 * - Каждый context имеет contextId
 *
 * Тип теста: Integration (real LLM)
 */
it("TC-P1: Story → Plan creation", async () => {
  // Given
  const story = generateStoryFromFixture(U1);

  // When
  const response = await graph.run(story, threadId, ...);

  // Then
  expect(response.phase).toBe("awaiting_plan_confirmation");
  expect(response.queue.length).toBe(2);
});
```

---

### Правила:

1. **JSDoc перед КАЖДЫМ тестом** — полное описание Given/Then
2. **TC-* ID обязателен** — см. COLD-START-COVERAGE.md для нумерации
3. **Contract tests (TC-C*)**: graph topology, routers — БЕЗ LLM
4. **Integration tests (TC-P*, TC-E*, TC-D*, TC-I*)**: real LLM + DB
5. Используй fixtures U1-U18 + `generateStoryFromFixture()`
6. **Не дублируй описание** — JSDoc = source of truth, не копируй в MD

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
13. ❌ Править некритичные (стилевые) eslint и ts ошибки ДО прохода теста
