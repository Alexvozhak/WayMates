# Domain Model

## Основные сущности

- **User** - пользователь системы
- **Context** - карьерный контекст (snapshot профиля в момент времени)
- **Trail** - путь между двумя контекстами (переход)
- **Goal** - цель пользователя (целевой контекст или критерии)

**Детали**: См. [docs/architecture/workspace.dsl](../../docs/architecture/workspace.dsl) (C4 Container Diagram)

---

## Архитектура слоёв

### Слои
- **shared** - общие типы для facade и core
- **core** - бизнес-логика, query builders, managers
- **facade** - REST API, MCP servers, auth

**Детали**: См. [docs/architecture/README.md](../../docs/architecture/README.md) (SDLC)

---

## Ключевые классы (краткий обзор)

| Класс | Ответственность |
|-------|-----------------|
| **StoryManager** | Управление историями (contexts + trails CRUD) |
| **SearchManager** | Поиск кандидатов (adhoc/user/target modes) |
| **GoalsManager** | Управление целями пользователей |
| **TrajectorySimilarityService** | DTW метрики (Shape/Tempo/Stability) |
| ***QueryBuilder** | Построение Cypher запросов (8 builders) |

**Детали**: См. Memory MCP entities для паттернов использования.

---

## Связи между классами

- **SearchManager** → **TrajectorySimilarityService** (для DTW enrichment)
- **SearchManager** → **SearchQueryBuilder** (для Cypher queries)
- **StoryManager** → **PersistenceQueryBuilder** (для CRUD operations)
- **GoalsManager** → **GoalsQueryBuilder** (для goals CRUD)

**Детальная архитектура**: См. [docs/architecture/workspace.dsl](../../docs/architecture/workspace.dsl)

---

## Паттерны

См. Memory MCP для деталей:
- `Query_Builder_Pattern_1` - Simple query builders return string only
- `StepWithDuration Pattern` - Adapter для DTW library
- `Schema_Layering_Pattern` - shared → core → facade
- `Cypher_Null_Safety_Pattern` - CASE WHEN $param IS NULL guard

---

*Last updated: 2025-11-11*
