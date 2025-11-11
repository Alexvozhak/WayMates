---
description: "Синхронизировать знания текущей сессии в memory-bank, Memory MCP и архитектурную документацию"
allowed-tools: ["mcp__memory__*", "mcp__vikunja__*", "Read", "Write", "Edit", "Bash"]
argument-hint: "[optional: focus area - testing|cypher|linting|architecture]"
---

# 🧠 Memory Bank Sync для WayMates

$ARGUMENTS

## Новая структура memory-bank

```
memory-bank/
├── index.md                      # Router (навигация)
├── project-state/                # Текущее состояние
│   ├── domain-model.md           # Сущности + ссылки на Structurizr
│   ├── testing.md                # Test registry + commands
│   ├── cypher.md                 # Cypher conventions
│   └── linting.md                # ESLint/TypeScript results
├── history/                      # История
│   ├── breaking-changes.md       # Breaking changes + fixes
│   └── sessions-brief.md         # Бизнес-смысл сессий (5-10 строк)
└── knowledge/                    # Справочники
    ├── bugs-registry.md          # Production bugs registry (use /report-bug)
    ├── cypher-mistakes.md        # Типовые ошибки
    ├── pitfalls.md               # Грабли
    ├── decisions.md              # Важные решения
    └── code-quality.md           # Правила стиля
```

---

## Что обновляю:

### 1. memory-bank (выборочно, по изменениям)
- `project-state/testing.md` - если тесты менялись
- `project-state/linting.md` - если ran lint/tsc
- `project-state/cypher.md` - если новые Cypher conventions
- `history/breaking-changes.md` - если breaking change
- `history/sessions-brief.md` - **ВСЕГДА** (5-10 строк на сессию)
- `knowledge/*` - если новые уроки/грабли
- `knowledge/bugs-registry.md` - **НЕТ** (используй `/report-bug` для багов)

### 2. Memory MCP (ВСЕГДА)
- Архитектурные паттерны (entities + relations)
- Технические решения (entities + observations)
- Уроки из сессии (session entities)

### 3. Архитектурная документация (если менялась)
- `docs/architecture/workspace.dsl` - Structurizr
- `docs/architecture/README.md` - дата + метрики

---

## Процесс:

### Шаг 0: Git diff анализ

Определяю **что изменилось** за сессию:

```bash
git diff HEAD~1..HEAD  # Изменения с последнего коммита
git status             # Unstaged changes
```

Анализирую:
1. **Схемы изменились?** (src/shared/schemas.ts, src/core/schemas.ts)
   → Обновляю workspace.dsl (Components)

2. **Query Builders изменились?** (src/core/*-query-builder.ts)
   → Обновляю workspace.dsl (Relationships)
   → Добавляю patterns в Memory MCP

3. **Tests изменились?** (tests/integration/*)
   → Обновляю project-state/testing.md (test registry)

4. **Lint/TypeScript results изменились?**
   - Запускаю `npm run lint` и `npx tsc --noEmit`
   - Сравниваю с текущим состоянием в linting.md
   - Если errors/warnings count изменился → обновляю linting.md
   - Если нет изменений → skip

5. **Breaking changes?** (из conversation)
   → Добавляю в history/breaking-changes.md

6. **Новые уроки?** (из reviewer/qa output)
   → Обновляю knowledge/* (cypher-mistakes, pitfalls, decisions)

### Шаг 1: Обновляю memory-bank (по результатам Шаг 0)

#### project-state/* (актуализация)
- **testing.md** - если тесты менялись:
  - Обновить test registry (AC1-AC6, UN1-UN4, etc)
  - Обновить Test State Changes table
  - Обновить Known Issues

- **linting.md** - **ТОЛЬКО если results изменились**:
  - Запустить `npm run lint` и `npx tsc --noEmit`
  - Сравнить с Current State в linting.md
  - Если изменения (errors/warnings count) → обновить:
    - Current State (ESLint/TypeScript results)
    - Historical Trends table (новая строка)
    - Planned Fixes (если новые ошибки)
  - Если нет изменений → skip (не дублируем одинаковую статистику)

- **cypher.md** - если новые conventions:
  - Обновить checklist
  - Добавить ссылки на Memory MCP patterns

#### history/* (инкрементальное добавление)
- **sessions-brief.md** - **ВСЕГДА**:
  - Добавить 5-10 строк в начало файла (reverse chronological)
  - Format: Commit + Problem → Solution → Result → Key Lesson
  - Ссылки на Memory MCP entities

- **breaking-changes.md** - если breaking change:
  - Добавить секцию в начало файла
  - Format: Date + Commit + What/Impact/Symptoms/Fix/Root cause

#### knowledge/* (по необходимости)
- **cypher-mistakes.md** - если новая ошибка
- **pitfalls.md** - если новые грабли
- **decisions.md** - если важное решение
- **code-quality.md** - если новое правило

### Шаг 2: Memory MCP (ВСЕГДА)

Сохраняю в граф знаний:

#### Session Entity (ОБЯЗАТЕЛЬНО)
```typescript
mcp__memory__create_entities({
  entities: [
    {
      name: "Session 2025-11-11",
      entityType: "session",
      observations: [
        // ✅ Что выполнено (completed tasks)
        "Completed: Migrated memory-bank to new structure (13 files created)",
        "Completed: Updated sync-memory command with lint change detection",

        // 🚧 На чем остановились (current state)
        "Current state: All memory-bank files created, ready to commit",
        "Blocker: None",

        // ➡️ С чего продолжать (next steps)
        "Next: Commit memory-bank refactoring",
        "Next: Implement AC2-AC6 adhoc search tests",
        "Next: Fix test data date issue (U1 context[1] future date)"
      ]
    }
  ]
})
```

#### Architecture Patterns (если были)
```typescript
mcp__memory__create_entities({
  entities: [
    {
      name: "Memory Bank Structure Pattern",
      entityType: "architecture_pattern",
      observations: [
        "Separation: Memory MCP (structured knowledge) vs memory-bank (operational context)",
        "Memory MCP stores: patterns, decisions, relations (why)",
        "memory-bank stores: current state, commands, quick refs (how)",
        "Principle: No duplication, memory-bank has links to Memory MCP entities"
      ]
    }
  ]
})

// Relations
mcp__memory__create_relations({
  relations: [
    {
      from: "Session 2025-11-11",
      to: "Memory Bank Structure Pattern",
      relationType: "implemented"
    }
  ]
})
```

### Шаг 3: Архитектурная документация (если Шаг 0 выявил)

- **workspace.dsl** - если архитектура изменилась
- **README.md** - всегда обновляю дату + метрики готовности

### Шаг 4: Git commit (рекомендация)

Если были изменения в memory-bank:
```bash
git add memory-bank/ docs/architecture/
git commit -m "docs: update memory-bank after [session summary]"
```

### Шаг 5: Cleanup завершенных задач

Анализирую текущую сессию: если есть observations с "Completed: ..." - **СПРАШИВАЮ ПОЛЬЗОВАТЕЛЯ**:

```
❓ В этой сессии завершены задачи:
  - DTW trajectory implementation
  - Test data U10-U13 creation

Удалить их из Memory MCP? (summary останется в sessions-brief.md)
[Да/Нет]
```

Если **Да** - удаляю entities через `mcp__memory__delete_entities`.
Если **Нет** - оставляю в графе.

**Принцип**: Завершенные задачи → в history/sessions-brief.md, не в Memory MCP.

---

## Итоговый отчет:

После синхронизации показываю:
- ✅ Обновленные файлы в memory-bank/ (список)
- ✅ Entities добавленные в Memory MCP (список)
- ✅ Обновленные файлы в docs/architecture/ (если были)
- 💡 Рекомендации для следующей сессии

---

## Принципы:

1. **Не дублируем Memory MCP** - в memory-bank только краткие ссылки
2. **Актуализируем, не инкрементим** - project-state/* = current state
3. **sessions-brief.md = бизнес-смысл** (не техдетали)
4. **Reverse chronological** - новое в начало файла
5. **Компактность** - 5-10 строк на сессию в sessions-brief.md

---

💡 **Используйте `/sync-memory` в конце каждой рабочей сессии!**
