# Memory Bank Router

**Главная входная точка** для быстрого доступа к контексту проекта.

---

## 🚀 Быстрый старт

| Задача | Файл |
|--------|------|
| Пишу тесты | [project-state/testing.md](project-state/testing.md) |
| Пишу Cypher | [project-state/cypher.md](project-state/cypher.md) + [knowledge/cypher-mistakes.md](knowledge/cypher-mistakes.md) |
| Багфиксинг | [history/breaking-changes.md](history/breaking-changes.md) + git blame |
| Архитектурный вопрос | [project-state/domain-model.md](project-state/domain-model.md) + Memory MCP |
| Lint/TypeScript errors | [project-state/linting.md](project-state/linting.md) |
| Код ревью | [knowledge/code-quality.md](knowledge/code-quality.md) |

---

## 📁 Структура

### project-state/ (Текущее состояние проекта)
- **[domain-model.md](project-state/domain-model.md)** - Доменная модель + ссылки на Structurizr
- **[testing.md](project-state/testing.md)** - Test registry + команды запуска
- **[cypher.md](project-state/cypher.md)** - Cypher conventions checklist
- **[linting.md](project-state/linting.md)** - Текущие результаты ESLint/TypeScript

### history/ (История изменений)
- **[breaking-changes.md](history/breaking-changes.md)** - Все breaking changes с инструкциями
- **[sessions-brief.md](history/sessions-brief.md)** - Бизнес-смысл сессий (5-10 строк)

### knowledge/ (Быстрые справочники)
- **[cypher-mistakes.md](knowledge/cypher-mistakes.md)** - Типовые ошибки в Cypher (мои)
- **[pitfalls.md](knowledge/pitfalls.md)** - Грабли (Neo4j, TypeScript edge cases)
- **[decisions.md](knowledge/decisions.md)** - Важные решения (почему так)
- **[code-quality.md](knowledge/code-quality.md)** - Правила стиля/качества

---

## 🔗 Внешние источники

- **Memory MCP** - Граф знаний с паттернами, решениями, связями (читай через mcp__memory__*)
- **Structurizr** - [docs/architecture/](../docs/architecture/) - C4 диаграммы, SDLC
- **Git log** - `git log --oneline` для истории изменений
- **CLAUDE.md** - [../CLAUDE.md](../CLAUDE.md) - Главный файл инструкций

---

## 📝 Когда что обновлять

| Событие | Действие |
|---------|----------|
| После кода | Актуализировать `project-state/*` (testing.md, linting.md) |
| Breaking change | Добавить запись в `history/breaking-changes.md` |
| Новый урок | Обновить `knowledge/*` + Memory MCP entity |
| Конец сессии | Обновить `history/sessions-brief.md` (5-10 строк) |
| Новый паттерн | Добавить entity в Memory MCP + краткая ссылка в knowledge/* |

---

## 🧠 Memory MCP vs memory-bank

**Memory MCP** (граф знаний):
- Архитектурные паттерны с обоснованием
- Технические решения (почему так, не иначе)
- Связи между концепциями (uses, discovered_by, implements)

**memory-bank** (файлы):
- Текущее состояние проекта (test registry, lint results)
- Команды запуска (how-to)
- Бизнес-смысл изменений (sessions-brief.md)
- Быстрые справочники (checklists, quick refs)

**Правило**: Не дублируем детали из Memory MCP. В memory-bank только краткие ссылки + операционная информация.

---

*Last updated: 2025-11-11*
