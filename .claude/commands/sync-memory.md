---
description: "Синхронизировать знания текущей сессии в memory-bank и архитектурную документацию"
allowed-tools: ["mcp__memory__*", "mcp__vikunja__*", "Read", "Write", "Bash"]
argument-hint: "[optional: focus area - tasks|context|progress|architecture]"
---

# 🧠 Memory Bank Sync для WayMates

$ARGUMENTS

## Что обновляю:

### 1. Memory Bank (всегда)
- `memory-bank/activeContext.md` - текущий фокус работы
- `memory-bank/tasks.md` - задачи (синхронизация с Vikunja)
- `memory-bank/progress.md` - завершенная работа за сессию
- `memory-bank/creative-YYYYMMDD-*.md` - архитектурные решения (если были)
- `memory-bank/reflect-YYYYMMDD-*.md` - уроки и баги (если были)

### 2. Архитектурная документация (если менялась архитектура)
- `docs/architecture/workspace.dsl` - Structurizr компоненты и связи
- `docs/architecture/README.md` - дата обновления + метрики готовности

### 3. Memory MCP (всегда)
- Сохраняю знания в граф для кросс-сессионного контекста

## Процесс:

### Шаг 0: Автоанализ изменений (как VAN в cursor-memory-bank)

Определяю **что изменилось** за сессию и **что обновлять**:

```
Проверяю git status и conversation:

1. Схемы изменились?
   (src/shared/schemas.ts, src/core/schemas.ts)
   → ДА: обновляю workspace.dsl (Components)
   → ДА: обновляю README.md (если новая функциональность)

2. Query Builders изменились?
   (src/core/*-query-builder.ts, src/orcestrator/*-query-builder.ts)
   → ДА: обновляю workspace.dsl (Relationships)

3. Managers/Services изменились?
   (src/core/*-manager.ts, src/core/*-service.ts)
   → ДА: обновляю workspace.dsl (Components + Relationships)
   → ДА: обновляю README.md (метрики готовности)

4. Breaking changes были?
   (из conversation или reviewer output)
   → ДА: создаю creative-YYYYMMDD-*.md

5. Баги/lessons обнаружены?
   (из reviewer/qa output или user feedback)
   → ДА: создаю reflect-YYYYMMDD-*.md

6. Vikunja задачи упоминались?
   → ДА: синхронизирую через mcp__vikunja__*
```

Автоматически выбираю **path обновления** на основе анализа.

### Шаг 1: Обновляю memory-bank (всегда)
- activeContext.md - модуль, фича, статус, ключевые решения
- tasks.md - завершенные задачи, новые TODOs (+ Vikunja sync если нужно)
- progress.md - метрики сессии, commits, изменения

### Шаг 2: Обновляю workspace.dsl (если Шаг 0 выявил изменения)
- Добавляю/удаляю компоненты в LEVEL 3: Components
- Обновляю relationships между компонентами
- Обновляю descriptions если изменилась логика

### Шаг 3: Обновляю README.md (всегда дату, остальное по Шаг 0)
- Дата обновления → текущая дата
- Метрики готовности (если что-то завершено)
- Секция "Что работает" (если добавлена функциональность)

### Шаг 4: Создаю документы (если Шаг 0 выявил необходимость)
- creative-YYYYMMDD-*.md - если были breaking changes или архитектурные решения
- reflect-YYYYMMDD-*.md - если были баги/lessons

### Шаг 5: Сохраняю в Memory MCP (всегда)
- Архитектурные решения
- Обнаруженные паттерны
- Tech debt

## Итоговый отчет:

После синхронизации показываю:
- ✅ Обновленные файлы в memory-bank/
- ✅ Обновленные файлы в docs/architecture/
- ✅ Что сохранено в Memory MCP
- 💡 Рекомендации для следующей сессии

---

💡 **Используйте `/sync-memory` в конце каждой рабочей сессии!**
