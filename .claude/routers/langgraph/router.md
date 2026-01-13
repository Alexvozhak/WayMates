# LangGraph Router

**Назначение**: Entry point для LangGraph StateGraph API.

---

## Когда использовать

- Создаёшь/модифицируешь StateGraph workflows
- Работаешь с interrupt/resume для human-in-the-loop
- Пишешь router functions для conditional edges

**Референсы в коде**:
- `src/facade/langchain/cold-start-v2/` — основной пример
- `src/facade/langchain/upsert-*/` — простые графы
- `src/facade/langchain/shared/` — переиспользуемые утилиты

---

## Навигация

| Задача | Файл |
|--------|------|
| API справочник | [glossary.md](./glossary.md) |
| Критичные ошибки | [gotchas.md](./gotchas.md) |

---

## Структура агента

```
src/facade/langchain/{agent-name}/
├── state.ts              # Annotation.Root + types
├── {agent}-graph.ts      # StateGraph builder + compile
├── nodes/
│   └── {node-name}.ts
├── routers/
│   └── {router-name}.ts
├── types.ts
└── response-builders.ts
```

---

## Ключевые принципы

1. **Routing через код** — router functions детерминированные, не LLM
2. **LLM только для extraction** — извлечение данных, парсинг intent
3. **Checkpointer обязателен** — для interrupt/resume

---

**Обновлено**: 2025-12-05
