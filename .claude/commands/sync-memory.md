---
description: "Синхронизировать знания текущей сессии в memory-bank и memory MCP"
allowed-tools: ["mcp__memory__*", "mcp__vikunja__*", "Read", "Write", "Bash"]
argument-hint: "[optional: focus area - tasks|context|progress|decisions|lessons]"
---

# 🧠 Memory Bank Sync для WayMates

Анализирую сессию и обновляю memory-bank...

## 📊 Что анализирую:

1. **Vikunja задачи** → обновляю `tasks.md`
2. **Текущий фокус** → обновляю `activeContext.md`
3. **Завершенная работа** → обновляю `progress.md`
4. **Архитектурные решения** → создаю `creative-YYYYMMDD-*.md`
5. **Уроки и баги** → создаю `reflect-YYYYMMDD-*.md`

$ARGUMENTS

## Процесс синхронизации:

### Шаг 1: Анализ контекста сессии

Просматриваю:
- Какие файлы менялись (особенно в `/src/core/`, `/src/facade/`)
- Какие агенты вызывались (planner, cypher-expert, reviewer, qa)
- Какие решения принимались
- Какие проблемы обнаружены

### Шаг 2: Обновление tasks.md

```markdown
# 📋 Tasks Registry

## 🔥 Active (In Vikunja)
[Синхронизирую с Vikunja через mcp__vikunja__vikunja_tasks]
- #ID - название - статус - приоритет

## 🏗️ Architecture TODOs
[Из обсуждений и tech debt]
- [ ] Задача из сессии

## ✅ Completed This Session
[Что завершено сегодня]
- [x] Задача - commit hash
```

### Шаг 3: Обновление activeContext.md

```markdown
# 🎯 Active Context

## Current Focus
**Module**: [например: core/search-manager]
**Feature**: [что реализуем]
**Goal**: [бизнес-цель]

## Key Files
[Файлы которые менялись]

## Decisions Made
[Решения из planner агента]

## Open Questions
[Что осталось неясным]
```

### Шаг 4: Обновление progress.md

```markdown
# 📈 Progress Log

## Session: YYYY-MM-DD HH:MM

### Completed
- ✅ Что сделано
- ✅ Какие тесты написаны
- ✅ Какие баги исправлены

### Commits
- hash: сообщение

### Metrics
- Lines added/removed
- Test coverage change
- Performance improvements
```

### Шаг 5: Создание creative-*.md (если были архитектурные решения)

Если вызывался planner агент или принимались архитектурные решения:

```markdown
# Creative: [Topic] - YYYY-MM-DD

## Decision
[Что решили]

## Rationale
[Почему так]

## Type Schema
[Если planner давал схему типов]

## Implementation Notes
[Детали реализации]
```

### Шаг 6: Создание reflect-*.md (если были уроки)

Если обнаружены баги, паттерны, lessons learned:

```markdown
# Reflect: [Topic] - YYYY-MM-DD

## What Happened
[Что произошло]

## Root Cause
[Причина]

## Lesson Learned
[Чему научились]

## Action Items
[Что нужно сделать]
```

### Шаг 7: Обновление Memory MCP

Сохраняю ключевые знания в граф для долговременного хранения:

```typescript
// Архитектурные решения
mcp__memory__create_entities({
  entities: [{
    name: "Decision_YYYYMMDD_topic",
    entityType: "Architecture_Decision",
    observations: [...]
  }]
})

// Обнаруженные паттерны
mcp__memory__create_entities({
  entities: [{
    name: "Pattern_YYYYMMDD_name",
    entityType: "Code_Pattern",
    observations: [...]
  }]
})
```

### Шаг 8: Проверка Structurizr диаграмм

Если менялась архитектура в `/src/core/` или `/src/facade/`:
- Предложу обновить workspace.dsl
- Напомню про `npm run structurizr:up` для визуализации

## 📊 Итоговый отчет:

После синхронизации показываю:
1. Какие файлы обновлены в memory-bank/
2. Что сохранено в Memory MCP
3. Какие Vikunja задачи синхронизированы
4. Предложения по следующим шагам

## 🎯 Интеграция с существующими процессами:

- **Vikunja**: Автоматически подтягиваю задачи через MCP
- **Агенты**: Учитываю output от planner/reviewer/qa
- **CLAUDE.md**: Следую установленным соглашениям
- **Memory MCP**: Сохраняю для кросс-сессионного контекста

---

💡 **Совет**: Используйте `/sync-memory` в конце каждой рабочей сессии!

Можно указать фокус:
- `/sync-memory tasks` - только задачи
- `/sync-memory decisions` - архитектурные решения
- `/sync-memory lessons` - баги и уроки