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
│   └── atomic-tools.md            # Atomic tools pattern
├── patterns/                      # Проверенные паттерны
│   ├── error-handling.md          # Error handling patterns
│   └── testing.md                 # Testing strategies
└── reference/                     # Troubleshooting
    └── gotchas.md                 # Критичные ошибки с решениями
```

---

## 🗺️ Navigation Map

### Я новичок в LangChain v1.0

**Path**: Quick Start → Foundation → Advanced

1. **START**: [glossary.md](./glossary.md) - прочитай критичные правила (10 мин)
2. [concepts/agents.md](./concepts/agents.md) - createAgent basics
3. [concepts/tools.md](./concepts/tools.md) - создание tools
4. [concepts/routing.md](./concepts/routing.md) - ⭐ ДЕТАЛЬНО: как agent выбирает tools
5. [Production Example](../../../src/facade/langchain/career-collector-agent.ts) - полный agent

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

1. [concepts/routing.md](./concepts/routing.md) - ⭐ ДЕТАЛЬНО: Hybrid routing (goto + LLM)
2. [concepts/atomic-tools.md](./concepts/atomic-tools.md) - ONE tool = ONE operation
3. [concepts/tools.md](./concepts/tools.md) - Command API для routing
4. [patterns/error-handling.md](./patterns/error-handling.md) - explicit goto для errors

**Key Pattern**: [glossary.md#hybrid-routing](./glossary.md#hybrid-routing) - deterministic goto + LLM intent

---

### Я извлекаю structured data из user input

**Path**: Extraction → Validation → Tools

1. [concepts/structured-output.md](./concepts/structured-output.md) - withStructuredOutput
2. [concepts/tools.md](./concepts/tools.md) - Zod schema validation
3. [concepts/routing.md](./concepts/routing.md) - explicit goto на validation failure
4. [Production Example: extractSingleContextTool](../../../src/facade/langchain/shared-tools/index.ts)

---

### У меня проблема / ошибка

**Path**: Gotchas → Glossary → Troubleshooting

1. [reference/gotchas.md](./reference/gotchas.md) - 🔴 критичные ошибки с решениями
2. [glossary.md](./glossary.md) - критичные правила (Gemini prefix, checkpointer, etc)
3. Check production example: [career-collector-agent.ts](../../../src/facade/langchain/career-collector-agent.ts)

**Top Gotchas**:
- [Gemini prefix обязателен](./reference/gotchas.md#gemini-prefix)
- [Checkpointer для interrupts](./reference/gotchas.md#checkpointer-required)
- [thread_id для persistence](./reference/gotchas.md#thread-id-persistence)
- [Command для state updates](./reference/gotchas.md#command-for-updates)

---

### Я пишу tests для agent

**Path**: Testing → Patterns

1. [patterns/testing.md](./patterns/testing.md) - unit tests + integration tests
2. [concepts/atomic-tools.md](./concepts/atomic-tools.md) - testable tools pattern
3. [patterns/error-handling.md](./patterns/error-handling.md) - test error paths

---

## ⚡ Quick Reference

### Критичные правила (MUST READ)

| Правило | Где | Почему |
|---------|-----|--------|
| Gemini prefix `"models/"` | [glossary#gemini-prefix](./glossary.md#gemini-prefix) | API требует |
| Checkpointer для interrupts | [glossary#checkpointer-required](./glossary.md#checkpointer-required) | Interrupts НЕ РАБОТАЮТ без него |
| thread_id для persistence | [glossary#thread-id-persistence](./glossary.md#thread-id-persistence) | State теряется без него |
| Command для state updates | [glossary#command-for-updates](./glossary.md#command-for-updates) | Обычный return НЕ обновит state |
| messages field в schema | [glossary#messages-field-required](./glossary.md#messages-field-required) | Agent НЕ РАБОТАЕТ без него |

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

---

### Паттерны (Quick Lookup)

- **Atomic Tools** → [glossary#atomic-tools-pattern](./glossary.md#atomic-tools-pattern)
- **Hybrid Routing** → [glossary#hybrid-routing](./glossary.md#hybrid-routing)
- **Multi-Round Clarification** → [glossary#multi-round-clarification](./glossary.md#multi-round-clarification)

---

## 🔗 External Resources

- **Official LangChain v1 Docs**: https://docs.langchain.com/oss/javascript/releases/langchain-v1
- **LangGraph Docs**: https://docs.langchain.com/oss/javascript/langgraph
- **Production Example**: [career-collector-agent.ts](../../../src/facade/langchain/career-collector-agent.ts)
- **Shared Tools**: [shared-tools/index.ts](../../../src/facade/langchain/shared-tools/index.ts)

---

## 📊 Stats

**Coverage**: ~2,200 lines (was ~1,950 lines)
**Files**: 13 files (was 5 files)
**Duplication**: Eliminated via glossary + cross-references
**Production-validated**: All patterns used in WayMates career-collector-agent

---

**Last Updated**: 2025-11-26
**Maintained By**: Claude + Human (via `/sync-memory`)
