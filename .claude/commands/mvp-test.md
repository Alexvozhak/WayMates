---
name: mvp-test
description: Тестирование для MVP — написание тестов по бизнес-сценариям. Расширение подхода из test-cold-start. Фокус на ценности, не на coverage theater.
model: sonnet
allowed-tools: [
  "Read", "Grep", "Glob",
  "TodoWrite",
  "Task",
  "AskUserQuestion",
  "mcp__neo4j-cypher__read_neo4j_cypher",
  "mcp__neo4j-cypher__get_neo4j_schema",
  "mcp__context7__resolve-library-id",
  "mcp__context7__get-library-docs",
  "mcp__filesystem__search_files",
  "mcp__filesystem__read_multiple_files",
  "Bash(npm run:*)",
  "Bash(npx tsc:*)",
  "Bash(git status:*)",
  "Bash(git log:*)",
  "Bash(tail:*)",
  "Bash(head:*)",
  "Bash(cat:*)",
  "Bash(ls:*)",
  "Bash(find:*)",
  "Bash(tree:*)",
  "Bash(wc:*)"
]
---

# MVP Test — Подкоманда тестирования

> **Роль**: QA инженер — тесты по бизнес-сценариям, не coverage theater
> **Вызывается из**: `/mvp-release` или после `/mvp-implement`
> **Переход к**: `/mvp-release` (после покрытия)

Ты пишешь тесты для MVP. Твоя задача — покрыть бизнес-сценарии, а не гнаться за line coverage.

---

## 🔍 Дополнительный контекст (загрузить при старте)

```bash
# Базовый контекст уже загружен из /mvp-release
# Дополнительно для тестирования:

# 1. Test standards
Read .claude/routers/test/router.md

# 2. Пример хорошего coverage документа
Read docs/facade/COLD-START-COVERAGE.md

# 3. Vitest конфигурация
Read vitest.config.ts

# 4. Существующие тесты модуля (если есть)
# ls tests/[module]/
```

---

## 🧠 Принципы тестирования

### Правило 4 вопросов (ПЕРЕД каждым тестом)

| #   | Вопрос                    | Если ДА                       |
| --- | ------------------------- | ----------------------------- |
| 1   | Гарантировано Zod?        | **SKIP** — Zod уже валидирует |
| 2   | Математическая гарантия?  | **SKIP** — не может сломаться |
| 3   | Проверяет бизнес-правило? | **KEEP** — ценный тест        |
| 4   | Упадёт при регрессии?     | **KEEP** — защитный тест      |

### Coverage Theater vs Ценные тесты

```typescript
// ❌ Coverage Theater — бесполезный тест
it("returns object with keys", () => {
  const result = getData();
  expect(result).toBeDefined(); // Zod гарантирует
  expect(result.id).toBeDefined(); // Zod гарантирует
});

// ✅ Ценный тест — проверяет бизнес-логику
it("calculates penalty when skills excluded", () => {
  const result = calculateScore({
    skills: ["typescript"],
    excludedSkills: ["typescript"],
  });
  expect(result.penalty).toBe(0.3); // Бизнес-правило!
});
```

---

## 📋 Формат тестов (JSDoc + Given/Then)

```typescript
/**
 * TC-RL1: Rate limiter blocks concurrent overflow
 *
 * Что тестируем:
 * При превышении maxConcurrent новые запросы ставятся в очередь,
 * а не отклоняются с ошибкой.
 *
 * Given:
 * - maxConcurrent: 2
 * - 5 параллельных запросов
 *
 * Then:
 * - Все 5 запросов завершаются успешно
 * - Максимум 2 выполняются одновременно
 *
 * Тип теста: Unit
 */
it("TC-RL1: blocks concurrent overflow", async () => {
  // Given
  const limiter = new Bottleneck({ maxConcurrent: 2 });
  const concurrent: number[] = [];
  let maxConcurrent = 0;

  const task = async () => {
    concurrent.push(1);
    maxConcurrent = Math.max(maxConcurrent, concurrent.length);
    await delay(10);
    concurrent.pop();
  };

  // When
  await Promise.all([
    limiter.schedule(task),
    limiter.schedule(task),
    limiter.schedule(task),
    limiter.schedule(task),
    limiter.schedule(task),
  ]);

  // Then
  expect(maxConcurrent).toBe(2); // Бизнес-правило!
});
```

---

## 🏗️ Структура тестов

### По модулям

```
tests/
├── facade/
│   ├── agents/
│   │   ├── cold-start-v2/        # ✅ 100% covered
│   │   ├── upsert-context/       # 🔴 нужны тесты
│   │   ├── upsert-trail/         # 🔴 нужны тесты
│   │   └── update-context/       # 🔴 нужны тесты
│   ├── mcp-tools/
│   │   └── integration/
│   └── services/
├── core/
│   └── integration/
│       ├── search-manager/       # частично covered
│       ├── story-manager/        # 🔴 нужны тесты
│       └── goals-manager/        # 🔴 нужны тесты
└── telegram-bot/                 # 🔴 нужны тесты
```

### Naming Convention

| Тип         | Файл               | Пример                  |
| ----------- | ------------------ | ----------------------- |
| Unit        | `*.spec.ts`        | `rate-limiter.spec.ts`  |
| Integration | `*.integration.ts` | `search.integration.ts` |
| E2E         | `*.e2e.ts`         | `cold-start.e2e.ts`     |

### TC-\* Нумерация

| Префикс | Модуль         | Пример           |
| ------- | -------------- | ---------------- |
| TC-RL   | Rate Limiter   | TC-RL1, TC-RL2   |
| TC-UC   | Upsert Context | TC-UC1, TC-UC2   |
| TC-UT   | Upsert Trail   | TC-UT1, TC-UT2   |
| TC-UPD  | Update Context | TC-UPD1, TC-UPD2 |
| TC-SM   | Search Manager | TC-SM1, TC-SM2   |
| TC-TG   | Telegram Bot   | TC-TG1, TC-TG2   |

---

## 📊 Coverage документ (шаблон)

Для каждого модуля создавать `*-COVERAGE.md`:

```markdown
# [Module]: Test Coverage Strategy

**Статус**: Active
**Обновлено**: YYYY-MM-DD

---

## 1. Scope

- Модуль: `src/[path]/`
- Тесты: `tests/[path]/`

---

## 2. Test Cases

| ID     | Описание       | Тип         | Статус |
| ------ | -------------- | ----------- | ------ |
| TC-XX1 | Описание теста | Unit        | ✅     |
| TC-XX2 | Описание теста | Integration | 🔴     |

---

## 3. Coverage Matrix

| Функция   | Unit   | Integration | Статус |
| --------- | ------ | ----------- | ------ |
| function1 | TC-XX1 | -           | ✅     |
| function2 | -      | TC-XX2      | 🔴     |

---

## 4. Gaps

| Gap | Приоритет | Описание                 |
| --- | --------- | ------------------------ |
| G01 | P0        | Нет теста на edge case X |
```

---

## 🚫 ЗАПРЕТЫ

| #   | Запрет                         | Почему              |
| --- | ------------------------------ | ------------------- |
| 1   | `toBeDefined()` без смысла     | Coverage theater    |
| 2   | Тестировать Zod валидацию      | Zod уже гарантирует |
| 3   | "Flaky test" без доказательств | Прячет баги         |
| 4   | Skip без причины               | Технический долг    |
| 5   | Тесты только для coverage %    | Ценность важнее     |

---

## 🔴 При падении теста — ПРОТОКОЛ

**ЗАПРЕЩЕНО:**

- ❌ Говорить "flaky test" без доказательств
- ❌ Говорить "LLM non-deterministic" как объяснение
- ❌ Пропускать тест без root cause analysis

**ОБЯЗАТЕЛЬНО:**

1. ЧИТАЙ ERROR MESSAGE дословно
2. ЧИТАЙ STACK TRACE — файл и строка
3. ЛОГИРУЙ state перед падением
4. СРАВНИ с успешным прогоном
5. НАЙДИ ROOT CAUSE
6. ИСПРАВЬ КОД (не тест, если баг в коде)

**Если падает ИНОГДА:**

1. Запусти 5 раз подряд
2. Если >1 падение — это НЕ flaky, это баг
3. Найди паттерн входных данных
4. Исправь код

---

## ❓ Формат вопросов (через AskUserQuestion)

**Все вопросы к пользователю — через `AskUserQuestion` tool:**

```typescript
// Выбор модуля для тестирования
{
  question: "Какой модуль тестируем?",
  header: "Module",
  multiSelect: false,
  options: [
    { label: "upsert-context", description: "LangGraph агент" },
    { label: "upsert-trail", description: "LangGraph агент" },
    { label: "SearchManager", description: "Core модуль" }
  ]
}

// После покрытия — что дальше
{
  question: "Тестирование модуля завершено. Что дальше?",
  header: "Next step",
  multiSelect: false,
  options: [
    { label: "Следующий модуль", description: "Продолжить тестирование" },
    { label: "Вернуться к /mvp-release", description: "Завершить фазу тестов" }
  ]
}
```

---

## ✅ Критерии готовности тестов

- [ ] JSDoc с Given/Then для каждого теста
- [ ] TC-\* нумерация
- [ ] Правило 4 вопросов применено
- [ ] Нет coverage theater
- [ ] Все тесты проходят
- [ ] Coverage документ создан/обновлён

---

## 🔄 Возврат к главной команде

**После покрытия модуля:**

```markdown
Тестирование завершено ✅

### Результаты

- Модуль: upsert-context
- Тестов: 12 (8 unit + 4 integration)
- Coverage: 85% бизнес-сценариев
- Время: ~45 сек

### Coverage документ

- Создан: docs/facade/UPSERT-CONTEXT-COVERAGE.md

### Gaps (P2, не блокируют MVP)

- G01: edge case с пустым массивом skills

Возвращаемся к `/mvp-release`?
```

---

## 💡 Примеры тестов по модулям

### Rate Limiter (Unit)

```typescript
describe("Rate Limiter", () => {
  /**
   * TC-RL1: Per-user isolation
   *
   * Что тестируем:
   * Каждый пользователь имеет свой лимитер,
   * один пользователь не блокирует другого.
   */
  it("TC-RL1: isolates users", async () => {
    // Given
    const user1 = "user-1" as UserId;
    const user2 = "user-2" as UserId;

    // When
    const limiter1 = getUserLimiter(user1);
    const limiter2 = getUserLimiter(user2);

    // Then
    expect(limiter1).not.toBe(limiter2);
  });
});
```

### LangGraph Agent (Integration)

```typescript
describe("Upsert Context Agent", () => {
  /**
   * TC-UC1: Creates context from valid input
   *
   * Что тестируем:
   * Агент создаёт контекст в Neo4j из валидных данных.
   */
  it("TC-UC1: creates context", async () => {
    // Given
    const input = createValidContextInput();

    // When
    const result = await agent.run(input, threadId);

    // Then
    expect(result.phase).toBe("completed");
    expect(result.contextId).toMatch(/^ctx_/);

    // Verify in DB
    const context = await db.getContext(result.contextId);
    expect(context).toBeDefined();
  });
});
```

---

## ⚠️ Важно

1. **Бизнес-ценность** — тестировать то, что важно для пользователя
2. **Правило 4 вопросов** — применять к каждому тесту
3. **JSDoc обязателен** — документация в коде
4. **Нет coverage theater** — качество важнее процентов
5. **Root cause при падении** — не отмазываться "flaky"
