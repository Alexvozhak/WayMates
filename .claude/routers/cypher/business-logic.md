# Business Logic Bridge - Связь между бизнес-задачами и Cypher

**Назначение**: Mapping между бизнес-требованиями и Cypher реализацией (НЕ дублирование документации!)
**Когда загружать**: Новый query (понять WHAT), фикс бага (понять правило), рефакторинг (проверка логики)

---

## Бизнес-документация (полный контекст)

**CRITICAL**: Это только ссылки! Полное описание бизнес-логики в этих документах:

- [search_modes_business_logic.md](../../../docs/search_modes_business_logic.md) - режимы поиска, фильтры, scoring
- [cypher_debugging_guide.md](../../../docs/cypher_debugging_guide.md) - полный debugging workflow
- [structurizr workspace](../../../docs/architecture/workspace.dsl) - архитектура системы
- [workflows (facade)](../../../docs/architecture/workflows/facade/) - бизнес-процессы

---

## Mapping Table: Задача → Документация → Query → Реализация

| Бизнес-задача | Референс (docs/) | Cypher Query | Файл реализации |
|--------------|------------------|--------------|-----------------|
| **Search: Adhoc (без фильтра userId)** | search_modes_business_logic.md | `buildAdhocSearchQuery()` | src/cypher/queries/search.ts |
| **Search: Current context (с DTW)** | search_modes_business_logic.md | `buildCurrentSearchQuery()` | src/cypher/queries/search.ts |
| **Search: Current context (без DTW)** | search_modes_business_logic.md | `buildCurrentSearchQuery()` | src/cypher/queries/search.ts |
| **Search: Target position** | search_modes_business_logic.md | `buildTargetSearchQuery()` | src/cypher/queries/search.ts |
| **Goals: Create user goal** | workflows/facade/ | `createUserGoal()` | src/core/goals-manager.ts |
| **Goals: Get user goal** | workflows/facade/ | `getUserGoal()` | src/core/goals-manager.ts |
| **Paths: Collect trajectory** | PATH_COLLECTION_ARCHITECTURE.md (archived) | `buildCollectPathQuery()` | src/cypher/queries/paths.ts |
| **Persistence: Store context** | persistence workflows | `storeContext()` | src/cypher/queries/persistence.ts |
| **Persistence: Store story** | persistence workflows | `storeStory()` | src/cypher/queries/persistence.ts |

---

## Правила использования

### ✅ DO: Используй этот документ для навигации
- Понять, какой query использовать для бизнес-задачи
- Найти референс в docs/ для деталей
- Определить файл реализации

### ❌ DON'T: Не ищи здесь детали
- Детали бизнес-логики → search_modes_business_logic.md
- Детали Cypher правил → best-practices.md, conventions.md
- Примеры кода → реальные файлы в src/cypher/queries/
- История ошибок → mistakes-registry.md

---

## Когда обновлять

- ✅ Добавлен новый query → добавь строку в Mapping Table
- ✅ Изменилось назначение query → обнови столбец "Бизнес-задача"
- ✅ Query переехал в другой файл → обнови столбец "Файл реализации"
- ❌ НЕ дублируй бизнес-описание из docs/ (только ссылки!)
