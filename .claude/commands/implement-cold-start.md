---
name: implement-cold-start
description: Реализовать cold_start MCP tool для сбора карьерной истории через LangChain v1.0 createAgent. Multi-turn диалог с PostgreSQL checkpointing.
tools: Read, Write, Edit, Bash, Grep, Glob, Task
model: sonnet
---

# Implement Cold Start Workflow

Ты реализуешь **cold_start MCP tool** - multi-turn диалог для сбора карьерной истории.

## 🚨 КРИТИЧНО: Что НЕ делать

**НИКОГДА**:

- ❌ НЕ создавай типы без `grep -r "export type" src/shared/`
- ❌ НЕ используй default export (запрещен ESLint строка 124)
- ❌ НЕ используй export \* from (запрещен ESLint строка 129)
- ❌ НЕ используй any (запрещен ESLint строка 133)
- ❌ НЕ создавай inline типы - используй z.infer
- ❌ НЕ смешивай type и value imports (ESLint строка 63)
- ❌ НЕ превышай max-depth: 2 (ESLint строка 176)
- ❌ НЕ превышай complexity: 8 (ESLint строка 177)
- ❌ НЕ пиши функции > 60 строк (ESLint строка 178)
- ❌ НЕ забывай .js в импортах (ESLint строка 117)
- ❌ НЕ придумывай новые паттерны - следуй BaseTool
- ❌ НЕ создавай отладочные, малоценные doxygen комментарии к каждой функции

## 📚 Загрузи контекст (в этом порядке)

```bash
# 1. Конфигурация и правила
Read tsconfig.json                        # TypeScript конфигурация (ESM, Node 20)
Read eslint.config.mjs                    # ВСЕ правила кода
Read .claude/context/project.md           # Архитектурные паттерны

# 2. План реализации
Read docs/architecture/facade/cold-start-implementation-plan.md

# 3. Существующие паттерны
Read src/facade/mcp-server/tools/search-careers.tool.ts  # Пример BaseTool
Read src/facade/services/llm-fuzzy-matcher.ts           # Пример LangChain usage
Read src/facade/infrastructure/postgres.service.ts       # PostgresSaver готов

# 4. Схемы и типы
grep -r "export type.*Context" src/shared/
grep -r "export const.*Schema" src/facade/mcp-server/schemas.ts
```

## 🎯 Текущая сессия

**Определи по состоянию кода**:

- Если нет `collector-agent.ts` → Сессия 1
- Если нет `cold-start.tool.ts` → Сессия 2
- Если нет тестов → Сессия 3

## 📋 Сессия 1: CollectorAgent

### Шаг 1.1: Проверь типы

```bash
grep -r "export type UserContext" src/shared/
grep -r "export type Trail" src/shared/
grep -r "export type SessionId" src/shared/
```

### Шаг 1.2: Расширь SessionMiddleware

**Файл**: `src/facade/mcp-server/session-middleware.ts`

Добавь метод:

```typescript
async getThreadId(sessionId: SessionId): Promise<string> {
  // 1. Check Redis session
  // 2. Query PostgreSQL facade.sessions
  // 3. Create thread_id if missing
  // 4. Return thread_id
}
```

### Шаг 1.3: Создай CollectorAgent

**Файл**: `src/facade/langchain/collector-agent.ts`

**Структура**:

```typescript
import { createAgent, tool } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

// Tools
const extractContextsTool = tool(...);
const askClarificationTool = tool(...);

// Agent
export const collectorAgent = createAgent({
  model: new ChatGoogleGenerativeAI({
    model: "models/gemini-1.5-flash", // ← С префиксом!
    temperature: 0.3,
  }),
  tools: [extractContextsTool, askClarificationTool],
  checkpointer: postgresService.getCheckpointer(),
  stateSchema: z.object({...}),
  systemPrompt: `...BATCH questions, NOT one-by-one...`,
});

// Export function (max 60 lines!)
export async function collectContexts(...) {...}
```

**После каждого файла**: `npm run lint && npx tsc --noEmit`

## 📋 Сессия 2: ColdStartTool

### Шаг 2.1: Проверь схемы

```bash
grep -r "sessionIdSchema" src/facade/
grep -r "userContextSchema" src/shared/
```

### Шаг 2.2: Создай ColdStartTool

**Файл**: `src/facade/mcp-server/tools/cold-start.tool.ts`

Следуй паттерну из `search-careers.tool.ts`:

- Extends BaseTool
- Constructor с DI
- executeImpl < 60 строк
- Named export

### Шаг 2.3: Добавь схему

**Файл**: `src/facade/mcp-server/schemas.ts`

```typescript
export const coldStartParamsSchema = z.object({
  message: z.string(),
  sessionId: sessionIdSchema,
});

export type ColdStartParams = z.infer<typeof coldStartParamsSchema>;
```

### Шаг 2.4: Зарегистрируй tool

**Файл**: `src/facade/mcp-server/facade-mcp-server.ts`

Найди где регистрируются другие tools и добавь cold_start.

## 📋 Сессия 3: Tests

### Шаг 3.1: Integration tests

**Файл**: `tests/facade/integration/cold-start.integration.ts`

5 test cases (см. план):

- TC1: Single-turn
- TC2: Multi-turn
- TC3: Resume MD
- TC4: Unknown skills
- TC5: Checkpointing

**Используй**:

- Real Gemini API
- Real PostgreSQL
- Mock Core client

### Шаг 3.2: Обнови документацию

**Файл**: `docs/architecture/facade/implementation-roadmap.md`

В секцию "Принятые решения" добавь:

```markdown
#### TASK-COLD: Cold Start Workflow (2025-11-22)

**Решение**: LangChain createAgent с stateful checkpointing
**Причина**: Multi-turn диалог требует памяти между вызовами
**Альтернативы**: Stateless (отклонен - плохой UX)
**Details**: collector-agent.ts, PostgresSaver, batch questions
```

## 🔍 Как проверять себя

**После КАЖДОГО изменения**:

```bash
npm run lint         # 0 errors обязательно
npx tsc --noEmit    # 0 errors обязательно
```

**Перед переходом к следующему шагу**:

- [ ] Файл создан/изменен
- [ ] Lint clean
- [ ] TypeScript компилируется
- [ ] Следует существующим паттернам

## 🆘 Если застрял

1. **"Type already exists"** → grep нашел тип → используй существующий
2. **ESLint error** → найди правило в eslint.config.mjs по номеру строки
3. **"max-depth exceeded"** → декомпозируй на helper функции
4. **"complexity too high"** → разбей if/else на отдельные функции
5. **"function too long"** → выдели часть логики в private методы

## ✅ Definition of Done

**Сессия 1**:

- [ ] SessionMiddleware.getThreadId() работает
- [ ] CollectorAgent парсит текст и MD
- [ ] Batch вопросы (НЕ one-by-one)
- [ ] 0 ESLint errors

**Сессия 2**:

- [ ] ColdStartTool extends BaseTool
- [ ] Зарегистрирован в MCP server
- [ ] 3 статуса обрабатываются
- [ ] 0 TypeScript errors

**Сессия 3**:

- [ ] 5 integration tests зеленые
- [ ] Документация обновлена
- [ ] npm run test:integration проходит

## 📝 Финальная проверка

```bash
# Quality gates
npm run lint && npx tsc --noEmit && npm run test:integration

# Commit
git add -A
git commit -m "feat(facade): implement cold_start MCP tool with LangChain v1.0

- CollectorAgent с multi-turn диалогом
- PostgreSQL checkpointing через thread_id
- Resume MD parsing support
- 2-tier normalization интеграция
- 5 integration tests"
```

**НЕ переходи к review пока ВСЕ чекбоксы не отмечены!**
