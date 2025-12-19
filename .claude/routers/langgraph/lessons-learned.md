# LangGraph: Уроки и Инсайты

> Практические знания из реальной разработки SearchGraph

Последнее обновление: 2025-12-19

---

## 🎯 Ключевые Принципы

### 1. State Management: userResponse и Interrupt

**Проблема:** Conditional interrupt — когда нужен interrupt только в одних случаях, а в других использовать state.

**Решение:**

```typescript
// ❌ НЕПРАВИЛЬНО: falsy value ("") считается как отсутствие
const response = stateUserResponse || interrupt({...});

// ✅ ПРАВИЛЬНО: явная проверка на пустую строку
const response = stateUserResponse && stateUserResponse !== ""
  ? stateUserResponse
  : interrupt({...});
```

**Почему это важно:**

- State reducer `lastValue` сохраняет значения между вызовами
- `userResponse` default = `""` (пустая строка)
- Если node возвращает `userResponse: ""`, следующий node видит `""`
- `"" || interrupt()` всегда вызовет interrupt (falsy value)

**Паттерн очистки userResponse:**

```typescript
// Nodes которые ИСПОЛЬЗУЮТ userResponse должны ОЧИСТИТЬ его для следующих
export function extractGoalNode(state) {
  const { userResponse } = state;

  // ... use userResponse ...

  return {
    extractedGoal,
    userResponse: "", // ← Обязательно очистить!
    phase: PHASE.showingGoal,
  };
}
```

**Когда НЕ очищать:**

- Если следующий node должен получить userResponse (например, load_existing_goal → show_goal)
- Если делаешь interrupt (значение будет перезаписано)

---

### 2. Routing: buildRouteMap и Branch Errors

**Ошибка:** `Branch condition returned unknown or null destination`

**Причина:** routing функция возвращает destination, которого НЕТ в buildRouteMap.

**Пример проблемы:**

```typescript
// search-router.ts
export function routeAfterShowGoal(state) {
  switch (state.searchUserIntent) {
    case "validate": return NODE.validate_goal;
    case "unknown": return NODE.show_goal; // ← возвращаем show_goal
    default: return NODE.set_goal;
  }
}

// search-graph.ts
.addConditionalEdges(
  NODE.show_goal,
  routeAfterShowGoal,
  buildRouteMap([NODE.validate_goal, NODE.set_goal, NODE.cancel])
  // ❌ БАГ: NODE.show_goal НЕ В СПИСКЕ!
)
```

**Решение:**

```typescript
// ВАРИАНТ 1: Добавить в buildRouteMap
buildRouteMap([NODE.validate_goal, NODE.set_goal, NODE.cancel, NODE.show_goal]);

// ВАРИАНТ 2 (предпочтительнее): Не роутить обратно в тот же node
export function routeAfterShowGoal(state) {
  switch (state.searchUserIntent) {
    case "validate":
      return NODE.validate_goal;
    default:
      return NODE.set_goal; // ← unknown идёт в default
  }
}
```

**Почему Вариант 2 лучше:**

- Избегает infinite loops (show_goal → show_goal → show_goal...)
- LLM может вернуть unexpected intent → default должен быть safe fallback

**Правило:**

```
buildRouteMap destinations === ВСЕ возможные return values из routing функции
```

---

### 3. Null vs Undefined: Zod Validation

**Проблема:** Zod optional fields требуют ОТСУТСТВИЯ поля, не `null`.

**Ошибка:**

```typescript
// Zod schema
const targetContextSchema = z.object({
  position: fieldFilterSchema.optional(),
  countries: fieldFilterSchema.optional(), // может отсутствовать
  languages: fieldFilterSchema.optional()
});

// Код возвращает
return {
  position: {...},
  countries: null,  // ❌ ERROR: Expected object, received null
  languages: null
};
```

**Почему это происходит:**

```typescript
// Helper только фильтрует undefined, НЕ null
private removeUndefinedFields<T>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}
```

**Решение:**

```typescript
// ❌ НЕПРАВИЛЬНО: pass-through может быть null
return this.removeUndefinedFields({
  position,
  skills,
  domains,
  countries: context.countries, // может быть null
  languages: context.languages, // может быть null
});

// ✅ ПРАВИЛЬНО: явная проверка
const result: TargetContext = { position, skills, domains };

if (context.countries) {
  result.countries = context.countries;
}

if (context.languages) {
  result.languages = context.languages;
}

return this.removeUndefinedFields(result);
```

**Правило:**

```
Optional Zod field: ОТСУТСТВИЕ поля (undefined), НЕ null
```

---

### 4. Тестирование Multi-Turn Flows

**Принцип:** Multi-turn тесты требуют последовательных вызовов + type guards.

**Паттерн:**

```typescript
it("TC-SG-VC2: new goal → clarify → save", async () => {
  // Turn 1: начальное сообщение
  const turn1 = await runGraph("хочу быть менеджером");
  expect(turn1.phase).toBe(PHASE.showingExploration);

  if (turn1.phase !== PHASE.showingExploration) {
    expect.fail("Type guard failed"); // ← Обязательно для TS
  }

  // Turn 2: извлечение цели
  const turn2 = await runGraph("хочу стать Product Manager");
  expect(turn2.phase).toBe(PHASE.showingGoal);

  if (turn2.phase !== PHASE.showingGoal) {
    expect.fail("Type guard failed");
  }

  // Проверяем extractedGoal через type guard
  const positionValues = turn2.extractedGoal?.position?.values ?? [];
  expect(positionValues.some((v) => v.toLowerCase().includes("manager"))).toBe(true);

  // Turn 3: clarify
  const turn3 = await runGraph("добавь Германию");
  // ...
}, 240_000); // 4 min timeout для 4-turn flow
```

**Важно:**

1. **Type guards обязательны:** После `expect(...).toBe(PHASE.x)` нужен `if` для TypeScript
2. **Гибкая проверка значений:** LLM может нормализовать по-разному ("manager", "product manager", "PM")
3. **Timeout:** ~60 sec на turn с LLM вызовом
4. **Complexity ESLint:** Multi-turn функции имеют высокую complexity — игнорировать через `/* eslint-disable complexity */`

**Fixture Matching:**

```typescript
// ❌ Жёсткий match: может упасть из-за geo/личных полей
await runSearchGraph("найти работу", threadId, userId);

// ✅ Relaxed filters: исключает geo/personal для matching
await runSearchGraphWithRelaxedFilters(deps, "найти работу", threadId, userId);
```

**Relaxed filters:**

```typescript
const RELAXED_FILTERS = {
  excludedContextFields: [
    "birthYear",
    "cityName",
    "countryCode",
    "gender",
    "languages",
    "platforms",
    "yearsOfExperience",
  ],
  excludedCreationReasons: [],
  recencyThresholdMonths: undefined,
  limit: 10,
  pathLimit: 10,
};
```

---

### 5. Intent Classification: LLM Непредсказуемость

**Проблема:** LLM может вернуть unexpected intent для одного и того же сообщения.

**Примеры:**

```typescript
parseUserIntent("покажи результаты");
// Может вернуть: "proceed" | "save" | "unknown"

parseUserIntent("проверить");
// Ожидаем: "validate"
// Может вернуть: "unknown" (если prompt неоднозначен)
```

**Решение в routing:**

```typescript
// ❌ НЕПРАВИЛЬНО: unknown возвращает в show_goal (infinite loop)
case "unknown": return NODE.show_goal;

// ✅ ПРАВИЛЬНО: unknown идёт в safe default
default: {
  // Unknown/unrecognized intent → proceed with saving goal
  return NODE.set_goal;
}
```

**Правило:**

```
Default routing = safe fallback для unexpected интентов
```

**Улучшение prompts:**

- Добавить больше примеров в USER_INTENT_PROMPT
- Явно указать синонимы ("проверить" = "validate", "покажи цель" = "validate")
- Использовать few-shot examples

---

### 6. Debugging: Временный Logging

**Паттерн:**

```typescript
// 1. Добавить debug logging
console.log(`[SHOW_GOAL] stateUserResponse="${stateUserResponse}"`);

// 2. Запустить тест
OPENROUTER_API_KEY=... npx vitest tests/.../test.ts -t "TC-X" --run

// 3. Проанализировать output
// [SHOW_GOAL] stateUserResponse="покажи результаты"
// [SHOW_GOAL] stateUserResponse=""  ← Ага! Вызывается дважды

// 4. ОБЯЗАТЕЛЬНО удалить debug logging после фикса
```

**Где логировать:**

- State values перед routing
- Intent classification результаты
- userResponse до/после использования

**Где НЕ логировать:**

- LLM responses (слишком verbose)
- Database queries (использовать neo4j-cypher MCP для проверки)

---

### 7. Архитектура: Adhoc vs Goal Flows

**Ключевое различие:**

| Aspect            | Adhoc Context                       | Target Context (Goal)                    |
| ----------------- | ----------------------------------- | ---------------------------------------- |
| Что это           | Где user СЕЙЧАС                     | Куда user ХОЧЕТ                          |
| Используется в    | exploration (search.adhoc)          | validation, final search                 |
| Извлекается       | load-context (один раз)             | extract_goal → clarify_goal (multi-turn) |
| Может обновляться | ❌ Нет (read-only после extraction) | ✅ Да (через clarify)                    |
| Очищается после   | load-context (`userResponse: ""`)   | НЕ очищается (используется в show_goal)  |

**Семантика "добавь Германию":**

```typescript
// После validation user видит:
// "5 senior backend: Москва, USA, Германия, Франция, Испания"

// User говорит: "добавь Германию"

// ❌ НЕПРАВИЛЬНАЯ интерпретация: обновить adhoc (где я сейчас)
// Поздно! adhoc уже использован в exploration

// ✅ ПРАВИЛЬНАЯ интерпретация: обновить goal (куда хочу)
// extractedGoal.countries = { mode: "desired", values: ["DE"] }
```

**Правило:**

```
Clarify обновляет TARGET (куда хочу), не ADHOC (где сейчас)
```

---

### 8. Исключения и Invariant Errors

**AgentInvariantError vs обычные errors:**

```typescript
// Используется для НАРУШЕНИЯ КОНТРАКТА между nodes
if (!extractedGoal) {
  throw new AgentInvariantError(NODE.show_goal, "extractedGoal must exist before showing");
}

// НЕ для business logic errors (используй return)
if (candidates.length === 0) {
  // ❌ НЕ throw error
  // ✅ Вернуть state с пустым массивом
  return { candidates: [], phase: PHASE.showingResults };
}
```

**Где бросать AgentInvariantError:**

- Missing required state fields
- Config deps не переданы
- Routing в несуществующий node

**Где НЕ бросать:**

- LLM вернул null/unexpected value → обработать gracefully
- Database query вернул 0 результатов → normal business flow
- User cancelled → использовать phase: PHASE.cancelled

---

### 9. Проверка GraphQL/Cypher через MCP

**Для валидации Cypher queries БЕЗ запуска тестов:**

```bash
# 1. Проверить schema
mcp__neo4j-cypher__get_neo4j_schema({ sample_size: 100 })

# 2. Протестировать query
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "MATCH (u:User) WITH u, u.user_id AS uid RETURN u, uid LIMIT 1",
  params: {}
})

# 3. Проверить PROFILE (performance)
mcp__neo4j-cypher__read_neo4j_cypher({
  query: "PROFILE MATCH (u:User)-[:HAS_CONTEXT]->(c) RETURN count(c)",
  params: {}
})
```

**Когда использовать:**

- Перед добавлением нового Cypher query в query-builder
- После schema migration
- Для отладки "0 results" багов

---

### 10. Git Workflow для LangGraph Changes

**Типичный workflow этой сессии:**

```bash
# 1. Найден баг: normalizer null vs undefined
# Файл: src/facade/services/normalizer.ts

# 2. Написан тест: TC-SG-VC2
# Файл: tests/facade/agents/search-graph/integration/validate-clarify.integration.ts

# 3. Тест падает → фикс кода
# Изменено: normalizer.ts (добавлены if checks)

# 4. Тест проходит → найден НОВЫЙ баг (routing)
# Изменено: search-router.ts, search-graph.ts

# 5. Lint + tsc
npm run lint:fix
npx tsc --noEmit

# 6. Финальный прогон
npm run test:integration
```

**Коммит структура:**

```
feat(search-graph): fix null handling + clarify flow support

- Fix normalizer null vs undefined for optional fields
- Add clarificationText to ask_after_validate + show_results
- Add clarify routing from validation phase
- Implement conditional interrupt in show_goal
- Fix routing loop (unknown intent → set_goal)

Tests: TC-SG-VC2, TC-SG-VC3 (6/9 passing, 3 known bugs)

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## 📋 Checklist: Добавление Нового Node

- [ ] Определить input state fields (что нужно из state)
- [ ] Определить output state fields (что возвращаем)
- [ ] Очистить userResponse если использовал его
- [ ] Добавить routing function (если нужен conditional edge)
- [ ] Добавить ВСЕ destinations в buildRouteMap
- [ ] Написать unit test (если есть сложная логика)
- [ ] Написать integration test (multi-turn flow)
- [ ] Проверить lint + tsc
- [ ] Прогнать related тесты

---

## 📋 Checklist: Debugging Routing Issues

1. **Добавить временный logging:**

   ```typescript
   console.log(`[NODE_NAME] state.field="${state.field}"`);
   ```

2. **Запустить ОДИН failing test:**

   ```bash
   npx vitest path/to/test.ts -t "TC-ID" --run
   ```

3. **Анализировать output:**
   - Какие nodes вызываются?
   - Какие значения в state?
   - Где происходит unexpected routing?

4. **Проверить routing function:**
   - Все cases покрыты?
   - Default case безопасен?
   - buildRouteMap содержит все destinations?

5. **Удалить debug logging после фикса**

---

### 11. LLM Prompt: Explicit Examples > Descriptions

**Проблема**: Описание "domains: work field/industry" недостаточно — LLM путает что куда класть.

**Решение**: **Один конкретный пример решает проблему лучше чем параграф описания.**

```
❌ Плохо: "domains: TECHNICAL SPECIALIZATION area (backend, frontend, mobile)"

✅ Хорошо:
"Example: 'junior backend developer' → position: 'junior', domains: ['backend']"
```

**Почему работает**: LLM pattern-matcher. Один example создаёт чёткий шаблон для извлечения.

**Универсально**: Если LLM путает куда класть данные — добавь explicit example в prompt.

---

### 12. Тесты находят баги в коде, НЕ подгоняются под код

**Антипаттерн**: Тест падает → меняем assertion под текущее поведение.

**Правильно**: Тест падает → исследуем ПОЧЕМУ → часто это баг в бизнес-коде.

**Пример**: E2E тест вернул 0 candidates. Вместо "смягчим assertion" — нашли баг в prompt.

**Правило**: Тест — контракт. Если реальность не соответствует контракту, исправляй реальность.

---

### 13. Schema Enums для LLM Structured Output

**Проблема**: `z.array(z.string())` — LLM не знает допустимые значения, выдумывает.

**Решение**: `z.array(z.enum([...]))` — LLM видит enum values в JSON schema.

```typescript
// ❌ LLM может вернуть что угодно ("Information Technology", "IT", "Tech")
excludedContextFields: z.array(z.string());

// ✅ LLM видит только допустимые: ["countryCode", "cityName", "birthYear", "languages"]
excludedContextFields: z.array(contextFieldSchema);
```

**Универсально**: Любой LLM extraction с ограниченным набором значений → enum schema.

---

### 14. Graceful Handling vs Strict Assertion

**Контекст**: Тесты на unknown/gibberish input.

**Антипаттерн**: `expect(intent).toBe("unknown")` — LLM непредсказуем с gibberish.

**Правильно**: Проверяем инварианты системы, не конкретный output LLM.

```typescript
// ❌ Хрупко — LLM может интерпретировать gibberish как угодно
expect(response.intent).toBe("unknown");

// ✅ Устойчиво — проверяем что система НЕ упала и осталась в валидной фазе
expect(response.phase).not.toBe("failed");
expect(response.phase).toBe(PHASE.showing_exploration);
```

**Правило**: Для edge cases проверяй инварианты (не падает, фаза валидна), не конкретный output.

---

### 15. Fixtures Matching: Проверяй ДО теста

**Проблема**: Тест ожидает candidates, но LLM extraction не матчит fixtures.

**Паттерн проверки**:

```bash
# Что в fixtures?
cat fixtures/U3.json | jq '.contexts[0] | {position, domains}'
# → {"position": "junior", "domains": ["backend"]}

# Что извлёк LLM?
# → {"position": "junior backend developer", "domains": ["Information Technology"]}
# ❌ Не матчит!
```

**Правило**: Перед E2E тестом убедись что expected LLM extraction → matches fixtures.

---

### 16. Debug через Production Code → Потом удалить

**Паттерн**: Добавь `console.log` в production code временно.

```typescript
// Временно в load-context.ts
console.log("[load_context] adhoc extraction:", { extracted, normalized });
```

**Workflow**:

1. Добавить debug logging
2. Запустить тест
3. Проанализировать output
4. **ОБЯЗАТЕЛЬНО удалить** debug logging после понимания проблемы
5. Альтернатива: LangSmith tracing (`LANGSMITH_TRACING=true`)

**Правило**: Debug logs — временные. Не коммитить в production.

---

## 🎓 Главные Уроки

1. **State management**: Очищай userResponse после использования, иначе следующий interrupt не сработает
2. **Routing**: buildRouteMap должен содержать ВСЕ возможные return values из routing функции
3. **Zod validation**: Optional fields требуют ОТСУТСТВИЯ поля, не `null`
4. **Testing**: Multi-turn flows нуждаются в type guards после каждого turn
5. **Intent classification**: LLM непредсказуем → default routing должен быть safe fallback
6. **Debugging**: Временный logging спасает, но ОБЯЗАТЕЛЬНО удаляй после фикса
7. **Architecture**: Adhoc = где сейчас (read-only), Goal = куда хочу (updatable)
8. **Errors**: AgentInvariantError для contract violations, НЕ для business logic
9. **Validation**: Используй neo4j-cypher MCP для проверки queries ДО тестов
10. **Workflow**: Тест пишем ПЕРВЫМ, фиксим код, прогоняем, коммитим
11. **LLM Prompts**: Explicit example > verbose description (LLM = pattern-matcher)
12. **Test Philosophy**: Тесты находят баги в коде, не подгоняются под код
13. **Schema Typing**: Enum schemas для LLM extraction (z.enum, не z.string)
14. **Edge Cases**: Graceful handling → проверяй инварианты, не конкретный LLM output
15. **Fixtures**: Проверяй matching ПЕРЕД написанием теста
16. **Debug Logs**: Временные → добавил, понял, удалил
17. **Intent Prompts**: Описывай СЕМАНТИКУ ответа (brief, slang, informal), не hardcode примеры слов
18. **LLM Test Stability**: После фикса flaky теста — прогони 5 раз до первого fail, не один раз
19. **Test Output**: Не использовать `tail` при запуске интеграционных тестов — теряется контекст ошибок
20. **Named Conditions**: Если в условии 2+ проверки — выноси в именованную константу (`const isEmpty = !value || value.trim() === ""`)
21. **Semantic Field Dependencies**: При тестировании missing fields через omit — используй НЕЗАВИСИМЫЕ поля (см. #21 ниже)
22. **Multi-Phase State**: В multi-turn тестах используй ОДНУ переменную currentResponse, обновляя её на каждом шаге

## 🔗 Связанные Документы

- [SearchGraph Implementation Report](../reports/SEARCH-GRAPH-IMPLEMENTATION-REPORT.md)
- [MVP Test Guidelines](.claude/commands/mvp-test.md)
- [Cypher Router](.claude/routers/cypher/router.md)
- [LangGraph Router](.claude/routers/langgraph/router.md)
