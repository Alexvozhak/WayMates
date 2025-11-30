# LangChain v1.0 Router

**Назначение**: Entry point для LangChain v1.0 документации. Навигация по concepts, patterns, reference.

**Версия**: 1.0 | **Статус**: Production | **Обновлено**: 2025-11-26

---

## 🎯 Когда использовать

**Используй ЭТОТ роутер когда**:
- Создаешь agents через `createAgent` API (LangChain v1.0+)
- Реализуешь human-in-the-loop workflows с interrupts
- Настраиваешь multi-round dialogs с state persistence
- Мигрируешь с LangGraph prebuilts на createAgent

**НЕ используй если**:
- Работаешь с прямым StateGraph API → см. LangGraph docs
- Используешь LangChain v0.x → см. migration guides
- Ищешь общие LLM patterns → см. main LangChain docs

---

## 📂 Структура документации

```
.claude/routers/langchain/
├── glossary.md                    # ⭐ Критичные правила + термины (START HERE)
├── router.md                      # Этот файл - navigation
├── concepts/                      # Короткие заметки (30-50 строк)
│   ├── agents.md                  # createAgent API
│   ├── tools.md                   # tool() factory
│   ├── structured-output.md       # withStructuredOutput
│   ├── state-management.md        # Custom state schema
│   ├── middleware.md              # humanInTheLoopMiddleware
│   ├── checkpointers.md           # PostgresSaver setup
│   ├── routing.md                 # ⭐ ДЕТАЛЬНО: Explicit vs Implicit vs Hybrid (150 строк)
│   ├── human-in-loop.md           # ⭐ ДЕТАЛЬНО: Interrupts + multi-round (150 строк)
│   ├── atomic-tools.md            # Atomic tools pattern
│   └── mcp-adapters.md            # ⭐ @langchain/mcp-adapters — MCP интеграция
├── patterns/                      # Проверенные паттерны
│   ├── error-handling.md          # Error handling patterns
│   └── testing.md                 # Testing strategies
└── reference/                     # Troubleshooting
    └── gotchas.md                 # Критичные ошибки с решениями
```

---

## ⚠️ КРИТИЧНО: goto НЕ работает с createAgent

**`Command({ goto })` игнорируется в `createAgent` API!**

Используй **LLM Routing** через ToolMessage + tool descriptions вместо goto.

→ [gotchas.md#15](./reference/gotchas.md#15-goto-не-работает-с-createagent)

---

## 🗺️ Navigation Map

### Я новичок в LangChain v1.0

**Path**: Quick Start → Foundation → Advanced

1. **START**: [gotchas.md](./reference/gotchas.md) - прочитай критичные ошибки (5 мин)
2. [glossary.md](./glossary.md) - API reference
3. [concepts/tools.md](./concepts/tools.md) - создание tools с ToolRuntime
4. [concepts/routing.md](./concepts/routing.md) - ⭐ LLM Routing через ToolMessage
5. [concepts/human-in-loop.md](./concepts/human-in-loop.md) - Agent-driven decisions

---

### Я реализую human-in-the-loop workflow

**Path**: Interrupts → State → Patterns

1. [concepts/human-in-loop.md](./concepts/human-in-loop.md) - ⭐ ДЕТАЛЬНО: full interrupt workflow
2. [concepts/middleware.md](./concepts/middleware.md) - humanInTheLoopMiddleware setup
3. [concepts/checkpointers.md](./concepts/checkpointers.md) - PostgresSaver ОБЯЗАТЕЛЕН
4. [concepts/state-management.md](./concepts/state-management.md) - custom state schema
5. [patterns/error-handling.md](./patterns/error-handling.md) - max rounds protection

**Gotcha**: [glossary.md#checkpointer-required](./glossary.md#checkpointer-required) - без checkpointer interrupts НЕ РАБОТАЮТ!

---

### Я проектирую multi-step workflow

**Path**: Routing → Tools → Patterns

1. [concepts/routing.md](./concepts/routing.md) - ⭐ LLM Routing через ToolMessage
2. [concepts/atomic-tools.md](./concepts/atomic-tools.md) - ONE tool = ONE operation
3. [concepts/tools.md](./concepts/tools.md) - ToolRuntime + Command API
4. [gotchas.md#13](./reference/gotchas.md#13-command-без-toolmessage--undefined-error) - ToolMessage обязателен

**Key Pattern**: [glossary.md#llm-routing](./glossary.md#llm-routing-вместо-goto) - ToolMessage + description направляют LLM

---

### Я извлекаю structured data из user input

**Path**: Extraction → Validation → Tools

1. [concepts/structured-output.md](./concepts/structured-output.md) - withStructuredOutput
2. [concepts/tools.md](./concepts/tools.md) - Zod schema validation + ToolRuntime
3. [concepts/routing.md](./concepts/routing.md) - ToolMessage на validation failure
4. [gotchas.md#14](./reference/gotchas.md#14-openai-structured-output-требует-nullable) - OpenAI требует `.nullable()`

---

### У меня проблема / ошибка

**Path**: Gotchas → Glossary → Troubleshooting

1. [reference/gotchas.md](./reference/gotchas.md) - 🔴 критичные ошибки с решениями
2. [glossary.md](./glossary.md) - критичные правила (Gemini prefix, checkpointer, etc)
3. Check production example: [career-collector-agent.ts](../../../src/facade/langchain/career-collector-agent.ts)

**Top Gotchas**:
- [#13 ToolMessage обязателен](./reference/gotchas.md#13-command-без-toolmessage--undefined-error)
- [#15 goto НЕ работает с createAgent](./reference/gotchas.md#15-goto-не-работает-с-createagent)
- [#14 OpenAI требует .nullable()](./reference/gotchas.md#14-openai-structured-output-требует-nullable)
- [Checkpointer для interrupts](./reference/gotchas.md#checkpointer-required)
- [thread_id для persistence](./reference/gotchas.md#thread-id-persistence)

---

### Я пишу tests для agent

**Path**: Testing → Patterns

1. [patterns/testing.md](./patterns/testing.md) - unit tests + integration tests
2. [concepts/atomic-tools.md](./concepts/atomic-tools.md) - testable tools pattern
3. [patterns/error-handling.md](./patterns/error-handling.md) - test error paths

---

### Я подключаю agent к MCP серверу

**Path**: MCP Adapters → Integration

1. [concepts/mcp-adapters.md](./concepts/mcp-adapters.md) - ⭐ @langchain/mcp-adapters полный гайд
2. [concepts/agents.md](./concepts/agents.md) - createAgent для использования tools
3. [ADR-006](../../../docs/facade/decisions/ADR-006.md) - E2E testing с MCP

**Key Points**:
- `MultiServerMCPClient` для подключения к MCP серверам
- `getTools()` возвращает LangChain-совместимые tools
- Работает напрямую с `createAgent` (LangChain v1 API)
- **Не требует LangGraph/StateGraph** — чистый LangChain v1

---

## ⚡ Quick Reference

### Критичные правила (MUST READ)

| Правило | Gotcha | Почему |
|---------|--------|--------|
| goto НЕ работает с createAgent | [#15](./reference/gotchas.md#15-goto-не-работает-с-createagent) | Используй LLM Routing |
| ToolMessage обязателен | [#13](./reference/gotchas.md#13-command-без-toolmessage--undefined-error) | Agent падает без него |
| OpenAI требует .nullable() | [#14](./reference/gotchas.md#14-openai-structured-output-требует-nullable) | Zod validation fails |
| Checkpointer для interrupts | [#2](./reference/gotchas.md#checkpointer-required) | Interrupts НЕ РАБОТАЮТ без него |
| thread_id для persistence | [#3](./reference/gotchas.md#thread-id-persistence) | State теряется без него |

---

### Термины (Quick Lookup)

- `createAgent` → [glossary#createagent](./glossary.md#createagent)
- `tool()` → [glossary#tool](./glossary.md#tool)
- `Command` → [glossary#command](./glossary.md#command)
- `interrupt()` → [glossary#interrupt](./glossary.md#interrupt)
- `humanInTheLoopMiddleware` → [glossary#humanintheloopmiddleware](./glossary.md#humanintheloopmiddleware)
- `PostgresSaver` → [glossary#postgressaver](./glossary.md#postgressaver)
- `MessagesZodState` → [glossary#messageszodstate](./glossary.md#messageszodstate)
- `withStructuredOutput` → [glossary#withstructuredoutput](./glossary.md#withstructuredoutput)
- `MultiServerMCPClient` → [concepts/mcp-adapters.md](./concepts/mcp-adapters.md)

---

### Паттерны (Quick Lookup)

- **Agent-Driven Decision** → [glossary.md](./glossary.md#agent-driven-decision-recommended) — Agent парсит NLP
- **LLM Routing** → [glossary.md](./glossary.md#llm-routing-вместо-goto) — ToolMessage направляет LLM
- **Multi-Round Clarification** → [glossary.md](./glossary.md#multi-round-clarification)

---

## 🔗 External Resources

- **Official LangChain v1 Docs**: https://docs.langchain.com/oss/javascript/releases/langchain-v1
- **LangGraph Docs**: https://docs.langchain.com/oss/javascript/langgraph
- **Production Example**: [career-collector-agent.ts](../../../src/facade/langchain/career-collector-agent.ts)
- **Shared Tools**: [shared-tools/index.ts](../../../src/facade/langchain/shared-tools/index.ts)

---

## 📊 Stats

**Coverage**: ~1,200 lines (сокращено с ~2,400)
**Files**: 14 files
**Key change**: `goto` не работает с `createAgent` → LLM Routing

---

**Last Updated**: 2025-11-30
**Maintained By**: Claude + Human (via `/sync-memory`)
