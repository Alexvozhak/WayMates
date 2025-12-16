---
description: "Синхронизировать знания текущей сессии в memory-bank, Memory MCP и архитектурную документацию"
allowed-tools: ["mcp__memory__*", "Read", "Write", "Edit", "Bash"]
argument-hint: "[optional: focus area - testing|cypher|linting|architecture]"
---

# 🧠 Memory Bank Sync

$ARGUMENTS

## Принцип: Каждое место хранит СВОЁ

**Дублирование = враг**. Разделяем:

| Место | Что храним | Формат |
|-------|-----------|--------|
| **sessions-brief.md** | Навигация по коммитам | Commit + Problem→Solution→Result (3-5 строк) |
| **decisions.md** | Стратегические решения WHY | Problem→Decision→Why→Alternative (архитектура + tech choices ТОЛЬКО) |
| **Memory MCP Session** | Статус сессии | Completed/Result/Next/Blocker (5-7 observations) |
| **Memory MCP Patterns** | Переиспользуемые знания | When/How/Validate/Example (важные инсайты + reusable patterns) |

---

## Ключевые правила

1. **Memory Bank = индекс**: Полный контекст в `docs/`, memory-bank - ссылки. Пример: "См. `docs/mvp_final/TEST_PLAN.md:45-67`"
2. **Авто-архивирование**: RESOLVED bugs → "Resolved Bugs" section, DONE features → "Completed Features" (предложить пользователю)
3. **breaking-changes.md**: Date + Commit + What/Impact/Fix/Root cause
4. **workspace.dsl**: Схемы изменились → обновить Components, Query Builders → обновить Relationships
5. **Cleanup MCP**: Предлагать удалить завершенные tasks из Memory MCP (summary остается в sessions-brief)

---

## Процесс

### Шаг 0: Анализ изменений

```bash
git log --oneline -1        # Last commit
git status --porcelain      # Unstaged changes
```

**Проверяю**:
- Code changes ready to commit? → Предложить закоммитить СЕЙЧАС (нужен commit hash для sessions-brief)
- Lint/TS results changed? → Обновить linting.md
- Tests changed? → Обновить testing.md
- Breaking changes? → Добавить в breaking-changes.md

---

### Шаг 1: sessions-brief.md (ВСЕГДА)

**Формат** (3-5 строк):
```markdown
## YYYY-MM-DD: [Title] ✅
Commit: [hash] | Problem: [1 строка] | Solution: [1 строка] | Result: [метрики]
Key Insight: [ОДИН важный]
См. MCP: [Entity names]
```

**Правила**:
- ❌ НЕТ деталей implementation
- ❌ НЕТ списков (Решение 1,2,3,4)
- ❌ НЕТ Lessons learned (→ Memory MCP)
- ✅ ОДИН key insight (самый важный)

---

### Шаг 2: decisions.md (ВЫБОРОЧНО)

**Когда добавлять**:
- ✅ Архитектурные решения (module boundaries, layer separation)
- ✅ Технологические выборы (LangGraph vs X, Redis vs Y)
- ❌ Code refactoring (не стратегическое)
- ❌ Bug fixes (не решение)

**Формат** (8-12 строк):
```markdown
## [Decision Title] (YYYY-MM-DD)

Problem: [1-2 строки]
Decision: [1 строка]
Why: [2-4 пункта обоснование]
Alternative: [если была] → rejected because [причина]

См. commit: [hash]
См. MCP: [Pattern entity]
```

---

### Шаг 3: Memory MCP (ВСЕГДА)

#### 3.1 Session Entity (статус + context)

```typescript
mcp__memory__create_entities({
  entities: [{
    name: "Session YYYY-MM-DD",
    entityType: "session",
    observations: [
      "Completed: [task description] ([commit hash])",
      "Result: [metrics, impact]",
      "Next: [next task]",
      "Blocker: [if any]",
      // опционально +1-2 context строки
    ]
  }]
})
```

**5-7 observations MAX**. Детали → в Pattern entities.

#### 3.2 Architecture/Code Pattern (ВЫБОРОЧНО)

**Когда создавать**:
- ✅ Переиспользуемые паттерны (можно применить в других задачах)
- ✅ Важные инсайты (ключевые уроки из сессии)
- ❌ Одноразовые технические детали

**Формат**:
```typescript
{
  name: "[Pattern Name]",
  entityType: "architecture_pattern | code_pattern",
  observations: [
    "When: [trigger condition]",
    "How: [steps]",
    "Benefit: [why use]",
    "Example: [concrete case]",
    "Alternative: [if any] → rejected because"
  ]
}
```

#### 3.3 Relations

```typescript
mcp__memory__create_relations({
  relations: [
    { from: "Session YYYY-MM-DD", to: "[Pattern]", relationType: "implemented" }
  ]
})
```

---

### Шаг 4: project-state/* (ПО НЕОБХОДИМОСТИ)

**linting.md** - ТОЛЬКО если results изменились:
```bash
npm run lint:fix
npx tsc --noEmit
# Сравнить с Current State в linting.md
# Если изменения → обновить Current State + Historical Trends
```

**testing.md** - если тесты менялись:
- Обновить test registry
- Обновить Known Issues

**cypher.md** - если новые conventions

---

### Шаг 5: Git commit memory-bank

```bash
git add memory-bank/
git commit -m "docs: sync memory after [session title]"
```

---

## Итоговый отчет

После синхронизации показать:
- ✅ Обновленные файлы memory-bank/
- ✅ Entities добавленные в Memory MCP
- 💡 Рекомендации для следующей сессии

---

💡 **Используй `/sync-memory` в конце каждой сессии!**
